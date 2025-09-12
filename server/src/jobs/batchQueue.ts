import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import { Worker, Queue } from "bullmq";
import dotenv from "dotenv";
dotenv.config();

type JobRecord = { id: string; status: "queued" | "in_progress" | "completed" | "failed"; payload: any; progress: number; result?: any; error?: string; entryErrors?: any[]; createdAt: string; updatedAt: string };

const JOB_STORE_PATH = path.resolve(process.cwd(), "data", "jobs");
await fs.mkdir(JOB_STORE_PATH, { recursive: true });

// Cleanup old job files on startup to avoid unbounded disk growth
async function cleanupOldJobs({ maxAgeDays = 7, maxFiles = 2000 } = {}) {
  try {
    const files = await fs.readdir(JOB_STORE_PATH);
    const jobFiles = files.filter(f => f.endsWith('.json'));
    // If too many files, sort by mtime and remove oldest beyond maxFiles
    if (jobFiles.length > maxFiles) {
      const items = await Promise.all(jobFiles.map(async (f) => {
        const stat = await fs.stat(path.join(JOB_STORE_PATH, f));
        return { f, mtime: stat.mtime.getTime() };
      }));
      items.sort((a, b) => a.mtime - b.mtime);
      const toRemove = items.slice(0, items.length - maxFiles);
      await Promise.all(toRemove.map(i => fs.unlink(path.join(JOB_STORE_PATH, i.f)).catch(() => {})));
    }

    // Remove files older than maxAgeDays
    const threshold = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    await Promise.all(jobFiles.map(async (f) => {
      try {
        const stat = await fs.stat(path.join(JOB_STORE_PATH, f));
        if (stat.mtime.getTime() < threshold) {
          await fs.unlink(path.join(JOB_STORE_PATH, f));
        }
      } catch (e) { /* ignore individual errors */ }
    }));
  } catch (e) {
    console.warn('Failed to cleanup old job files:', String((e as any)?.message ?? e));
  }
}

// Run cleanup at startup (fire-and-forget)
void cleanupOldJobs().catch(() => {});

const useRedis = !!process.env.REDIS_URL && process.env.DISABLE_REDIS !== 'true';
let bullQueue: any = null;
let jobWorker: any = null;
let redisInitialized = false;

const jobIndex = new Map<string, JobRecord>();

// Initialize Redis queue with proper error handling
async function initializeRedis() {
  if (!useRedis || redisInitialized) return;
  // Dynamically import ioredis and initialize BullMQ connection.
  try {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    // dynamic import to avoid require-time failure if ioredis is missing in env
  const IORedisModule: any = await import('ioredis');
  const IORedis = IORedisModule.default ?? IORedisModule;
  const connection: any = new IORedis(redisUrl);

    // Test connection
    await connection.ping();
    
    bullQueue = new Queue("batch-updates", { connection });
  const concurrency = Number(process.env.BATCH_WORKER_CONCURRENCY || process.env.BULLMQ_WORKER_CONCURRENCY || 1);
  jobWorker = new Worker("batch-updates", async job => {
      const { jobId, payload } = job.data;
      
      try {
        const { processBatchJob } = await import("./worker.js");
        const result = await processBatchJob(payload, (progress) => {
          job.updateProgress(progress);
          updateJobProgress(jobId, progress);
        });
        
        updateJobStatus(jobId, "completed", { 
          result,
          entryErrors: result.entryErrors || []
        });
        return result;
      } catch (error: any) {
        updateJobStatus(jobId, "failed", { error: error.message });
        throw error;
      }
  }, { connection, concurrency });
    
    redisInitialized = true;
    console.log('Redis queue initialized successfully');
  } catch (error: any) {
    console.warn('Redis initialization skipped or failed; using in-memory fallback:', String(error?.message ?? error));
    redisInitialized = false;
  }
}

// Graceful shutdown: close BullMQ connections when process exits
async function gracefulShutdown() {
  try {
    console.log('Shutting down: closing job worker and queue if initialized');
    if (jobWorker && typeof jobWorker.close === 'function') {
      await jobWorker.close();
      console.log('jobWorker closed');
    }
    if (bullQueue && typeof bullQueue.close === 'function') {
      await bullQueue.close();
      console.log('bullQueue closed');
    }
  } catch (e) {
    console.warn('Error during graceful shutdown:', String((e as any)?.message ?? e));
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => { void gracefulShutdown(); });
process.on('SIGTERM', () => { void gracefulShutdown(); });

// Helper functions for job management
async function saveJobToDisk(job: JobRecord) {
  try {
    await fs.writeFile(
      path.join(JOB_STORE_PATH, `${job.id}.json`), 
      JSON.stringify(job, null, 2)
    );
  } catch (error: any) {
  console.error('Failed to save job to disk:', String(error?.message ?? error));
  }
}

function updateJobProgress(jobId: string, progress: number) {
  const job = jobIndex.get(jobId);
  if (job) {
    job.progress = progress;
    job.updatedAt = new Date().toISOString();
    saveJobToDisk(job).catch(() => {});
  }
}

function updateJobStatus(jobId: string, status: JobRecord['status'], data: { result?: any; error?: string; entryErrors?: any[] } = {}) {
  const job = jobIndex.get(jobId);
  if (job) {
    job.status = status;
    job.updatedAt = new Date().toISOString();
    if (data.result) job.result = data.result;
    if (data.error) job.error = data.error;
    if (data.entryErrors) (job as any).entryErrors = data.entryErrors;
    saveJobToDisk(job).catch(() => {});
  }
}

export async function createBatchJob(payload: any) {
  // Basic runtime payload validation to catch malformed requests early
  function validatePayload(p: any) {
    const errors: string[] = [];
    if (!p) errors.push('payload missing');
    if (!p.contentTypeUid || typeof p.contentTypeUid !== 'string') errors.push('contentTypeUid required');
    if (!Array.isArray(p.entryUids) || p.entryUids.length === 0) errors.push('entryUids must be a non-empty array');
    if (!p.rule || typeof p.rule !== 'object') errors.push('rule object required');
    return { valid: errors.length === 0, errors };
  }

  const validation = validatePayload(payload);
  if (!validation.valid) {
    throw new Error(`Invalid payload: ${validation.errors.join(', ')}`);
  }

  const id = uuidv4();
  const job: JobRecord = { 
    id, 
    status: "queued", 
    payload, 
    progress: 0, 
    createdAt: new Date().toISOString(), 
    updatedAt: new Date().toISOString() 
  };
  
  jobIndex.set(id, job);
  await saveJobToDisk(job);

  // Initialize Redis if not already done
  if (useRedis && !redisInitialized) {
    await initializeRedis();
  }

  if (useRedis && redisInitialized && bullQueue) {
    try {
      await bullQueue.add("apply", { jobId: id, payload });
      console.log('Job queued in Redis:', id);
    } catch (error: any) {
  console.error('Failed to queue job in Redis, falling back to in-memory:', String(error?.message ?? error));
      setImmediate(() => { void processInMemoryJob(id); });
    }
  } else {
    // In-memory: schedule processing on next tick
    setImmediate(() => { void processInMemoryJob(id); });
  }

  return { id };
}

export function getJobStatus(jobId: string): JobRecord | null {
  return jobIndex.get(jobId) ?? null;
}

// In-memory job processor (fallback) - will call a worker function from worker.ts (import lazily)
async function processInMemoryJob(jobId: string) {
  const job = jobIndex.get(jobId);
  if (!job) return;
  
  updateJobStatus(jobId, "in_progress");

  // delegate to worker implementation
  try {
    // dynamic import so worker doesn't get loaded twice
    const { processBatchJob } = await import("./worker.js");
    const result = await processBatchJob(job.payload, (progress) => {
      updateJobProgress(jobId, progress);
    });
    
    updateJobStatus(jobId, "completed", { 
      result,
      entryErrors: result.entryErrors || []
    });
    console.log('In-memory job completed:', jobId);
  } catch (err: any) {
  updateJobStatus(jobId, "failed", { error: String(err?.message ?? err) });
  console.error('In-memory job failed:', jobId, String(err ?? 'unknown error'));
  }
}

export async function loadJobFromDisk(jobId: string) {
  try {
    const text = await fs.readFile(path.join(JOB_STORE_PATH, `${jobId}.json`), "utf-8");
    const job: JobRecord = JSON.parse(text);
    jobIndex.set(jobId, job);
    return job;
  } catch (e) {
    return null;
  }
}

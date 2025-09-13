import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger.js";
import { updateEntry } from "./contentstackService.js";

interface Snapshot {
  id: string;
  contentTypeUid: string;
  entryUid: string;
  data: any;
  createdAt: string;
  description?: string;
  version: string;
}

const SNAPSHOT_DIR = path.resolve(process.cwd(), "data", "snapshots");
await fs.mkdir(SNAPSHOT_DIR, { recursive: true });

// Store snapshot from batch job format (required by worker.ts)
export async function storeSnapshot(payload: {
  contentTypeUid: string;
  entryUid: string;
  before: any;
  rule: any;
  createdAt: string;
}): Promise<string> {
  const id = `${payload.contentTypeUid}_${payload.entryUid}_${Date.now()}`;
  const snapshot: Snapshot = {
    id,
    contentTypeUid: payload.contentTypeUid,
    entryUid: payload.entryUid,
    data: JSON.parse(JSON.stringify(payload.before)), // Deep clone
    createdAt: payload.createdAt,
    version: "1.0",
    description: `Batch job backup before applying rule: ${payload.rule.find} → ${payload.rule.replace}`
  };

  const filePath = path.join(SNAPSHOT_DIR, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2));
  
  logger.info(
    `Snapshot created: snapshotId=${id}, 
    contentTypeUid=${payload.contentTypeUid}, 
    entryUid=${payload.entryUid}, 
    description=${snapshot.description}`
  );

  return id;
}

// Load a specific snapshot (required by worker.ts)
export async function loadSnapshot(snapshotId: string): Promise<Snapshot | null> {
  try {
    const filePath = path.join(SNAPSHOT_DIR, `${snapshotId}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    logger.error('Failed to load snapshot', snapshotId, {error: error.message });
    return null;
  }
}

export async function listSnapshots() {
  const files = await fs.readdir(SNAPSHOT_DIR);
  return files.map(f => path.join(SNAPSHOT_DIR, f));
}

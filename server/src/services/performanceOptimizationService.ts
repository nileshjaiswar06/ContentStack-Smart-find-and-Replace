import type { ReplacementSuggestion } from "./suggestionService.js";
import { logger } from "../utils/logger.js";
import { Worker } from "worker_threads";
import path from "path";

export interface CacheEntry {
  key: string;
  value: any;
  expiry: number;
  hits: number;
  lastAccessed: Date;
  size: number; // Estimated size in bytes
}

export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  queueLength: number;
  lastUpdated: Date;
}

export interface OptimizationConfig {
  cacheMaxSize: number; // Maximum cache size in MB
  cacheDefaultTTL: number; // Default TTL in milliseconds
  maxConcurrentRequests: number;
  requestTimeout: number;
  enableParallelProcessing: boolean;
  enableRequestBatching: boolean;
  batchSize: number;
  batchDelay: number; // Delay before processing batch in ms
}

class PerformanceOptimizationService {
  private cache: Map<string, CacheEntry> = new Map();
  private requestQueue: Array<{
    id: string;
    request: any;
    resolve: Function;
    reject: Function;
    timestamp: Date;
  }> = [];
  private activeRequests = 0;
  private metrics: PerformanceMetrics = {
    requestCount: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    errorRate: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    queueLength: 0,
    lastUpdated: new Date()
  };
  private batchTimer: NodeJS.Timeout | null = null;
  private performanceHistory: PerformanceMetrics[] = [];
  private config: OptimizationConfig;

  constructor(config?: Partial<OptimizationConfig>) {
    this.config = {
      cacheMaxSize: 100, // 100MB default
      cacheDefaultTTL: 60 * 60 * 1000, // 1 hour
      maxConcurrentRequests: 10,
      requestTimeout: 30000, // 30 seconds
      enableParallelProcessing: true,
      enableRequestBatching: true,
      batchSize: 5,
      batchDelay: 100, // 100ms
      ...config
    };

    this.initializeService();
  }

  /**
   * Optimized suggestion generation with caching and parallel processing
   */
  async optimizedSuggestReplacements(
    suggestionFunction: Function,
    text: string,
    context?: any,
    requestId?: string
  ): Promise<ReplacementSuggestion[]> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(text, context);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.updateMetrics(Date.now() - startTime, true, false);
      logger.debug("Cache hit for suggestion request", { requestId, cacheKey });
      return cached;
    }

    // Queue management for rate limiting
    if (this.activeRequests >= this.config.maxConcurrentRequests) {
      return this.queueRequest(suggestionFunction, text, context, requestId);
    }

    try {
      this.activeRequests++;
      const result = await Promise.race([
        this.processSuggestionRequest(suggestionFunction, text, context, requestId),
        this.createTimeoutPromise()
      ]);

      // Cache the result
      this.setCache(cacheKey, result, this.config.cacheDefaultTTL);
      
      this.updateMetrics(Date.now() - startTime, false, false);
      return result;

    } catch (error: any) {
      this.updateMetrics(Date.now() - startTime, false, true);
      logger.error("Optimized suggestion generation failed", { 
        requestId, 
        error: error.message 
      });
      throw error;
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  /**
   * Batch process multiple suggestion requests for efficiency
   */
  async batchSuggestReplacements(
    suggestionFunction: Function,
    requests: Array<{
      text: string;
      context?: any;
      requestId?: string;
    }>
  ): Promise<ReplacementSuggestion[][]> {
    if (!this.config.enableRequestBatching) {
      // Process individually if batching disabled
      return Promise.all(
        requests.map(req => 
          this.optimizedSuggestReplacements(
            suggestionFunction, 
            req.text, 
            req.context, 
            req.requestId
          )
        )
      );
    }

    const startTime = Date.now();
    const results: ReplacementSuggestion[][] = [];
    const uncachedRequests: typeof requests = [];

    // Check cache for all requests first
    for (const request of requests) {
      const cacheKey = this.generateCacheKey(request.text, request.context);
      const cached = this.getFromCache(cacheKey);
      
      if (cached) {
        results.push(cached);
      } else {
        uncachedRequests.push(request);
        results.push([]); // Placeholder
      }
    }

    // Process uncached requests in parallel
    if (uncachedRequests.length > 0) {
      const batchResults = await this.processParallelRequests(
        suggestionFunction,
        uncachedRequests
      );

      // Fill in the results
      let batchIndex = 0;
      for (let i = 0; i < requests.length; i++) {
        if (results[i]!.length === 0) { // Was placeholder
          const batchResult = batchResults[batchIndex];
          if (batchResult) {
            results[i] = batchResult;
            
            // Cache the result
            const cacheKey = this.generateCacheKey(requests[i]!.text, requests[i]!.context);
            this.setCache(cacheKey, batchResult, this.config.cacheDefaultTTL);
          }
          
          batchIndex++;
        }
      }
    }

    const processingTime = Date.now() - startTime;
    logger.info("Batch suggestion processing completed", {
      totalRequests: requests.length,
      cachedResults: requests.length - uncachedRequests.length,
      processingTime,
      averageTimePerRequest: processingTime / requests.length
    });

    return results;
  }

  /**
   * Parallel processing for CPU-intensive operations
   */
  async parallelProcess<T>(
    taskFunction: Function,
    data: T[],
    options?: {
      workerScript?: string;
      maxWorkers?: number;
      chunkSize?: number;
    }
  ): Promise<any[]> {
    if (!this.config.enableParallelProcessing || data.length < 2) {
      return Promise.all(data.map(item => taskFunction(item)));
    }

    const maxWorkers = options?.maxWorkers || Math.min(4, data.length);
    const chunkSize = options?.chunkSize || Math.ceil(data.length / maxWorkers);
    const chunks = this.chunkArray(data, chunkSize);
    
    const workers: Worker[] = [];
    const promises: Promise<any>[] = [];

    try {
      for (let i = 0; i < Math.min(maxWorkers, chunks.length); i++) {
        const chunk = chunks[i];
        if (!chunk || chunk.length === 0) continue;

        const worker = new Worker(
          options?.workerScript || path.join(__dirname, '../workers/suggestionWorker.js'),
          { workerData: { chunk, taskFunction: taskFunction.toString() } }
        );

        workers.push(worker);
        
        promises.push(new Promise((resolve, reject) => {
          worker.on('message', resolve);
          worker.on('error', reject);
          worker.on('exit', (code) => {
            if (code !== 0) {
              reject(new Error(`Worker stopped with exit code ${code}`));
            }
          });
        }));
      }

      const results = await Promise.all(promises);
      return results.flat();

    } finally {
      // Clean up workers
      workers.forEach(worker => worker.terminate());
    }
  }

  /**
   * Intelligent cache management with LRU eviction
   */
  setCache(key: string, value: any, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.config.cacheDefaultTTL);
    const size = this.estimateSize(value);
    
    // Check if we need to evict items to make space
    this.ensureCacheSpace(size);
    
    const entry: CacheEntry = {
      key,
      value,
      expiry,
      hits: 0,
      lastAccessed: new Date(),
      size
    };

    this.cache.set(key, entry);
    
    logger.debug("Item cached", { 
      key: key.substring(0, 50) + '...', 
      size, 
      ttl,
      cacheSize: this.cache.size 
    });
  }

  /**
   * Get item from cache with hit tracking
   */
  getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check expiry
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.hits++;
    entry.lastAccessed = new Date();
    
    return entry.value;
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    // Update real-time metrics
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
    this.metrics.queueLength = this.requestQueue.length;
    this.metrics.lastUpdated = new Date();

    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    memoryUsage: number;
    totalHits: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    let totalHits = 0;
    let totalMemory = 0;
    let oldestEntry: Date | null = null;
    let newestEntry: Date | null = null;

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalMemory += entry.size;
      
      if (!oldestEntry || entry.lastAccessed < oldestEntry) {
        oldestEntry = entry.lastAccessed;
      }
      
      if (!newestEntry || entry.lastAccessed > newestEntry) {
        newestEntry = entry.lastAccessed;
      }
    }

    return {
      size: this.cache.size,
      hitRate: this.metrics.cacheHitRate,
      memoryUsage: totalMemory / 1024 / 1024, // MB
      totalHits,
      oldestEntry,
      newestEntry
    };
  }

  /**
   * Clear cache and reset metrics
   */
  clearCache(): void {
    this.cache.clear();
    logger.info("Cache cleared");
  }

  /**
   * Optimize cache by removing expired and least used items
   */
  optimizeCache(): void {
    const now = Date.now();
    let removedCount = 0;
    let freedMemory = 0;

    // Remove expired items
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        freedMemory += entry.size;
        this.cache.delete(key);
        removedCount++;
      }
    }

    // Remove least recently used items if cache is still too large
    if (this.getCurrentCacheSize() > this.config.cacheMaxSize * 1024 * 1024) {
      const entries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

      const targetSize = this.config.cacheMaxSize * 0.8 * 1024 * 1024; // 80% of max
      let currentSize = this.getCurrentCacheSize();

      for (const [key, entry] of entries) {
        if (currentSize <= targetSize) break;
        
        currentSize -= entry.size;
        freedMemory += entry.size;
        this.cache.delete(key);
        removedCount++;
      }
    }

    logger.info("Cache optimized", { 
      removedCount, 
      freedMemory: freedMemory / 1024 / 1024, // MB
      remainingSize: this.cache.size 
    });
  }

  // Private methods

  private initializeService(): void {
    // Start periodic optimization
    setInterval(() => {
      this.optimizeCache();
      this.updatePerformanceHistory();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Start metrics collection
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30 * 1000); // Every 30 seconds

    logger.info("Performance optimization service initialized", { config: this.config });
  }

  private generateCacheKey(text: string, context?: any): string {
    const contextStr = context ? JSON.stringify(context) : '';
    const combined = `${text}_${contextStr}`;
    
    // Use a simple hash to keep keys manageable
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `suggestion_${Math.abs(hash)}`;
  }

  private async queueRequest(
    suggestionFunction: Function,
    text: string,
    context?: any,
    requestId?: string
  ): Promise<ReplacementSuggestion[]> {
    return new Promise((resolve, reject) => {
      const queueItem = {
        id: requestId || `queued_${Date.now()}`,
        request: { suggestionFunction, text, context, requestId },
        resolve,
        reject,
        timestamp: new Date()
      };

      this.requestQueue.push(queueItem);
      
      logger.debug("Request queued", { 
        requestId: queueItem.id,
        queueLength: this.requestQueue.length 
      });

      // Set timeout for queued request
      setTimeout(() => {
        const index = this.requestQueue.findIndex(item => item.id === queueItem.id);
        if (index >= 0) {
          this.requestQueue.splice(index, 1);
          reject(new Error('Request timeout in queue'));
        }
      }, this.config.requestTimeout);
    });
  }

  private async processQueue(): Promise<void> {
    if (this.requestQueue.length === 0 || this.activeRequests >= this.config.maxConcurrentRequests) {
      return;
    }

    const queueItem = this.requestQueue.shift();
    if (!queueItem) return;

    try {
      this.activeRequests++;
      const { suggestionFunction, text, context, requestId } = queueItem.request;
      
      const result = await this.processSuggestionRequest(
        suggestionFunction,
        text,
        context,
        requestId
      );
      
      queueItem.resolve(result);
    } catch (error) {
      queueItem.reject(error);
    } finally {
      this.activeRequests--;
      // Process next item in queue
      setImmediate(() => this.processQueue());
    }
  }

  private async processSuggestionRequest(
    suggestionFunction: Function,
    text: string,
    context?: any,
    requestId?: string
  ): Promise<ReplacementSuggestion[]> {
    // Add performance monitoring
    const startTime = Date.now();
    
    try {
      const result = await suggestionFunction(text, context, requestId);
      
      logger.debug("Suggestion request processed", {
        requestId,
        processingTime: Date.now() - startTime,
        suggestionCount: result.length
      });
      
      return result;
    } catch (error) {
      logger.error("Suggestion request processing failed", {
        requestId,
        processingTime: Date.now() - startTime,
        error
      });
      throw error;
    }
  }

  private async processParallelRequests(
    suggestionFunction: Function,
    requests: Array<{ text: string; context?: any; requestId?: string }>
  ): Promise<ReplacementSuggestion[][]> {
    const maxConcurrent = Math.min(this.config.maxConcurrentRequests, requests.length);
    const chunks = this.chunkArray(requests, Math.ceil(requests.length / maxConcurrent));
    
    const chunkPromises = chunks.map(chunk =>
      Promise.all(chunk.map(req =>
        this.processSuggestionRequest(
          suggestionFunction,
          req.text,
          req.context,
          req.requestId
        )
      ))
    );

    const chunkResults = await Promise.all(chunkPromises);
    return chunkResults.flat();
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.config.requestTimeout);
    });
  }

  private updateMetrics(responseTime: number, cacheHit: boolean, error: boolean): void {
    this.metrics.requestCount++;
    
    // Update average response time (running average)
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + responseTime) / 
      this.metrics.requestCount;

    // Update cache hit rate
    const totalCacheChecks = this.metrics.requestCount;
    const cacheHits = Math.round(this.metrics.cacheHitRate * (totalCacheChecks - 1)) + (cacheHit ? 1 : 0);
    this.metrics.cacheHitRate = cacheHits / totalCacheChecks;

    // Update error rate
    const totalRequests = this.metrics.requestCount;
    const errors = Math.round(this.metrics.errorRate * (totalRequests - 1)) + (error ? 1 : 0);
    this.metrics.errorRate = errors / totalRequests;
  }

  private updatePerformanceHistory(): void {
    this.performanceHistory.push({ ...this.metrics });
    
    // Keep only last 100 entries
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-100);
    }
  }

  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
    
    // CPU usage would require additional monitoring
    // this.metrics.cpuUsage = getCpuUsage(); // Placeholder
  }

  private ensureCacheSpace(requiredSize: number): void {
    const currentSize = this.getCurrentCacheSize();
    const maxSizeBytes = this.config.cacheMaxSize * 1024 * 1024;
    
    if (currentSize + requiredSize > maxSizeBytes) {
      // Evict items using LRU strategy
      const entries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

      let freedSpace = 0;
      for (const [key, entry] of entries) {
        if (freedSpace >= requiredSize) break;
        
        freedSpace += entry.size;
        this.cache.delete(key);
      }
    }
  }

  private getCurrentCacheSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  private estimateSize(obj: any): number {
    // Simple size estimation - in production, use a more sophisticated approach
    const jsonStr = JSON.stringify(obj);
    return jsonStr.length * 2; // Rough estimate for UTF-16
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

export const performanceOptimizationService = new PerformanceOptimizationService();

import { logger } from "../utils/logger.js";
import { syncExternalBrandkitData } from "./externalBrandkitService.js";
import { getBrandkitConfig } from "./brandkitService.js";
import { EventEmitter } from "events";

export interface RealtimeSyncEvent {
  type: 'brandkit_updated' | 'content_changed' | 'sync_started' | 'sync_completed' | 'sync_failed';
  data: any;
  timestamp: Date;
  requestId?: string;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSync: Date | null;
  lastSuccess: Date | null;
  lastError: string | null;
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
}

class RealtimeSyncService extends EventEmitter {
  private syncStatus: SyncStatus = {
    isRunning: false,
    lastSync: null,
    lastSuccess: null,
    lastError: null,
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0
  };

  private syncInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor() {
    super();
    this.setMaxListeners(50); // Allow up to 50 listeners
  }

  // Initialize the real-time sync service
  initialize(): void {
    if (this.isInitialized) {
      logger.warn("RealtimeSyncService already initialized");
      return;
    }

    logger.info("Initializing RealtimeSyncService");
    
    // Start periodic sync (every 5 minutes)
    this.startPeriodicSync(5);
    
    this.isInitialized = true;
    logger.info("RealtimeSyncService initialized successfully");
  }

  // Start periodic sync
  startPeriodicSync(intervalMinutes: number = 5): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      try {
        await this.performSync();
      } catch (error: any) {
        logger.error("Periodic sync failed", { error: error.message });
      }
    }, intervalMinutes * 60 * 1000);

    logger.info("Periodic sync started", { intervalMinutes });
  }

  // Stop periodic sync
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info("Periodic sync stopped");
    }
  }

  // Perform a sync operation
  async performSync(requestId?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (this.syncStatus.isRunning) {
      logger.warn("Sync already running, skipping", { requestId });
      return { success: false, error: "Sync already running" };
    }

    this.syncStatus.isRunning = true;
    this.syncStatus.lastSync = new Date();
    this.syncStatus.totalSyncs++;

    this.emit('sync_started', {
      type: 'sync_started',
      data: { requestId },
      timestamp: new Date(),
      ...(requestId && { requestId })
    } as RealtimeSyncEvent);

    try {
      logger.info("Starting real-time brandkit sync", { requestId });
      
      const syncResult = await syncExternalBrandkitData(requestId);
      
      this.syncStatus.isRunning = false;
      this.syncStatus.lastSuccess = new Date();
      this.syncStatus.successfulSyncs++;
      this.syncStatus.lastError = null;

      const event: RealtimeSyncEvent = {
        type: 'sync_completed',
        data: syncResult,
        timestamp: new Date(),
        ...(requestId && { requestId })
      };

      this.emit('sync_completed', event);
      this.emit('brandkit_updated', {
        type: 'brandkit_updated',
        data: syncResult,
        timestamp: new Date(),
        ...(requestId && { requestId })
      } as RealtimeSyncEvent);

      logger.info("Real-time brandkit sync completed", {
        requestId,
        brandsUpdated: syncResult.brandsUpdated,
        bannedPhrasesUpdated: syncResult.bannedPhrasesUpdated,
        toneRulesUpdated: syncResult.toneRulesUpdated
      });

      return { success: true, data: syncResult };
    } catch (error: any) {
      this.syncStatus.isRunning = false;
      this.syncStatus.lastError = error.message;
      this.syncStatus.failedSyncs++;

      const event: RealtimeSyncEvent = {
        type: 'sync_failed',
        data: { error: error.message },
        timestamp: new Date(),
        ...(requestId && { requestId })
      };

      this.emit('sync_failed', event);

      logger.error("Real-time brandkit sync failed", {
        requestId,
        error: error.message
      });

      return { success: false, error: error.message };
    }
  }

  // Handle content change event
  async handleContentChange(
    contentTypeUid: string, 
    entryUid: string, 
    event: string,
    requestId?: string
  ): Promise<void> {
    const brandContentTypes = ['brands', 'banned_phrases', 'tone_rules'];
    
    if (!brandContentTypes.includes(contentTypeUid)) {
      logger.debug("Non-brand content changed, skipping sync", { 
        contentTypeUid, 
        entryUid, 
        event 
      });
      return;
    }

    logger.info("Brand content changed, triggering sync", {
      contentTypeUid,
      entryUid,
      event,
      requestId
    });

    this.emit('content_changed', {
      type: 'content_changed',
      data: { contentTypeUid, entryUid, event },
      timestamp: new Date(),
      ...(requestId && { requestId })
    } as RealtimeSyncEvent);

    // Trigger immediate sync for brand content changes
    await this.performSync(requestId);
  }

  // Get current sync status
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  
  // Get brandkit configuration (for real-time updates)
  async getBrandkitConfig(): Promise<any> {
    try {
      const config = getBrandkitConfig();
      return {
        success: true,
        data: config,
        timestamp: new Date()
      };
    } catch (error: any) {
      logger.error("Failed to get brandkit config", { error: error.message });
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  // Subscribe to sync events
  subscribeToEvents(callback: (event: RealtimeSyncEvent) => void): void {
    this.on('sync_started', callback);
    this.on('sync_completed', callback);
    this.on('sync_failed', callback);
    this.on('brandkit_updated', callback);
    this.on('content_changed', callback);
  }

  // Unsubscribe from sync events
  unsubscribeFromEvents(callback: (event: RealtimeSyncEvent) => void): void {
    this.off('sync_started', callback);
    this.off('sync_completed', callback);
    this.off('sync_failed', callback);
    this.off('brandkit_updated', callback);
    this.off('content_changed', callback);
  }

  // Get sync statistics
  getSyncStatistics(): any {
    const now = new Date();
    const lastSync = this.syncStatus.lastSync;
    const lastSuccess = this.syncStatus.lastSuccess;
    
    return {
      status: this.syncStatus,
      uptime: this.isInitialized ? 'active' : 'inactive',
      nextSync: this.syncInterval ? 'scheduled' : 'disabled',
      timeSinceLastSync: lastSync ? now.getTime() - lastSync.getTime() : null,
      timeSinceLastSuccess: lastSuccess ? now.getTime() - lastSuccess.getTime() : null,
      successRate: this.syncStatus.totalSyncs > 0 
        ? (this.syncStatus.successfulSyncs / this.syncStatus.totalSyncs) * 100 
        : 0
    };
  }

   // Shutdown the service
  shutdown(): void {
    this.stopPeriodicSync();
    this.removeAllListeners();
    this.isInitialized = false;
    logger.info("RealtimeSyncService shutdown");
  }
}

// Export singleton instance
export const realtimeSyncService = new RealtimeSyncService();

// Initialize on module load
realtimeSyncService.initialize();
import { config } from './config';

// Real-time sync service for Contentstack
export class RealtimeSyncService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isConnected = false;

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      // In a real implementation, you'd connect to Contentstack's Live Preview WebSocket
      // For now, we'll simulate real-time updates with polling
      this.startPolling();
    } catch (error) {
      console.error('Failed to connect to real-time service:', error);
      this.scheduleReconnect();
    }
  }

  private startPolling() {
    // Poll for updates every 5 minutes to avoid rate limiting
    setInterval(() => {
      this.checkForUpdates();
    }, 300000); // 5 minutes
  }

  private async checkForUpdates() {
    try {
      // In a real implementation, you'd check for updates from Contentstack
      // For now, we'll emit a mock update event
      this.emit('content-updated', {
        timestamp: new Date().toISOString(),
        type: 'content-update',
        data: {
          message: 'Content updated from CMS'
        }
      });
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        // Attempting to reconnect
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  // Event subscription
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  // Event emission
  private emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Public methods
  subscribeToContentUpdates(callback: (data: any) => void) {
    return this.on('content-updated', callback);
  }

  subscribeToEntryUpdates(callback: (data: any) => void) {
    return this.on('entry-updated', callback);
  }

  subscribeToContentTypeUpdates(callback: (data: any) => void) {
    return this.on('content-type-updated', callback);
  }

  // Simulate real-time events
  simulateContentUpdate(contentType: string, entryUid: string) {
    this.emit('content-updated', {
      timestamp: new Date().toISOString(),
      type: 'entry-updated',
      data: {
        contentTypeUid: contentType,
        entryUid: entryUid,
        action: 'updated'
      }
    });
  }

  simulateContentTypeUpdate(contentTypeUid: string) {
    this.emit('content-updated', {
      timestamp: new Date().toISOString(),
      type: 'content-type-updated',
      data: {
        contentTypeUid: contentTypeUid,
        action: 'updated'
      }
    });
  }

  // Connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }

  // Cleanup
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
    this.isConnected = false;
  }
}

// Singleton instance
export const realtimeSync = new RealtimeSyncService();

// Hook for React components
export const useRealtimeSync = () => {
  return {
    subscribeToContentUpdates: realtimeSync.subscribeToContentUpdates.bind(realtimeSync),
    subscribeToEntryUpdates: realtimeSync.subscribeToEntryUpdates.bind(realtimeSync),
    subscribeToContentTypeUpdates: realtimeSync.subscribeToContentTypeUpdates.bind(realtimeSync),
    getConnectionStatus: realtimeSync.getConnectionStatus.bind(realtimeSync),
    simulateContentUpdate: realtimeSync.simulateContentUpdate.bind(realtimeSync),
    simulateContentTypeUpdate: realtimeSync.simulateContentTypeUpdate.bind(realtimeSync),
  };
};
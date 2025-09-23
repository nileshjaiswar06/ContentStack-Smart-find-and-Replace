import Contentstack, { Region } from '@contentstack/delivery-sdk';
import { config } from './config';

// Build and normalize Contentstack configuration
const rawRegion = config.contentstack.region || '';
const regionKey = String(rawRegion).toUpperCase();
let resolvedRegion: Region | undefined = undefined;
if (regionKey && (regionKey in Region)) {
  resolvedRegion = Region[regionKey as keyof typeof Region] as Region;
}

// If the environment looks like a UID (starts with 'blt') the user may have provided
// the environment UID instead of the environment name (e.g. 'development'). The Delivery
// SDK expects the environment name.
const environmentValue = config.contentstack.environment;
  if (typeof environmentValue === 'string' && environmentValue.startsWith('blt')) {
    // Non-fatal: log a helpful warning for debugging 412 errors caused by wrong environment
    // (do not expose secrets)
  }

// Pick a region-appropriate live preview host when not explicitly overridden.
let livePreviewHost = config.contentstack.livePreviewHost;
if ((!livePreviewHost || livePreviewHost === 'api.contentstack.io') && regionKey === 'EU') {
  livePreviewHost = 'eu-api.contentstack.com';
}

// Prepare the config object we pass to the SDK. Avoid printing secrets to the console.
const contentstackConfig = {
  apiKey: config.contentstack.apiKey,
  deliveryToken: config.contentstack.deliveryToken,
  environment: environmentValue,
  region: resolvedRegion,
  livePreview: {
    enable: config.features.enableLivePreview,
    host: livePreviewHost,
  },
};

// Initialize Contentstack SDK
export const contentstack = Contentstack.stack(contentstackConfig);

// Content type will be fetched dynamically from CMS
export type ContentType = string;

// Real-time content fetching with caching
export class ContentstackService {
  private cache = new Map<string, { data: unknown; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getContentTypes(): Promise<ContentType[]> {
    try {
      // Fetch all content types from Contentstack CMS
      const result = await contentstack.contentType().find();
      interface ContentTypeResponse {
        uid: string;
        [key: string]: unknown;
      }
      return (result.content_types as ContentTypeResponse[] | undefined)?.map((ct) => ct.uid) || [];
    } catch (error) {
      console.error('Error fetching content types from CMS:', error);
      throw error; // Don't fallback, let the error propagate
    }
  }

  async getEntries(contentType: ContentType, options: {
    environment?: string;
    branch?: string;
    limit?: number;
    skip?: number;
  } = {}): Promise<{ entries: unknown[]; [key: string]: unknown }> {
    const cacheKey = `entries_${contentType}_${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data as { entries: unknown[]; [key: string]: unknown };
    }

    try {
      const query = contentstack.contentType(contentType).entry();
      
      if (options.limit) query.limit(options.limit);
      if (options.skip) query.skip(options.skip);
      
      const result = await query.find();
      
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result as { entries: unknown[]; [key: string]: unknown };
    } catch (error) {
      console.error(`Error fetching ${contentType} entries:`, error);
      throw error;
    }
  }

  async getEntry(contentType: ContentType, entryUid: string, options: {
    environment?: string;
    branch?: string;
  } = {}): Promise<unknown> {
    const cacheKey = `entry_${contentType}_${entryUid}_${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const entry = await contentstack.contentType(contentType).entry(entryUid).fetch();
      
      this.cache.set(cacheKey, {
        data: entry,
        timestamp: Date.now()
      });
      
      return entry;
    } catch (error) {
      console.error(`Error fetching ${contentType} entry ${entryUid}:`, error);
      throw error;
    }
  }

  // Clear cache for real-time updates
  clearCache(contentType?: ContentType): void {
    if (contentType) {
      // Clear specific content type cache
      for (const [key] of this.cache) {
        if (key.includes(contentType)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  // Get cache status
  getCacheStatus(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const contentstackService = new ContentstackService();
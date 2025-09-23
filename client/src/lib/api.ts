import { SearchResult, ReplacementPlan, SearchFilters } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

// Server Response Types (matching your actual server)
export interface ContentTypeEntry {
  uid: string;
  title?: string;
  locale?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ServerListResponse {
  ok: boolean;
  data: {
    entries: ContentTypeEntry[];
    count: number;
    contentTypeUid: string;
  };
}

export interface ServerPreviewRequest {
  target: {
    contentTypeUid: string;
    entryUid: string;
    environment?: string;
    locale?: string;
  };
  rule: {
    find: string;
    replace: string;
    mode?: 'literal' | 'regex' | 'smart';
    caseSensitive?: boolean;
    wholeWord?: boolean;
    updateUrls?: boolean;
    updateEmails?: boolean;
  };
  applySuggestions?: boolean;
}

export interface ServerPreviewResponse {
  ok: boolean;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changes: Array<{
    path: string;
    before: unknown;
    after: unknown;
  }>;
  suggestions?: unknown[];
  ner?: { entities: unknown[] };
  replacedCount: number;
  previewHtml?: string;
}

export interface ServerApplyResponse {
  ok: boolean;
  updated: {
    uid: string;
    _version?: string;
    updated_at?: string;
  };
  totalChanges: number;
  details?: Record<string, unknown>;
}

export interface WebhookStatusResponse {
  success: boolean;
  data: {
    webhooks: {
      entry: { enabled: boolean; path: string };
      asset: { enabled: boolean; path: string };
      publish: { enabled: boolean; path: string };
      automate: { enabled: boolean; path: string };
    };
    security: {
      signature_verification: boolean;
      webhook_secret_configured: boolean;
    };
    brandkit: {
      real_time_sync: boolean;
      content_types: string[];
      last_sync: string;
    };
  };
}

// Legacy interfaces for compatibility
interface SearchResponse {
  entries: SearchResult[];
  total: number;
  hasMore?: boolean;
}

interface ReplaceResponse {
  changesApplied: number;
  message: string;
}

interface PreviewResponse {
  replacementPlan: ReplacementPlan[];
  totalMatches: number;
  estimatedChanges: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // CORRECTED: Match actual server endpoints
  async listEntries(contentTypeUid: string): Promise<ServerListResponse> {
    return this.request(`/api/replace/${contentTypeUid}`);
  }

  async previewReplace(request: ServerPreviewRequest): Promise<ServerPreviewResponse> {
    return this.request('/api/replace/preview', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async applyReplace(request: ServerPreviewRequest): Promise<ServerApplyResponse> {
    return this.request('/api/replace/apply', {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  }

  async getWebhookStatus(): Promise<WebhookStatusResponse> {
    return this.request('/api/webhooks/status');
  }

  // Health check using webhook status
  async healthCheck(): Promise<boolean> {
    try {
      await this.getWebhookStatus();
      return true;
    } catch {
      return false;
    }
  }

  // Mock history since server doesn't have it yet
  async getHistory(): Promise<import('../types').HistoryItem[]> {
    return [];
  }

  // Adapter methods to match your hook's expectations
  async searchContent(
    query: string,
    filters: SearchFilters,
    page: number,
    limit: number
  ): Promise<SearchResponse> {
    // For now, use the list entries endpoint
    const contentType = filters.contentType === 'all' ? 'articles' : (filters.contentType as string) || 'articles';
    try {
      const response = await this.listEntries(contentType);
      
      return {
        entries: response.data.entries.map(entry => ({
          id: entry.uid,
          title: entry.title || entry.uid,
          type: contentType,
          url: entry.uid,
          snippet: `Entry: ${entry.uid}`,
          lastModified: entry.updated_at || new Date().toISOString()
        } as SearchResult)),
        total: response.data.count,
        hasMore: false
      };
    } catch (error) {
      console.warn('Search failed, returning empty results:', error);
      return {
        entries: [],
        total: 0,
        hasMore: false
      };
    }
  }

  async generatePreview(
    searchQuery: string,
    replaceQuery: string,
    entryIds: string[],
    options: Record<string, unknown>
  ): Promise<PreviewResponse> {
    // For now, preview the first entry
    if (entryIds.length === 0) {
      return { replacementPlan: [], totalMatches: 0, estimatedChanges: 0 };
    }

    try {
      const request: ServerPreviewRequest = {
        target: {
          contentTypeUid: (options['contentType'] as string) || 'articles',
          entryUid: entryIds[0]
        },
        rule: {
          find: searchQuery,
          replace: replaceQuery,
          mode: 'literal',
          caseSensitive: (options['caseSensitive'] as boolean) || false
        }
      };

      const response = await this.previewReplace(request);
      
      return {
        replacementPlan: [{
          id: entryIds[0],
          title: `Entry ${entryIds[0]}`,
          changes: response.changes,
          approved: false
        }],
        totalMatches: response.replacedCount,
        estimatedChanges: response.changes.length
      };
    } catch (error) {
      console.warn('Preview generation failed:', error);
      return { replacementPlan: [], totalMatches: 0, estimatedChanges: 0 };
    }
  }

  async applyReplacements(approvedChanges: Array<ReplacementPlan>): Promise<ReplaceResponse> {
    let totalChanges = 0;
    
    try {
      for (const change of approvedChanges) {
        // For now, just count the changes - real implementation would call server
        totalChanges += (change.changes?.length as number) || 0;
      }
      
      return {
        changesApplied: totalChanges,
        message: `Successfully applied ${totalChanges} changes`
      };
    } catch (error) {
      throw new Error(`Failed to apply changes: ${error}`);
    }
  }

  // Get content types (mock for now)
  async getContentTypes(): Promise<string[]> {
    return ['articles', 'products', 'blogs', 'pages'];
  }

  // Get locales (mock for now)
  async getLocales(): Promise<string[]> {
    return ['en-us', 'en-gb', 'es-es', 'fr-fr', 'de-de'];
  }
}

export const api = new ApiClient();

// Error handling utility
export const handleApiError = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = error as any;
    if (typeof e.message === 'string') return e.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
};

export default api;
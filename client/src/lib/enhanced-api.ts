// Removed unused imports
import { config } from './config';

const API_BASE = config.api.baseUrl;

// Enhanced API client that integrates with your server endpoints
export interface ContentTypeEntry {
  uid: string;
  title?: string;
  name?: string;
  locale?: string;
  updated_at?: string;
  created_at?: string;
  status?: string;
  _version?: number;
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
  entryUid: string;
  contentTypeUid: string;
  changes: Array<{
    field: string;
    count: number;
  }>;
  totalChanges: number;
  before: ContentTypeEntry;
  after: ContentTypeEntry;
  replacedCount: number;
  occurrencesByField: Array<{
    field: string;
    occurrences: number;
  }>;
  occurrencesTotal: number;
  suggestions: Array<{
    entity: {
      text: string;
      type: string;
      confidence?: number;
      source?: string;
    };
    suggestedReplacement: string;
    confidence: number;
    reason: string;
    source: string;
    context: string;
    domainContext: Record<string, unknown>;
    domainAdjustedConfidence: number;
    relevanceScore: number;
    scoringMetrics: Record<string, unknown>;
    scoreExplanation: string[];
    suggestionId: string;
    autoApply: boolean;
  }>;
  appliedSuggestions: unknown;
  timestamp: string;
}

export interface ServerApplyRequest {
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

export interface ServerApplyResponse {
  ok: boolean;
  entryUid: string;
  contentTypeUid: string;
  changes: Array<{
    field: string;
    count: number;
  }>;
  totalChanges: number;
  updated: {
    uid: string;
    _version: number;
    updated_at: string;
  };
  replacedCount: number;
  appliedSuggestions: unknown;
  timestamp: string;
}

export interface BulkPreviewRequest {
  contentTypeUid: string;
  entryUids: string[];
  rule: {
    find: string;
    replace: string;
    mode?: 'literal' | 'regex' | 'smart';
    caseSensitive?: boolean;
    wholeWord?: boolean;
    updateUrls?: boolean;
    updateEmails?: boolean;
  };
}

export interface BulkApplyRequest {
  contentTypeUid: string;
  entryUids: string[];
  rule: {
    find: string;
    replace: string;
    mode?: 'literal' | 'regex' | 'smart';
    caseSensitive?: boolean;
    wholeWord?: boolean;
    updateUrls?: boolean;
    updateEmails?: boolean;
  };
  dryRun?: boolean;
}

export interface BulkJobResponse {
  ok: boolean;
  jobId: string;
  message: string;
  requestId: string;
}

export interface JobStatusResponse {
  ok: boolean;
  job: {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    payload: Record<string, unknown>;
    progress: number;
    createdAt: string;
    updatedAt: string;
    result?: {
      processed: number;
      total: number;
      results: Array<{
        entryUid: string;
        replacedCount: number;
        updated: {
          uid: string;
          _version: number;
        };
      }>;
      entryErrors: unknown[];
      hasErrors: boolean;
    };
    entryErrors: unknown[];
  };
  requestId: string;
}

export interface SnapshotResponse {
  ok: boolean;
  snapshots: Array<{
    id: string;
    contentTypeUid: string;
    entryUid: string;
    createdAt: string;
    description: string;
  }>;
}

export interface RollbackRequest {
  snapshotId: string;
  dryRun?: boolean;
}

export interface RollbackResponse {
  ok: boolean;
  message: string;
  restored: {
    uid: string;
    _version: number;
  };
  requestId: string;
}

// Brandkit interfaces
export interface BrandkitProvider {
  name: string;
  enabled: boolean;
  configured: boolean;
  baseUrl: string;
}

export interface BrandkitProvidersResponse {
  success: boolean;
  data: BrandkitProvider[];
}

export interface BrandkitStatus {
  mappingCount: number;
  lastUpdated: string;
  brands: string[];
  totalProducts: number;
}

export interface BrandkitStatusResponse {
  success: boolean;
  data: BrandkitStatus;
}

export interface BrandkitSyncResponse {
  success: boolean;
  data: {
    success: boolean;
    brandsUpdated: number;
    bannedPhrasesUpdated: number;
    toneRulesUpdated: number;
    errors: string[];
    lastSync: string;
  };
}

export interface BrandkitSuggestion {
  text: string;
  suggestedReplacement: string;
  confidence: number;
  reason: string;
  context?: string;
}

export interface BrandkitSuggestionsResponse {
  success: boolean;
  data: {
    suggestions: BrandkitSuggestion[];
    count: number;
    textLength: number;
    context: {
      contentTypeUid: string;
    };
  };
}

export interface ToneAnalysisIssue {
  text: string;
  issue: string;
  suggestion: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ToneAnalysisResponse {
  success: boolean;
  data: {
    overallTone: string;
    confidence: number;
    suggestions: string[];
    issues: ToneAnalysisIssue[];
  };
}

export class EnhancedApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (response.status === 429 && retryCount < 3) {
        // Rate limited - wait and retry with exponential backoff
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`Rate limited, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error: ${response.status} - ${error}`);
      }

      return response.json();
    } catch (error) {
      if (retryCount < 3 && (error as Error).message.includes('429')) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request<T>(endpoint, options, retryCount + 1);
      }
      throw error;
    }
  }

  // Health check
  async healthCheck(environment = 'development', branch = 'main'): Promise<boolean> {
    try {
      const response = await this.request<{ ok: boolean; message: string }>(
        `/health?environment=${environment}&branch=${branch}`
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  // List entries for a content type
  async listEntries(
    contentTypeUid: string, 
    environment = 'development', 
    branch = 'main'
  ): Promise<ServerListResponse> {
    return this.request(`/api/replace/${contentTypeUid}?environment=${environment}&branch=${branch}`);
  }

  // Preview replacement
  async previewReplace(
    request: ServerPreviewRequest,
    environment = 'development',
    branch = 'main'
  ): Promise<ServerPreviewResponse> {
    return this.request(`/api/replace/preview?environment=${environment}&branch=${branch}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Apply replacement
  async applyReplace(
    request: ServerApplyRequest,
    environment = 'development',
    branch = 'main'
  ): Promise<ServerApplyResponse> {
    return this.request(`/api/replace/apply?environment=${environment}&branch=${branch}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  }

  // Bulk preview
  async bulkPreview(
    request: BulkPreviewRequest,
    environment = 'development',
    branch = 'main'
  ): Promise<unknown> {
    return this.request(`/api/replace/bulk-preview?environment=${environment}&branch=${branch}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Bulk apply
  async bulkApply(
    request: BulkApplyRequest,
    environment = 'development',
    branch = 'main'
  ): Promise<BulkJobResponse> {
    return this.request(`/api/replace/bulk-apply?environment=${environment}&branch=${branch}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  }

  // Get job status
  async getJobStatus(
    jobId: string,
    environment = 'development',
    branch = 'main'
  ): Promise<JobStatusResponse> {
    return this.request(`/api/replace/job/${jobId}?environment=${environment}&branch=${branch}`);
  }

  // Get snapshots
  async getSnapshots(
    environment = 'development',
    branch = 'main'
  ): Promise<SnapshotResponse> {
    return this.request(`/api/replace/snapshots?environment=${environment}&branch=${branch}`);
  }

  // Rollback
  async rollback(
    request: RollbackRequest,
    environment = 'development',
    branch = 'main'
  ): Promise<RollbackResponse> {
    return this.request(`/api/replace/rollback?environment=${environment}&branch=${branch}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Get suggestions for text
  async getSuggestions(
    text: string,
    contentTypeUid?: string,
    environment = 'development',
    branch = 'main'
  ): Promise<unknown> {
    return this.request(`/api/replace/suggest?environment=${environment}&branch=${branch}`, {
      method: 'POST',
      body: JSON.stringify({ text, contentTypeUid }),
    });
  }

  // Batch suggestions
  async getBatchSuggestions(
    texts: string[],
    contentTypeUid?: string,
    environment = 'development',
    branch = 'main'
  ): Promise<unknown> {
    return this.request(`/api/replace/suggest/batch?environment=${environment}&branch=${branch}`, {
      method: 'POST',
      body: JSON.stringify({ texts, contentTypeUid }),
    });
  }

  // Get NER entities for text
  async getNEREntities(
    text: string,
    environment = 'development',
    branch = 'main'
  ): Promise<unknown> {
    return this.request(`/api/ner?environment=${environment}&branch=${branch}`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  // Get NER entities for multiple texts
  async getBatchNEREntities(
    texts: string[],
    environment = 'development',
    branch = 'main'
  ): Promise<unknown> {
    return this.request(`/api/ner/batch?environment=${environment}&branch=${branch}`, {
      method: 'POST',
      body: JSON.stringify({ texts }),
    });
  }

  // Poll job status until completion
  async pollJobStatus(
    jobId: string,
    environment = 'development',
    branch = 'main',
    interval = 2000,
    maxAttempts = 30
  ): Promise<JobStatusResponse> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const status = await this.getJobStatus(jobId, environment, branch);
      
      if (status.job.status === 'completed' || status.job.status === 'failed') {
        return status;
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
      attempts++;
    }
    
    throw new Error('Job polling timeout');
  }

  // Brandkit API methods
  async getBrandkitProviders(
    environment = 'development',
    branch = 'main'
  ): Promise<BrandkitProvidersResponse> {
    return this.request(`/api/brandkit/providers?environment=${environment}&branch=${branch}`);
  }

  async getBrandkitStatus(
    environment = 'development',
    branch = 'main'
  ): Promise<BrandkitStatusResponse> {
    return this.request(`/api/brandkit/status?environment=${environment}&branch=${branch}`);
  }

  async syncBrandkit(
    environment = 'development',
    branch = 'main'
  ): Promise<BrandkitSyncResponse> {
    return this.request(`/api/brandkit/sync?environment=${environment}&branch=${branch}`, {
      method: 'POST',
    });
  }

  async getBrandkitSuggestions(
    text: string,
    context: { contentTypeUid?: string },
    environment = 'development',
    branch = 'main'
  ): Promise<BrandkitSuggestionsResponse> {
    return this.request(`/api/brandkit/suggestions?environment=${environment}&branch=${branch}`, {
      method: 'POST',
      body: JSON.stringify({ text, context }),
    });
  }

  async analyzeTone(
    text: string,
    context: { targetTone?: string },
    environment = 'development',
    branch = 'main'
  ): Promise<ToneAnalysisResponse> {
    return this.request(`/api/brandkit/analyze-tone?environment=${environment}&branch=${branch}`, {
      method: 'POST',
      body: JSON.stringify({ text, context }),
    });
  }
}

export const enhancedApi = new EnhancedApiClient();
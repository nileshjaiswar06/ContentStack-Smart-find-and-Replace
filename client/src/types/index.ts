// Core Data Types
export interface SearchResult {
  id: string; // Changed from number to string to match server
  title: string;
  type: string; // Changed from contentType to type
  url: string; // Added url field
  snippet: string; // Added snippet field
  lastModified: string; // Changed from updatedAt
  contentType?: string; // Optional for backward compatibility
  locale?: string;
  status?: string;
  fields?: {
    [key: string]: {
      value: string;
      type: string;
      path: string;
    };
  };
  createdAt?: string;
  updatedAt?: string;
  author?: string;
}

export interface ReplacementPlan {
  id: string; // Added id field
  title: string; // Added title field
  changes: Array<{ // Changed structure to match server
    path: string;
    before: unknown;
    after: unknown;
  }>;
  approved: boolean;
  entryId?: number; // Optional for backward compatibility
  fieldPath?: string;
  originalValue?: string;
  newValue?: string;
  confidence?: number;
  matchType?: 'exact' | 'partial' | 'fuzzy';
}

export interface SearchFilters {
  contentType: string;
  locale: string;
  status: string;
  dateRange?: {
    start: string;
    end: string;
  };
  author?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  timestamp?: string;
}

export interface SearchResponse {
  entries: SearchResult[];
  total: number;
  page: number;
  limit: number;
  hasMore?: boolean;
}

export interface ReplaceResponse {
  success: boolean;
  changesApplied: number;
  changes: ReplacementPlan[];
  message: string;
  failedChanges?: ReplacementPlan[];
}

export interface PreviewResponse {
  replacementPlan: ReplacementPlan[];
  totalMatches: number;
  estimatedChanges: number;
  warnings?: string[];
}

// UI Types
export interface HistoryItem {
  id: string;
  action: string;
  timestamp: string;
  status: 'success' | 'info' | 'warning' | 'error';
  details?: string;
  changesCount?: number;
  userId?: string;
}

export interface Tab {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// Configuration Types
export interface AppConfig {
  apiBaseUrl: string;
  maxSearchResults: number;
  maxPreviewItems: number;
  supportedLocales: string[];
  supportedContentTypes: string[];
  features: {
    caseSensitive: boolean;
    regexSupport: boolean;
    batchProcessing: boolean;
    undoSupport: boolean;
  };
}

// Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// Search Options
export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  includeArchived: boolean;
  maxResults: number;
}

// Replace Options
export interface ReplaceOptions {
  caseSensitive: boolean;
  replaceMode: 'all' | 'first' | 'last';
  dryRun: boolean;
  backup: boolean;
  notify: boolean;
}
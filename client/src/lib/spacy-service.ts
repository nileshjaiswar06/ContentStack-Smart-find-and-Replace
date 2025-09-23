// Spacy Service API Integration
// Direct integration with the spacy-service running on port 8001

const SPACY_SERVICE_BASE = process.env.NEXT_PUBLIC_SPACY_SERVICE_URL || 'http://localhost:8001';

export interface SpacyEntity {
  text: string;
  label: string;
  start: number;
  end: number;
  confidence: number;
}

export interface SpacyNERResult {
  entities: SpacyEntity[];
  model_used: string;
  processing_time_ms: number;
  text_length: number;
  entity_count: number;
}

export interface SpacyBatchResult {
  results: SpacyNERResult[];
  total_processing_time_ms: number;
  batch_size: number;
}

export interface SpacyHealthResponse {
  status: string;
  available_models: string[];
  timestamp: number;
}

export interface SpacyLabelsResponse {
  labels: string[];
  description: Record<string, string>;
}

export interface SpacyMetricsResponse {
  // Prometheus metrics format
  [key: string]: string;
}

export interface SpacyRequestOptions {
  model?: string;
  min_confidence?: number;
  environment?: string;
  branch?: string;
}

class SpacyServiceClient {
  private baseUrl: string;

  constructor(baseUrl: string = SPACY_SERVICE_BASE) {
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
      throw new Error(`Spacy Service Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Health check
  async healthCheck(environment = 'development', branch = 'main'): Promise<SpacyHealthResponse> {
    return this.request(`/health?environment=${environment}&branch=${branch}`);
  }

  // Get available labels
  async getLabels(environment = 'development', branch = 'main'): Promise<SpacyLabelsResponse> {
    return this.request(`/labels?environment=${environment}&branch=${branch}`);
  }

  // Get metrics
  async getMetrics(environment = 'development', branch = 'main'): Promise<SpacyMetricsResponse> {
    const response = await fetch(`${this.baseUrl}/metrics?environment=${environment}&branch=${branch}`);
    const text = await response.text();
    return { metrics: text } as SpacyMetricsResponse;
  }

  // Extract entities from single text
  async extractEntities(
    text: string,
    options: SpacyRequestOptions = {}
  ): Promise<SpacyNERResult> {
    const {
      model = 'en_core_web_trf',
      min_confidence = 0.7,
      environment = 'development',
      branch = 'main'
    } = options;

    return this.request(`/ner?environment=${environment}&branch=${branch}`, {
      method: 'POST',
      body: JSON.stringify({
        text,
        model,
        min_confidence
      }),
    });
  }

  // Extract entities from multiple texts
  async extractEntitiesBatch(
    texts: string[],
    options: SpacyRequestOptions = {}
  ): Promise<SpacyBatchResult> {
    const {
      model = 'en_core_web_trf',
      min_confidence = 0.7,
      environment = 'development',
      branch = 'main'
    } = options;

    return this.request(`/ner/batch?environment=${environment}&branch=${branch}`, {
      method: 'POST',
      body: JSON.stringify({
        texts,
        model,
        min_confidence
      }),
    });
  }

  // Report metrics (for monitoring)
  async reportMetrics(
    metrics: Record<string, unknown>,
    environment = 'development',
    branch = 'main'
  ): Promise<void> {
    await this.request(`/metrics/report?environment=${environment}&branch=${branch}`, {
      method: 'POST',
      body: JSON.stringify(metrics),
    });
  }

  // Check if service is available
  async isAvailable(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }

  // Get service status with detailed info
  async getServiceStatus(environment = 'development', branch = 'main') {
    try {
      const [health, labels] = await Promise.all([
        this.healthCheck(environment, branch),
        this.getLabels(environment, branch)
      ]);

      return {
        available: true,
        health,
        labels,
        models: health.available_models,
        supportedLabels: labels.labels
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Create singleton instance
export const spacyService = new SpacyServiceClient();

// Export types for use in components
export type {
  SpacyEntity,
  SpacyNERResult,
  SpacyBatchResult,
  SpacyHealthResponse,
  SpacyLabelsResponse,
  SpacyRequestOptions
};

export default spacyService;
import axios, { type AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import opossum from 'opossum';
import pino from 'pino';
import { randomUUID } from 'crypto';

// pino's types can sometimes be incompatible with certain TS configs; cast to any to instantiate safely
const log = (pino as any)({ level: process.env.LOG_LEVEL || 'info', base: { service: 'ner-proxy' } });

const SPACY_URL = process.env.SPACY_SERVICE_URL || 'http://localhost:8001';
const SPACY_API_KEY = process.env.SPACY_API_KEY || undefined;

// Circuit breaker state
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: Number(process.env.NER_CIRCUIT_BREAKER_FAILURES || 5),
  recoveryTimeout: Number(process.env.NER_CIRCUIT_BREAKER_TIMEOUT || 30000), // 30 seconds
  successThreshold: Number(process.env.NER_CIRCUIT_BREAKER_SUCCESS || 3) // 3 successes to close
};

export type NerEntity = {
  text: string;
  label: string;
  start: number;
  end: number;
  confidence: number;
};

export type NerResponse = {
  entities: NerEntity[];
  model_used: string;
  processing_time_ms: number;
  text_length: number;
  entity_count: number;
};

export type NerHealth = {
  healthy: boolean;
  latency?: number;
  error?: string;
  details?: any;
};

// Create axios instance with retry configuration
const nerAxios: AxiosInstance = axios.create({
  baseURL: SPACY_URL,
  timeout: Number(process.env.NER_TIMEOUT_MS || 10000), // 10 second timeout
  ...(SPACY_API_KEY && { headers: { 'x-api-key': SPACY_API_KEY } })
});

// Configure axios-retry
axiosRetry(nerAxios, {
  retries: Number(process.env.NER_RETRY_COUNT || 3),
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors, 5xx errors, and specific 4xx errors
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           (error.response?.status && error.response.status >= 500) ||
           (error.response?.status === 429); // Rate limited
  },
  onRetry: (retryCount, error, requestConfig) => {
    log.warn({ retryCount, url: requestConfig.url, method: requestConfig.method }, 
      `NER request retry: ${error?.message}`);
  }
});
// Use opossum for circuit breaker
const breakerOptions = {
  timeout: Number(process.env.NER_TIMEOUT_MS || 10000),
  errorThresholdPercentage: 50, // Open circuit when 50% of requests fail
  resetTimeout: Number(process.env.NER_CIRCUIT_BREAKER_TIMEOUT || 30000)
};

// Define the action that sends to spaCy
async function callSpaCy(opts: { path: string; payload?: any; requestId?: string }) {
  const headers: Record<string, string> = {};
  if (opts.requestId) headers['x-request-id'] = opts.requestId;

  try {
    log.debug({ requestId: opts.requestId, path: opts.path, baseURL: SPACY_URL, hasPayload: !!opts.payload }, 'Calling spaCy service');
    
    if (opts.path.endsWith('/health')) {
      const response = await nerAxios.get(opts.path, { headers });
      log.debug({ requestId: opts.requestId, path: opts.path, status: response.status }, 'spaCy health check successful');
      return response;
    }
    
    const response = await nerAxios.post(opts.path, opts.payload, { headers });
    log.debug({ requestId: opts.requestId, path: opts.path, status: response.status, dataSize: JSON.stringify(response.data).length }, 'spaCy POST successful');
    return response;
  } catch (error: any) {
    log.error({ 
      requestId: opts.requestId, 
      path: opts.path, 
      baseURL: SPACY_URL,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: error?.code,
      errorStatus: error?.response?.status,
      errorData: error?.response?.data
    }, 'spaCy service call failed');
    throw error;
  }
}

const breaker = new opossum((opts: { path: string; payload?: any; requestId?: string }) => callSpaCy(opts), breakerOptions);

breaker.on('open', () => log.error('opossum: circuit opened - spaCy service calls will be rejected'));
breaker.on('halfOpen', () => log.warn('opossum: circuit half-open - testing spaCy service'));
breaker.on('close', () => log.info('opossum: circuit closed - spaCy service is healthy'));
breaker.on('fallback', () => log.warn('opossum: fallback invoked - spaCy service unavailable'));
breaker.on('reject', () => log.warn('opossum: breaker rejected request - circuit is open'));
breaker.on('timeout', () => log.warn('opossum: breaker timeout - spaCy service too slow'));
breaker.on('failure', (error) => log.error({ error: error instanceof Error ? error.message : String(error) }, 'opossum: request failed'));
breaker.on('success', () => log.debug('opossum: request succeeded'));

// Report circuit breaker state to the spaCy service so it can expose a Prometheus metric
async function reportCircuitStateToSpaCy(event?: string) {
  try {
    const payload = {
      event: event || 'state',
      state: getCircuitBreakerState(),
      timestamp: Date.now()
    };

    // fire-and-forget, but log failures
    nerAxios.post('/metrics/report', payload).catch((err) => {
      log.debug({ err: err instanceof Error ? err.message : String(err) }, 'Failed to report circuit state to spaCy');
    });
  } catch (err: any) {
    log.debug({ err: err instanceof Error ? err.message : String(err) }, 'Error preparing circuit state report');
  }
}

// Hook reporting into breaker lifecycle events
breaker.on('open', () => void reportCircuitStateToSpaCy('open'));
breaker.on('halfOpen', () => void reportCircuitStateToSpaCy('halfOpen'));
breaker.on('close', () => void reportCircuitStateToSpaCy('close'));

export async function extractEntities(text: string, model = 'en_core_web_trf', min_confidence = 0.5, requestId?: string): Promise<NerResponse> {
  const rid = requestId ?? randomUUID();
  const startTime = Date.now();
  try {
    log.info({ requestId: rid, textLength: text.length, model, spacyUrl: SPACY_URL }, 'Starting NER extraction call to spaCy service');
    const response = await breaker.fire({ path: '/ner', payload: { text, model, min_confidence, request_id: rid }, requestId: rid });
    const data = response.data as NerResponse;
    const latency = Date.now() - startTime;
    log.info({ requestId: rid, textLength: text.length, modelUsed: data.model_used, latency, entityCount: data.entity_count }, 'NER extraction successful from spaCy');
    return data;
  } catch (error: any) {
    const latency = Date.now() - startTime;
    const errorDetails = {
      requestId: rid,
      textLength: text.length,
      model,
      latency,
      spacyUrl: SPACY_URL,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: error?.code,
      errorStatus: error?.response?.status,
      errorData: error?.response?.data,
      circuitBreakerOpen: (breaker as any).opened || false,
      stackTrace: error instanceof Error ? error.stack : undefined
    };
    log.error(errorDetails, 'NER extraction failed - detailed error info');
    throw error;
  }
}

export async function extractEntitiesBatch(texts: string[], model = 'en_core_web_trf', min_confidence = 0.5, requestId?: string) {
  const rid = requestId ?? randomUUID();
  const startTime = Date.now();
  try {
    log.debug({ requestId: rid, batchSize: texts.length, model }, 'Starting NER batch extraction');
    const response = await breaker.fire({ path: '/ner/batch', payload: { texts, model, min_confidence, request_id: rid }, requestId: rid });
    const data = response.data as { results: NerResponse[]; total_processing_time_ms: number; batch_size: number };
    const latency = Date.now() - startTime;
    const totalEntities = data.results.reduce((sum, result) => sum + (result.entity_count || 0), 0);
    log.debug({ requestId: rid, batchSize: data.batch_size, totalEntities, latency, avgLatencyPerText: latency / Math.max(1, data.batch_size) }, 'NER batch extraction successful');
    return data;
  } catch (error: any) {
    const latency = Date.now() - startTime;
    log.error({ requestId: rid, batchSize: texts.length, model, latency, error: error instanceof Error ? error.message : String(error) }, 'NER batch extraction failed');
    throw error;
  }
}

// Health check function for monitoring
export async function checkNerHealth(): Promise<NerHealth> {
  try {
    const startTime = Date.now();
    const res = await breaker.fire({ path: '/health' });
    const latency = Date.now() - startTime;
  return { healthy: true, latency, details: res.data };
  } catch (error: any) {
  return { healthy: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Export circuit breaker state for monitoring
export function getCircuitBreakerState() {
  return {
    open: (breaker as any).opened || false,
    pending: (breaker as any).pending || 0,
    stats: (breaker as any).stats || {},
    config: CIRCUIT_BREAKER_CONFIG
  };
}

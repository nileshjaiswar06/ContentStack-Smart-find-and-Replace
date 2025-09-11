import axios, { type AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { logger } from '../utils/logger.js';

const SPACY_URL = process.env.SPACY_SERVICE_URL || 'http://localhost:8000';
const SPACY_API_KEY = process.env.SPACY_API_KEY || undefined;

// Circuit breaker state
let circuitBreakerState = {
  isOpen: false,
  failures: 0,
  lastFailureTime: 0,
  successCount: 0
};

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
    logger.warn(`NER request retry ${retryCount}: ${error.message}`, {
      url: requestConfig.url,
      method: requestConfig.method
    });
  }
});

// Circuit breaker logic
function checkCircuitBreaker(): void {
  const now = Date.now();
  
  if (circuitBreakerState.isOpen) {
    // Check if recovery timeout has passed
    if (now - circuitBreakerState.lastFailureTime > CIRCUIT_BREAKER_CONFIG.recoveryTimeout) {
      logger.info('Circuit breaker transitioning to half-open state');
      circuitBreakerState.isOpen = false;
      circuitBreakerState.successCount = 0;
    } else {
      throw new Error('Circuit breaker is open - spaCy service unavailable');
    }
  }
}

function recordSuccess(): void {
  circuitBreakerState.failures = 0;
  circuitBreakerState.successCount++;
  
  // If we were in half-open state and got enough successes, fully close the circuit
  if (circuitBreakerState.successCount >= CIRCUIT_BREAKER_CONFIG.successThreshold) {
    logger.info('Circuit breaker closed - spaCy service healthy');
    circuitBreakerState.successCount = 0;
  }
}

function recordFailure(): void {
  circuitBreakerState.failures++;
  circuitBreakerState.lastFailureTime = Date.now();
  circuitBreakerState.successCount = 0;
  
  if (circuitBreakerState.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    circuitBreakerState.isOpen = true;
    logger.error(`Circuit breaker opened after ${circuitBreakerState.failures} failures`);
  }
}

export async function extractEntities(text: string, model = 'en_core_web_sm', min_confidence = 0.5): Promise<NerResponse> {
  checkCircuitBreaker();
  
  const startTime = Date.now();
  try {
    const response = await nerAxios.post('/ner', { text, model, min_confidence });
    const data = response.data as NerResponse;
    
    recordSuccess();
    
    const latency = Date.now() - startTime;
    logger.debug(`NER extraction successful: ${data.entity_count} entities in ${latency}ms using ${data.model_used}`, {
      textLength: text.length,
      modelUsed: data.model_used,
      latency,
      entityCount: data.entity_count
    });
    
    return data;
  } catch (error) {
    recordFailure();
    
    const latency = Date.now() - startTime;
    logger.error(`NER extraction failed after ${latency}ms: ${error}`, {
      textLength: text.length,
      model,
      latency,
      error: error instanceof Error ? error.message : String(error)
    });
    
    throw error;
  }
}

export async function extractEntitiesBatch(texts: string[], model = 'en_core_web_sm', min_confidence = 0.5) {
  checkCircuitBreaker();
  
  const startTime = Date.now();
  try {
    const response = await nerAxios.post('/ner/batch', { texts, model, min_confidence });
    const data = response.data as { results: NerResponse[]; total_processing_time_ms: number; batch_size: number };
    
    recordSuccess();
    
    const latency = Date.now() - startTime;
    const totalEntities = data.results.reduce((sum, result) => sum + (result.entity_count || 0), 0);
    
    logger.debug(`NER batch extraction successful: ${totalEntities} entities across ${data.batch_size} texts in ${latency}ms`, {
      batchSize: data.batch_size,
      totalEntities,
      latency,
      avgLatencyPerText: latency / data.batch_size
    });
    
    return data;
  } catch (error) {
    recordFailure();
    
    const latency = Date.now() - startTime;
    logger.error(`NER batch extraction failed after ${latency}ms: ${error}`, {
      batchSize: texts.length,
      model,
      latency,
      error: error instanceof Error ? error.message : String(error)
    });
    
    throw error;
  }
}

// Health check function for monitoring
export async function checkNerHealth(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  try {
    checkCircuitBreaker();
    
    const startTime = Date.now();
    await nerAxios.get('/health');
    const latency = Date.now() - startTime;
    
    return { healthy: true, latency };
  } catch (error) {
    return { 
      healthy: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Export circuit breaker state for monitoring
export function getCircuitBreakerState() {
  return {
    ...circuitBreakerState,
    config: CIRCUIT_BREAKER_CONFIG
  };
}

import { logger } from "../utils/logger.js";

export interface SuggestionConfig {
  // Confidence thresholds for different sources
  thresholds: {
    ai: number;
    contextual: number;
    heuristic: number;
    brandkit: number;
    minimum: number; // Absolute minimum to show suggestion
  };
  
  // Source priority weights (higher = more important)
  sourcePriority: {
    ai: number;
    contextual: number;
    heuristic: number;
    brandkit: number;
  };
  
  // Auto-apply thresholds (higher confidence suggestions can be auto-applied)
  autoApplyThresholds: {
    ai: number;
    contextual: number;
    heuristic: number;
    brandkit: number;
  };
  
  // Maximum suggestions per source
  maxSuggestions: {
    ai: number;
    contextual: number;
    heuristic: number;
    brandkit: number;
    total: number;
  };
  
  // Domain-specific multipliers
  domainMultipliers: {
    email: number;
    version: number;
    url: number;
    brand: number;
    product: number;
    contact: number;
  };
}

// Default configuration - can be overridden by environment variables
const DEFAULT_CONFIG: SuggestionConfig = {
  thresholds: {
    ai: 0.7,
    contextual: 0.6,
    heuristic: 0.4,
    brandkit: 0.8,
    minimum: 0.3
  },
  sourcePriority: {
    ai: 4,
    contextual: 3,
    heuristic: 1,
    brandkit: 5 // Highest priority for brand consistency
  },
  autoApplyThresholds: {
    ai: 0.9,
    contextual: 0.85,
    heuristic: 0.8,
    brandkit: 0.9
  },
  maxSuggestions: {
    ai: 5,
    contextual: 3,
    heuristic: 10,
    brandkit: 8,
    total: 15
  },
  domainMultipliers: {
    email: 1.2,    // Email updates are important
    version: 1.1,   // Version bumps are common
    url: 1.3,      // URL updates are critical
    brand: 1.5,    // Brand consistency is crucial
    product: 1.4,  // Product name accuracy matters
    contact: 1.2   // Contact info should be current
  }
};

// Load configuration from environment variables with fallbacks
function loadConfigFromEnv(): SuggestionConfig {
  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  
  // Load thresholds
  config.thresholds.ai = parseFloat(process.env.SUGGESTION_THRESHOLD_AI || String(DEFAULT_CONFIG.thresholds.ai));

  config.thresholds.contextual = parseFloat(process.env.SUGGESTION_THRESHOLD_CONTEXTUAL || String(DEFAULT_CONFIG.thresholds.contextual));

  config.thresholds.heuristic = parseFloat(process.env.SUGGESTION_THRESHOLD_HEURISTIC || String(DEFAULT_CONFIG.thresholds.heuristic));

  config.thresholds.brandkit = parseFloat(process.env.SUGGESTION_THRESHOLD_BRANDKIT || String(DEFAULT_CONFIG.thresholds.brandkit));
  
  config.thresholds.minimum = parseFloat(process.env.SUGGESTION_THRESHOLD_MINIMUM || String(DEFAULT_CONFIG.thresholds.minimum));
  
  // Load source priorities
  config.sourcePriority.ai = parseInt(process.env.SUGGESTION_PRIORITY_AI || String(DEFAULT_CONFIG.sourcePriority.ai));

  config.sourcePriority.contextual = parseInt(process.env.SUGGESTION_PRIORITY_CONTEXTUAL || String(DEFAULT_CONFIG.sourcePriority.contextual));

  config.sourcePriority.heuristic = parseInt(process.env.SUGGESTION_PRIORITY_HEURISTIC || String(DEFAULT_CONFIG.sourcePriority.heuristic));

  config.sourcePriority.brandkit = parseInt(process.env.SUGGESTION_PRIORITY_BRANDKIT || String(DEFAULT_CONFIG.sourcePriority.brandkit));
  
  // Load auto-apply thresholds
  config.autoApplyThresholds.ai = parseFloat(process.env.SUGGESTION_AUTO_APPLY_AI || String(DEFAULT_CONFIG.autoApplyThresholds.ai));

  config.autoApplyThresholds.contextual = parseFloat(process.env.SUGGESTION_AUTO_APPLY_CONTEXTUAL || String(DEFAULT_CONFIG.autoApplyThresholds.contextual));

  config.autoApplyThresholds.heuristic = parseFloat(process.env.SUGGESTION_AUTO_APPLY_HEURISTIC || String(DEFAULT_CONFIG.autoApplyThresholds.heuristic));

  config.autoApplyThresholds.brandkit = parseFloat(process.env.SUGGESTION_AUTO_APPLY_BRANDKIT || String(DEFAULT_CONFIG.autoApplyThresholds.brandkit));
  
  // Load max suggestions
  config.maxSuggestions.total = parseInt(process.env.SUGGESTION_MAX_TOTAL || String(DEFAULT_CONFIG.maxSuggestions.total));
  
  // Validate configuration
  validateConfig(config);
  
  return config;
}

// Validate configuration values
function validateConfig(config: SuggestionConfig): void {
  const errors: string[] = [];
  
  // Validate thresholds are between 0 and 1
  Object.entries(config.thresholds).forEach(([key, value]) => {
    if (value < 0 || value > 1) {
      errors.push(`Threshold ${key} must be between 0 and 1, got ${value}`);
    }
  });
  
  // Validate auto-apply thresholds are higher than regular thresholds
  Object.keys(config.autoApplyThresholds).forEach(source => {
    const autoThreshold = config.autoApplyThresholds[source as keyof typeof config.autoApplyThresholds];

    const regularThreshold = config.thresholds[source as keyof typeof config.thresholds];

    if (autoThreshold < regularThreshold) {
      errors.push(`Auto-apply threshold for ${source} (${autoThreshold}) must be >= regular threshold (${regularThreshold})`);
    }
  });
  
  // Validate max suggestions are positive
  Object.entries(config.maxSuggestions).forEach(([key, value]) => {
    if (value <= 0) {
      errors.push(`Max suggestions ${key} must be positive, got ${value}`);
    }
  });
  
  if (errors.length > 0) {
    logger.error("Invalid suggestion configuration", { errors });
    throw new Error(`Invalid suggestion configuration: ${errors.join(', ')}`);
  }
}

// Get the current suggestion configuration
export function getSuggestionConfig(): SuggestionConfig {
  return loadConfigFromEnv();
}

// Check if a suggestion meets the minimum threshold for its source
export function meetsThreshold(suggestion: { confidence: number; source?: string }): boolean {
  const config = getSuggestionConfig();
  const source = suggestion.source as keyof typeof config.thresholds || 'heuristic';
  const threshold = config.thresholds[source] || config.thresholds.minimum;
  return suggestion.confidence >= threshold;
}

// Check if a suggestion can be auto-applied
export function canAutoApply(suggestion: { confidence: number; source?: string }): boolean {
  const config = getSuggestionConfig();
  const source = suggestion.source as keyof typeof config.autoApplyThresholds || 'heuristic';
  const threshold = config.autoApplyThresholds[source];
  return suggestion.confidence >= threshold;
}

// Calculate adjusted confidence based on domain type
export function adjustConfidenceForDomain(
  confidence: number, 
  entityType: string, 
  context?: string
): number {
  const config = getSuggestionConfig();
  const domainType = mapEntityTypeToDomain(entityType, context);
  const multiplier = config.domainMultipliers[domainType] || 1.0;
  
  // Apply multiplier but cap at 1.0
  return Math.min(confidence * multiplier, 1.0);
}

// Map entity type to domain category
function mapEntityTypeToDomain(entityType: string, context?: string): keyof SuggestionConfig['domainMultipliers'] {
  const type = entityType.toLowerCase();
  const ctx = context?.toLowerCase() || '';
  
  if (type.includes('email') || ctx.includes('contact')) return 'email';
  if (type.includes('version') || ctx.includes('version')) return 'version';
  if (type.includes('url') || type.includes('link')) return 'url';
  if (type.includes('brand') || ctx.includes('brand')) return 'brand';
  if (type.includes('product') || ctx.includes('product')) return 'product';
  if (type.includes('contact') || type.includes('phone')) return 'contact';
  
  return 'product'; // Default fallback
}

// Get source priority for sorting

export function getSourcePriority(source?: string): number {
  const config = getSuggestionConfig();
  return config.sourcePriority[source as keyof typeof config.sourcePriority] || config.sourcePriority.heuristic;
}

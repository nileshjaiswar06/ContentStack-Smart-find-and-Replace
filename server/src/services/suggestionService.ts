import { 
  extractNamedEntitiesFromText, 
  processSpaCyEntities, 
  mergeEntities,
  type NamedEntity 
} from "./nerService.js";
import { extractEntities } from "./nerProxy.js";
import { askAIForSuggestions, generateContextualReplacements, isAiServiceAvailable } from "./aiService.js";
import { generateBrandkitSuggestions, type BrandkitSuggestion } from "./brandkitService.js";
import { 
  getSuggestionConfig, 
  meetsThreshold, 
  adjustConfidenceForDomain, 
  getSourcePriority 
} from "../config/suggestionConfig.js";
import { scoringService, type ScoringMetrics } from "./scoringService.js";
import { adaptiveDomainService, type DomainContext } from "./adaptiveDomainService.js";
import { performanceOptimizationService } from "./performanceOptimizationService.js";
import { dynamicConfigurationService } from "./dynamicConfigurationService.js";
import { feedbackLearningService } from "./feedbackLearningService.js";
import { logger } from "../utils/logger.js";

export type ReplacementSuggestion = {
  entity: NamedEntity;
  suggestedReplacement: string;
  confidence: number;
  reason?: string;
  source?: "heuristic" | "ai" | "brandkit" | "contextual";
  context?: string;
  relevanceScore?: number; // Combined ranking score
  domainAdjustedConfidence?: number; // Confidence after domain adjustments
  autoApply?: boolean; // Whether this suggestion can be auto-applied
  scoringMetrics?: ScoringMetrics; // Detailed scoring breakdown
  scoreExplanation?: string[]; // Human-readable scoring explanation
  domainContext?: DomainContext; // Domain-specific context
  suggestionId?: string; // Unique ID for feedback tracking
};


 // Enhanced entity extraction using both spaCy and compromise with canonical mapping
async function extractEntitiesWithCanonicalMapping(
  text: string, 
  requestId?: string
): Promise<NamedEntity[]> {
  try {
    // Try spaCy first for high accuracy
    const spacyResponse = await extractEntities(text, 'en_core_web_sm', 0.5, requestId);
    const spacyEntities = processSpaCyEntities(spacyResponse.entities, text);
    
    // Fallback to compromise for additional coverage
    const compromiseEntities = extractNamedEntitiesFromText(text);
    
    // Merge and deduplicate entities
    const mergedEntities = mergeEntities(spacyEntities, compromiseEntities);
    
    logger.info("Enhanced NER extraction completed", {
      requestId,
      textLength: text.length,
      spacyCount: spacyEntities.length,
      compromiseCount: compromiseEntities.length,
      mergedCount: mergedEntities.length,
      spacyProcessingTime: spacyResponse.processing_time_ms
    });
    
    return mergedEntities;
  } catch (error: any) {
    logger.warn("spaCy NER failed, falling back to compromise only", {
      requestId,
      error: error.message,
      textLength: text.length
    });
    
    // Fallback to compromise only
    return extractNamedEntitiesFromText(text);
  }
}


// Record user feedback for a suggestion to improve future recommendations
export async function recordSuggestionFeedback(
  suggestionId: string,
  suggestion: ReplacementSuggestion,
  feedback: {
    action: 'accept' | 'reject' | 'modify' | 'ignore' | 'undo';
    userId?: string;
    modifiedText?: string;
    sessionId?: string;
    context?: {
      contentTypeUid?: string;
      entryUid?: string;
    };
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    const feedbackData: any = {
      suggestionId,
      action: feedback.action,
      suggestion
    };

    // Only include optional properties if they have values
    if (feedback.userId) feedbackData.userId = feedback.userId;
    if (feedback.modifiedText) feedbackData.modifiedText = feedback.modifiedText;
    if (feedback.sessionId) feedbackData.sessionId = feedback.sessionId;
    if (feedback.context?.contentTypeUid) feedbackData.contentTypeUid = feedback.context.contentTypeUid;
    if (feedback.context?.entryUid) feedbackData.entryUid = feedback.context.entryUid;
    if (feedback.metadata) feedbackData.metadata = feedback.metadata;

    await feedbackLearningService.recordFeedback(feedbackData);

    logger.info("Suggestion feedback recorded", {
      suggestionId,
      action: feedback.action,
      userId: feedback.userId
    });
  } catch (error: any) {
    logger.error("Failed to record suggestion feedback", {
      suggestionId,
      error: error.message
    });
  }
}

export async function suggestReplacementsForText(
  text: string,
  context?: {
    contentTypeUid?: string;
    entryUid?: string;
    userId?: string;
    replacementRule?: {
      find: string;
      replace: string;
      mode?: string;
    };
    preferredBrands?: string[];
  },
  requestId?: string
): Promise<ReplacementSuggestion[]> {
  // Use dynamic configuration based on request context
  const config = dynamicConfigurationService.getConfigForRequest({
    userId: context?.userId,
    sessionId: requestId
  });
  
  // Use performance optimization service for caching and parallel processing
  return await performanceOptimizationService.optimizedSuggestReplacements(
    async (text: string, context: any, requestId?: string) => {
      return await generateSuggestionsCore(text, context, requestId, config);
    },
    text,
    context,
    requestId
  );
}

async function generateSuggestionsCore(
  text: string,
  context: any,
  requestId: string | undefined,
  config: any
): Promise<ReplacementSuggestion[]> {
  const startTime = Date.now();
  
  logger.info("Generating replacement suggestions with advanced processing", {
    requestId,
    textLength: text.length,
    context: context?.contentTypeUid,
    userId: context?.userId,
    config: {
      maxTotal: config.maxSuggestions.total,
      minThreshold: config.thresholds.minimum
    }
  });

  // 1) Domain detection and mapping
  const domainContext = adaptiveDomainService.detectAndMapDomains(text, {
    ...(context?.contentTypeUid && { contentTypeUid: context.contentTypeUid }),
    ...(context?.entryUid && { entryUid: context.entryUid }),
    ...(context?.userId && { metadata: { userId: context.userId } })
  });

  // Auto-detect new domains if needed
  const detectedNewDomains = adaptiveDomainService.autoDetectNewDomains([], context);
  if (detectedNewDomains.length > 0) {
    logger.info("New domains detected during processing", { 
      requestId, 
      newDomains: detectedNewDomains 
    });
  }

  // 2) Enhanced Named Entity Recognition
  const entities = await extractEntitiesWithCanonicalMapping(text, requestId);
  const suggestions: ReplacementSuggestion[] = [];

  // 3) Generate heuristic suggestions with domain-aware processing
  for (const entity of entities) {
    const heuristicSuggestion = await generateHeuristicSuggestion(entity, domainContext);
    if (heuristicSuggestion && meetsThreshold(heuristicSuggestion)) {
      suggestions.push(heuristicSuggestion);
    }
  }

  // 4) Generate brandkit suggestions
  try {
    const brandkitResults = await generateBrandkitSuggestions(text, {
      ...(context?.contentTypeUid && { contentTypeUid: context.contentTypeUid }),
      ...(context?.entryUid && { entryUid: context.entryUid }),
      ...(context?.preferredBrands && { preferredBrands: context.preferredBrands })
    }, requestId);

    logger.info("Brandkit suggestions received", { 
      requestId,
      count: brandkitResults.length 
    });

    // Convert brandkit suggestions with advanced processing
    for (const brandkit of brandkitResults.slice(0, config.maxSuggestions.brandkit)) {
      const suggestion = await createBrandkitSuggestion(brandkit, domainContext);
      if (meetsThreshold(suggestion)) {
        suggestions.push(suggestion);
      }
    }
  } catch (err: any) {
    logger.debug("Brandkit suggestions failed", { 
      requestId,
      err: err?.message ?? String(err) 
    });
  }

  // 5) Generate AI suggestions with contextual awareness
  if (isAiServiceAvailable()) {
    try {
      const aiResults = await askAIForSuggestions(text, {
        ...(context?.contentTypeUid && { contentTypeUid: context.contentTypeUid }),
        ...(context?.entryUid && { entryUid: context.entryUid }),
        sampleEntityCount: entities.length,
        ...(context?.replacementRule && { replacementRule: context.replacementRule })
      }, requestId);

      if (Array.isArray(aiResults) && aiResults.length > 0) {
        logger.info("AI suggestions received", { 
          requestId,
          count: aiResults.length,
          textLength: text.length 
        });

        for (const ai of aiResults.slice(0, config.maxSuggestions.ai)) {
          const suggestion = await createAISuggestion(ai, entities, domainContext);
          if (meetsThreshold(suggestion)) {
            const existingIndex = suggestions.findIndex(s => s.entity.text === ai.originalText);
            if (existingIndex >= 0) {
              suggestions[existingIndex] = suggestion;
            } else {
              suggestions.push(suggestion);
            }
          }
        }
      }
    } catch (err: any) {
      logger.debug("AI suggestions failed or not configured", { 
        requestId,
        err: err?.message ?? String(err),
        textLength: text.length 
      });
    }
  }

  // 6) Generate contextual replacements
  if (context?.replacementRule && isAiServiceAvailable()) {
    try {
      const contextualResults = await generateContextualReplacements(
        context.replacementRule.find,
        context.replacementRule.replace,
        {
          ...(context.contentTypeUid && { contentTypeUid: context.contentTypeUid }),
          ...(context.entryUid && { entryUid: context.entryUid }),
          surroundingText: text.substring(0, 200)
        }
      );

      if (contextualResults.length > 0) {
        logger.info("Contextual replacements generated", { 
          requestId,
          count: contextualResults.length 
        });

        for (const contextual of contextualResults.slice(0, config.maxSuggestions.contextual)) {
          const suggestion = await createContextualSuggestion(contextual, domainContext);
          if (meetsThreshold(suggestion)) {
            suggestions.push(suggestion);
          }
        }
      }
    } catch (err: any) {
      logger.debug("Contextual replacement generation failed", { 
        requestId,
        err: err?.message ?? String(err) 
      });
    }
  }

  // 7) Advanced ranking and scoring
  const extendedContext = {
    ...context,
    originalText: text,
    domainContext,
    previousSuggestions: suggestions
  };

  const rankedSuggestions = scoringService.rankSuggestions(suggestions, text, extendedContext);
  
  // 8) Apply final limits and filtering
  const finalSuggestions = rankedSuggestions.slice(0, config.maxSuggestions.total);
  
  const endTime = Date.now();
  const processingTime = endTime - startTime;

  logger.info("Advanced suggestions generation completed", {
    requestId,
    totalProcessed: suggestions.length,
    finalCount: finalSuggestions.length,
    processingTime,
    averageConfidence: finalSuggestions.reduce((sum, s) => sum + s.confidence, 0) / finalSuggestions.length,
    averageRelevanceScore: finalSuggestions.reduce((sum, s) => sum + (s.relevanceScore || 0), 0) / finalSuggestions.length,
    sourceBreakdown: getSourceBreakdown(finalSuggestions),
    domainContext: {
      industry: domainContext.industry,
      detectedDomains: detectedNewDomains
    }
  });

  return finalSuggestions;
}

// Calculate relevance scores and rank suggestions using sophisticated algorithm
function calculateRelevanceAndRank(
  suggestions: ReplacementSuggestion[],
  originalText: string,
  context?: {
    contentTypeUid?: string;
    entryUid?: string;
    replacementRule?: {
      find: string;
      replace: string;
      mode?: string;
    };
    preferredBrands?: string[];
  }
): ReplacementSuggestion[] {
  const config = getSuggestionConfig();
  
  return suggestions
    .map(suggestion => {
      // Ensure domainAdjustedConfidence is always present (fallback to confidence)
      const domainAdjustedConfidenceRaw = typeof suggestion.domainAdjustedConfidence === 'number'
        ? suggestion.domainAdjustedConfidence
        : adjustConfidenceForDomain(suggestion.confidence, suggestion.entity?.type || 'Other', suggestion.context);

      // Round to 2 decimal places
      const domainAdjustedConfidence = Math.round(domainAdjustedConfidenceRaw * 100) / 100;

      // Start with domain-adjusted confidence or original confidence
      const baseConfidence = domainAdjustedConfidence || suggestion.confidence || 0;

      // Factor 1: Source priority weight (0.0 - 1.0)
      const sourcePriority = getSourcePriority(suggestion.source);
      const maxPriority = Math.max(...Object.values(config.sourcePriority));
      const sourceWeight = maxPriority > 0 ? sourcePriority / maxPriority : 0;

      // Factor 2: Text similarity and context relevance (0.0 - 1.0)
      const textRelevance = calculateTextRelevance(suggestion, originalText, context);

      // Factor 3: Entity type importance (0.0 - 1.0)
      const entityWeight = calculateEntityTypeWeight(suggestion.entity?.type || 'Other');

      // Factor 4: Context alignment (0.0 - 1.0)
      const contextAlignment = calculateContextAlignment(suggestion, context);

      // Combined relevance score using weighted average
      let relevanceScoreRaw = (
        baseConfidence * 0.4 +           // 40% confidence
        sourceWeight * 0.25 +            // 25% source priority
        textRelevance * 0.20 +           // 20% text relevance
        entityWeight * 0.10 +            // 10% entity importance
        contextAlignment * 0.05          // 5% context alignment
      );

      // Clamp and round relevance score
      const relevanceScore = Math.round(Math.min(Math.max(relevanceScoreRaw, 0), 1) * 1000) / 1000;

      // Determine if suggestion can be auto-applied (explicit boolean)
      const autoApply = !!(baseConfidence >= (config.autoApplyThresholds[suggestion.source || 'heuristic'] || 1));

      return {
        ...suggestion,
        domainAdjustedConfidence,
        relevanceScore,
        autoApply
      };
    })
    .sort((a, b) => {
      // Primary sort: relevance score (descending)
      if (Math.abs(a.relevanceScore! - b.relevanceScore!) > 0.01) {
        return b.relevanceScore! - a.relevanceScore!;
      }
      
      // Secondary sort: confidence (descending)
      const aConf = a.domainAdjustedConfidence || a.confidence;
      const bConf = b.domainAdjustedConfidence || b.confidence;
      if (Math.abs(aConf - bConf) > 0.01) {
        return bConf - aConf;
      }
      
      // Tertiary sort: source priority (descending)
      const aPriority = getSourcePriority(a.source);
      const bPriority = getSourcePriority(b.source);
      return bPriority - aPriority;
    });
}

// Calculate text relevance based on similarity and context
function calculateTextRelevance(
  suggestion: ReplacementSuggestion,
  originalText: string,
  context?: any
): number {
  let relevance = 0.5; // Base relevance
  
  // Factor 1: Length similarity
  const originalLength = suggestion.entity.text.length;
  const replacementLength = suggestion.suggestedReplacement.length;
  const lengthRatio = Math.min(originalLength, replacementLength) / Math.max(originalLength, replacementLength);
  relevance += lengthRatio * 0.2;
  
  // Factor 2: Case preservation
  if (suggestion.entity.text.length > 0 && suggestion.suggestedReplacement.length > 0) {
    const entityFirst = suggestion.entity.text.charAt(0);
    const replacementFirst = suggestion.suggestedReplacement.charAt(0);
    if (entityFirst === entityFirst.toUpperCase() && replacementFirst === replacementFirst.toUpperCase()) {
      relevance += 0.1;
    }
  }
  
  // Factor 3: Context keyword matching
  if (context?.replacementRule) {
    const contextKeywords = [
      context.replacementRule.find.toLowerCase(),
      context.replacementRule.replace.toLowerCase()
    ];
    
    const suggestionText = suggestion.suggestedReplacement.toLowerCase();
    const hasContextMatch = contextKeywords.some(keyword => 
      suggestionText.includes(keyword) || keyword.includes(suggestionText)
    );
    
    if (hasContextMatch) {
      relevance += 0.2;
    }
  }
  
  // Factor 4: Text position importance (earlier text is more important)
  const textPosition = originalText.indexOf(suggestion.entity.text);
  if (textPosition >= 0) {
    const positionWeight = 1 - (textPosition / originalText.length);
    relevance += positionWeight * 0.1;
  }
  
  return Math.min(relevance, 1.0);
}

// Calculate entity type weight based on importance
function calculateEntityTypeWeight(entityType: string): number {
  const weights = {
    "Email": 0.9,
    "URL": 0.9,
    "Version": 0.8,
    "Organization": 0.8,
    "Person": 0.7,
    "Date": 0.6,
    "Place": 0.5,
    "Other": 0.4
  };
  
  return weights[entityType as keyof typeof weights] || 0.4;
}

// Calculate context alignment score
function calculateContextAlignment(
  suggestion: ReplacementSuggestion,
  context?: any
): number {
  let alignment = 0.5; // Base alignment
  
  // Boost for preferred brands
  if (context?.preferredBrands && suggestion.source === 'brandkit') {
    const suggestionLower = suggestion.suggestedReplacement.toLowerCase();
    const hasPreferredBrand = context.preferredBrands.some((brand: string) => 
      suggestionLower.includes(brand.toLowerCase())
    );
    
    if (hasPreferredBrand) {
      alignment += 0.3;
    }
  }
  
  // Content type specific boosts
  if (context?.contentTypeUid) {
    const contentType = context.contentTypeUid.toLowerCase();
    
    if (contentType.includes('product') && suggestion.entity.type === 'Other') {
      alignment += 0.2;
    }
    
    if (contentType.includes('contact') && suggestion.entity.type === 'Email') {
      alignment += 0.2;
    }
    
    if (contentType.includes('blog') && suggestion.source === 'ai') {
      alignment += 0.1;
    }
  }
  
  return Math.min(alignment, 1.0);
}

// Helper functions for creating enhanced suggestions

async function generateHeuristicSuggestion(
  entity: NamedEntity, 
  domainContext: DomainContext
): Promise<ReplacementSuggestion | null> {
  let suggestion: ReplacementSuggestion | null = null;

  if (entity.type === "Email") {
    suggestion = { 
      entity, 
      suggestedReplacement: "contact@yourcompany.com", 
      confidence: 0.6, 
      reason: "Suggest default contact pattern",
      source: "heuristic",
      context: "Email standardization",
      domainContext
    };
  } else if (entity.type === "Version") {
    const parts = entity.text.split(".").map((p) => Number(p));
    const [major, minor, patch] = parts;
    if (major !== undefined && minor !== undefined && !Number.isNaN(minor)) {
      const suggested = `${major}.${minor + 1}${patch !== undefined ? "." + patch : ""}`;
      suggestion = { 
        entity, 
        suggestedReplacement: suggested, 
        confidence: 0.5, 
        reason: "Suggest next minor version",
        source: "heuristic",
        context: "Version increment",
        domainContext
      };
    }
  } else if (entity.type === "URL") {
    if (entity.text.startsWith("http://")) {
      suggestion = { 
        entity, 
        suggestedReplacement: entity.text.replace(/^http:\/\//, "https://"), 
        confidence: 0.7, 
        reason: "Upgrade HTTP to HTTPS",
        source: "heuristic",
        context: "URL security upgrade",
        domainContext
      };
    }
  }

  if (suggestion) {
    // Apply domain adjustment
    const domainAdjustment = adaptiveDomainService.calculateDomainAdjustment(suggestion, domainContext);
    suggestion.domainAdjustedConfidence = Math.min(suggestion.confidence * domainAdjustment, 1.0);

    // Apply advanced scoring
    const scoring = scoringService.calculateAdvancedRelevanceScore(suggestion, entity.text, {});
    suggestion.relevanceScore = scoring.score;
    suggestion.scoringMetrics = scoring.metrics;
    suggestion.scoreExplanation = scoring.explanation;

    // Determine auto-apply
    const adaptiveThreshold = adaptiveDomainService.getAdaptiveThreshold(
      domainContext.industry || 'general', 
      entity.type
    );
    suggestion.autoApply = (suggestion.domainAdjustedConfidence || suggestion.confidence) >= adaptiveThreshold;
  }

  return suggestion;
}

async function createBrandkitSuggestion(
  brandkit: BrandkitSuggestion, 
  domainContext: DomainContext
): Promise<ReplacementSuggestion> {
  const suggestion: ReplacementSuggestion = {
    entity: { text: brandkit.originalText, type: "Other" } as NamedEntity,
    suggestedReplacement: brandkit.suggestedReplacement,
    confidence: brandkit.confidence,
    reason: brandkit.reason,
    source: "brandkit",
    context: brandkit.context,
    domainContext
  };

  // Apply domain adjustment
  const domainAdjustment = adaptiveDomainService.calculateDomainAdjustment(suggestion, domainContext);
  suggestion.domainAdjustedConfidence = Math.min(suggestion.confidence * domainAdjustment, 1.0);

  // Apply advanced scoring
  const scoring = scoringService.calculateAdvancedRelevanceScore(suggestion, brandkit.originalText, {});
  suggestion.relevanceScore = scoring.score;
  suggestion.scoringMetrics = scoring.metrics;
  suggestion.scoreExplanation = scoring.explanation;

  // Generate unique suggestion ID
  suggestion.suggestionId = `brandkit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Determine auto-apply
  const adaptiveThreshold = adaptiveDomainService.getAdaptiveThreshold(
    domainContext.industry || 'general', 
    'brand'
  );
  suggestion.autoApply = (suggestion.domainAdjustedConfidence || suggestion.confidence) >= adaptiveThreshold;

  return suggestion;
}

async function createAISuggestion(
  ai: { originalText: string; suggestedReplacement: string; confidence?: number; reason?: string; context?: string },
  entities: NamedEntity[],
  domainContext: DomainContext
): Promise<ReplacementSuggestion> {
  const match = entities.find(e => e.text === ai.originalText);
  const suggestion: ReplacementSuggestion = {
    entity: match || ({ text: ai.originalText, type: "Other" } as NamedEntity),
    suggestedReplacement: ai.suggestedReplacement,
    confidence: ai.confidence ?? 0.7,
    reason: ai.reason || "AI-generated suggestion",
    source: "ai",
    context: ai.context || "AI-generated suggestion",
    domainContext
  };

  // Apply domain adjustment
  const domainAdjustment = adaptiveDomainService.calculateDomainAdjustment(suggestion, domainContext);
  suggestion.domainAdjustedConfidence = Math.min(suggestion.confidence * domainAdjustment, 1.0);

  // Apply advanced scoring
  const scoring = scoringService.calculateAdvancedRelevanceScore(suggestion, ai.originalText, {});
  suggestion.relevanceScore = scoring.score;
  suggestion.scoringMetrics = scoring.metrics;
  suggestion.scoreExplanation = scoring.explanation;

  // Generate unique suggestion ID
  suggestion.suggestionId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Determine auto-apply
  const adaptiveThreshold = adaptiveDomainService.getAdaptiveThreshold(
    domainContext.industry || 'general', 
    suggestion.entity.type
  );
  suggestion.autoApply = (suggestion.domainAdjustedConfidence || suggestion.confidence) >= adaptiveThreshold;

  return suggestion;
}

async function createContextualSuggestion(
  contextual: { originalText: string; suggestedReplacement: string; confidence?: number; reason?: string; context?: string },
  domainContext: DomainContext
): Promise<ReplacementSuggestion> {
  const suggestion: ReplacementSuggestion = {
    entity: { text: contextual.originalText, type: "Other" } as NamedEntity,
    suggestedReplacement: contextual.suggestedReplacement,
    confidence: contextual.confidence ?? 0.6,
    reason: contextual.reason || "Contextual alternative",
    source: "contextual",
    context: contextual.context || "Contextual replacement",
    domainContext
  };

  // Apply domain adjustment
  const domainAdjustment = adaptiveDomainService.calculateDomainAdjustment(suggestion, domainContext);
  suggestion.domainAdjustedConfidence = Math.min(suggestion.confidence * domainAdjustment, 1.0);

  // Apply advanced scoring
  const scoring = scoringService.calculateAdvancedRelevanceScore(suggestion, contextual.originalText, {});
  suggestion.relevanceScore = scoring.score;
  suggestion.scoringMetrics = scoring.metrics;
  suggestion.scoreExplanation = scoring.explanation;

  // Generate unique suggestion ID
  suggestion.suggestionId = `contextual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Determine auto-apply
  const adaptiveThreshold = adaptiveDomainService.getAdaptiveThreshold(
    domainContext.industry || 'general', 
    'contextual'
  );
  suggestion.autoApply = (suggestion.domainAdjustedConfidence || suggestion.confidence) >= adaptiveThreshold;

  return suggestion;
}

// Get source breakdown for logging
function getSourceBreakdown(suggestions: ReplacementSuggestion[]): Record<string, number> {
  const breakdown: Record<string, number> = {};
  
  suggestions.forEach(s => {
    const source = s.source || 'heuristic';
    breakdown[source] = (breakdown[source] || 0) + 1;
  });
  
  return breakdown;
}

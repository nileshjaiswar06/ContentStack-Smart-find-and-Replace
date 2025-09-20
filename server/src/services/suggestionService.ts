import { extractNamedEntitiesFromText, type NamedEntity } from "./nerService.js";
import { askAIForSuggestions, generateContextualReplacements, isAiServiceAvailable } from "./aiService.js";
import { generateBrandkitSuggestions, type BrandkitSuggestion } from "./brandkitService.js";
import { 
  getSuggestionConfig, 
  meetsThreshold, 
  adjustConfidenceForDomain, 
  getSourcePriority 
} from "../config/suggestionConfig.js";
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
};

export async function suggestReplacementsForText(
  text: string,
  context?: {
    contentTypeUid?: string;
    entryUid?: string;
    replacementRule?: {
      find: string;
      replace: string;
      mode?: string;
    };
    preferredBrands?: string[];
  },
    requestId?: string
): Promise<ReplacementSuggestion[]> {
  const config = getSuggestionConfig();
  logger.info("Generating replacement suggestions", {
    requestId,
    textLength: text.length,
    context: context?.contentTypeUid,
    config: {
      maxTotal: config.maxSuggestions.total,
      minThreshold: config.thresholds.minimum
    }
  });

  // 1) First do lightweight NER-based heuristics
  const entities = extractNamedEntitiesFromText(text);
  const suggestions: ReplacementSuggestion[] = [];

  for (const entity of entities) {
    if (entity.type === "Email") {
      const suggestion: ReplacementSuggestion = { 
        entity, 
        suggestedReplacement: "contact@yourcompany.com", 
        confidence: 0.6, 
        reason: "Suggest default contact pattern",
        source: "heuristic",
        context: "Email standardization"
      };
      
      // Apply domain adjustment
      suggestion.domainAdjustedConfidence = adjustConfidenceForDomain(
        suggestion.confidence, 
        entity.type, 
        suggestion.context
      );
      
      if (meetsThreshold(suggestion)) {
        suggestions.push(suggestion);
      }
      continue;
    }
    
    if (entity.type === "Version") {
      // heuristic bump version
      const parts = entity.text.split(".").map((p) => Number(p));
      const [major, minor, patch] = parts;
      if (major !== undefined && minor !== undefined && !Number.isNaN(minor)) {
        const suggested = `${major}.${minor + 1}${patch !== undefined ? "." + patch : ""}`;
        const suggestion: ReplacementSuggestion = { 
          entity, 
          suggestedReplacement: suggested, 
          confidence: 0.5, 
          reason: "Suggest next minor version",
          source: "heuristic",
          context: "Version increment"
        };
        
        suggestion.domainAdjustedConfidence = adjustConfidenceForDomain(
          suggestion.confidence, 
          entity.type, 
          suggestion.context
        );
        
        if (meetsThreshold(suggestion)) {
          suggestions.push(suggestion);
        }
        continue;
      }
    }
    
    if (entity.type === "URL") {
      const suggestion: ReplacementSuggestion = { 
        entity, 
        suggestedReplacement: entity.text.replace(/^http:\/\//, "https://"), 
        confidence: 0.7, 
        reason: "Upgrade HTTP to HTTPS",
        source: "heuristic",
        context: "URL security upgrade"
      };
      
      suggestion.domainAdjustedConfidence = adjustConfidenceForDomain(
        suggestion.confidence, 
        entity.type, 
        suggestion.context
      );
      
      // Only suggest if it's actually an HTTP URL
      if (entity.text.startsWith("http://") && meetsThreshold(suggestion)) {
        suggestions.push(suggestion);
      }
      continue;
    }
    
    // fallback - only add if it meets minimum threshold
    const fallbackSuggestion: ReplacementSuggestion = { 
      entity, 
      suggestedReplacement: entity.text, 
      confidence: 0.1, 
      reason: "No strong suggestion available",
      source: "heuristic",
      context: "Generic entity detection"
    };
    
    fallbackSuggestion.domainAdjustedConfidence = adjustConfidenceForDomain(
      fallbackSuggestion.confidence, 
      entity.type, 
      fallbackSuggestion.context
    );
    
    if (meetsThreshold(fallbackSuggestion)) {
      suggestions.push(fallbackSuggestion);
    }
  }

  // 2) Generate brandkit suggestions
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

    // Convert brandkit suggestions to our format
    for (const brandkit of brandkitResults.slice(0, config.maxSuggestions.brandkit)) {
      const suggestion: ReplacementSuggestion = {
        entity: { text: brandkit.originalText, type: "Other" } as NamedEntity,
        suggestedReplacement: brandkit.suggestedReplacement,
        confidence: brandkit.confidence,
        reason: brandkit.reason,
        source: "brandkit",
        context: brandkit.context
      };
      
      suggestion.domainAdjustedConfidence = adjustConfidenceForDomain(
        suggestion.confidence, 
        "brand", 
        suggestion.context
      );
      
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

  // 3) Optionally call AI for smarter suggestions (non-blocking attempt)
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

        // merge by matching originalText → overwrite or add
        for (const ai of aiResults.slice(0, config.maxSuggestions.ai)) {
          const match = suggestions.find(s => s.entity.text === ai.originalText);
          const suggestion: ReplacementSuggestion = {
            entity: match ? match.entity : ({ 
              text: ai.originalText, 
              type: "Other"
            } as NamedEntity),
            suggestedReplacement: ai.suggestedReplacement,
            confidence: ai.confidence ?? 0.7,
            reason: ai.reason || "AI-generated suggestion",
            source: "ai",
            context: ai.context || "AI-generated suggestion"
          };
          
          suggestion.domainAdjustedConfidence = adjustConfidenceForDomain(
            suggestion.confidence, 
            "Other", 
            suggestion.context
          );
          
          if (meetsThreshold(suggestion)) {
            // replace existing or push
            const idx = suggestions.findIndex(s => s.entity.text === ai.originalText);
            if (idx >= 0) {
              suggestions[idx] = suggestion;
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

  // 4) Generate contextual replacements if we have a replacement rule
  if (context?.replacementRule && isAiServiceAvailable()) {
    try {
      const contextualResults = await generateContextualReplacements(
        context.replacementRule.find,
        context.replacementRule.replace,
        {
          ...(context.contentTypeUid && { contentTypeUid: context.contentTypeUid }),
          ...(context.entryUid && { entryUid: context.entryUid }),
          surroundingText: text.substring(0, 200) // First 200 chars for context
        }
      );

      if (contextualResults.length > 0) {
        logger.info("Contextual replacements generated", { 
          requestId,
          count: contextualResults.length 
        });

        // Add contextual suggestions
        for (const contextual of contextualResults.slice(0, config.maxSuggestions.contextual)) {
          const suggestion: ReplacementSuggestion = {
            entity: { 
              text: contextual.originalText, 
              type: "Other"
            } as NamedEntity,
            suggestedReplacement: contextual.suggestedReplacement,
            confidence: contextual.confidence ?? 0.6,
            reason: contextual.reason || "Contextual alternative",
            source: "contextual",
            context: contextual.context || "Contextual replacement"
          };
          
          suggestion.domainAdjustedConfidence = adjustConfidenceForDomain(
            suggestion.confidence, 
            "Other", 
            suggestion.context
          );
          
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

  // 5) Calculate relevance scores and apply sophisticated ranking
  const rankedSuggestions = calculateRelevanceAndRank(suggestions, text, context);
  
  // 6) Limit to max total suggestions
  const finalSuggestions = rankedSuggestions.slice(0, config.maxSuggestions.total);
  
  logger.info("Final suggestions generated", {
    requestId,
    totalProcessed: suggestions.length,
    finalCount: finalSuggestions.length,
    averageConfidence: finalSuggestions.reduce((sum, s) => sum + s.confidence, 0) / finalSuggestions.length,
    sourceBreakdown: getSourceBreakdown(finalSuggestions)
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

// Get source breakdown for logging
function getSourceBreakdown(suggestions: ReplacementSuggestion[]): Record<string, number> {
  const breakdown: Record<string, number> = {};
  
  suggestions.forEach(s => {
    const source = s.source || 'heuristic';
    breakdown[source] = (breakdown[source] || 0) + 1;
  });
  
  return breakdown;
}

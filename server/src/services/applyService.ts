import { deepReplace } from "../utils/deepReplace.js";
import { logger } from "../utils/logger.js";
import { normalizeEntryForProcessing } from "./contentstackService.js";
import { getSuggestionConfig, canAutoApply } from "../config/suggestionConfig.js";
import type { ReplacementSuggestion } from "./suggestionService.js";

export interface ApplyOptions {
  updateUrls?: boolean;
  updateEmails?: boolean;
  applySuggestions?: boolean;
  suggestionThreshold?: number; // Only apply suggestions above this confidence threshold
  autoApplyEnabled?: boolean; // Whether to auto-apply high-confidence suggestions
  sourceFilter?: string[]; // Only apply suggestions from specific sources
}

export interface ApplyResult {
  before: any;
  after: any;
  summary: Array<{
    originalText: string;
    suggested: string;
    confidence: number;
    replacedCount: number;
    source: string;
    autoApplied?: boolean;
  }>;
  totalReplaced: number;
  autoAppliedCount: number;
  manualReviewRequired: number;
}

/**
 * applySuggestionsToDoc
 * - suggestions: array of ReplacementSuggestion objects
 * - doc: deep object (entry)
 * Returns: { before, after, summary, totalReplaced, autoAppliedCount, manualReviewRequired }
 *
 * This function performs exact-text replacements for each suggestion across the entry,
 * respecting options and configuration thresholds.
 */
export function applySuggestionsToDoc(
  doc: any, 
  suggestions: ReplacementSuggestion[], 
  options: ApplyOptions = {}
): ApplyResult {
  const config = getSuggestionConfig();
  
  // Normalize the entry structure for consistent processing
  const normalizedDoc = normalizeEntryForProcessing(doc);
  
  // Build combined per-suggestion regex with word boundary / exact-match heuristics.
  // We will run deepReplace sequentially for each suggestion so we can track replacement counts per suggestion.
  let workingDoc = JSON.parse(JSON.stringify(normalizedDoc));
  const summary: any[] = [];
  let totalReplaced = 0;
  let autoAppliedCount = 0;
  let manualReviewRequired = 0;

  // Use configuration threshold if not provided in options
  const threshold = options.suggestionThreshold ?? config.thresholds.minimum;
  
  // Filter suggestions based on options and configuration
  let filteredSuggestions = suggestions.filter(s => 
    s && s.entity && s.suggestedReplacement !== undefined
  );
  
  // Apply confidence threshold
  filteredSuggestions = filteredSuggestions.filter(s => s.confidence >= threshold);
  
  // Apply source filter if specified
  if (options.sourceFilter && options.sourceFilter.length > 0) {
    filteredSuggestions = filteredSuggestions.filter(s => 
      options.sourceFilter!.includes(s.source || 'heuristic')
    );
  }

  logger.info("Applying suggestions to document", {
    totalSuggestions: suggestions.length,
    filteredSuggestions: filteredSuggestions.length,
    threshold,
    options,
    autoApplyEnabled: options.autoApplyEnabled ?? true
  });

  for (const s of filteredSuggestions) {
    if (!s || !s.entity || s.suggestedReplacement === undefined) continue;
    
    // Determine if this suggestion should be auto-applied
    const shouldAutoApply = (options.autoApplyEnabled ?? true) && 
                          (s.autoApply || canAutoApply(s));
    
    // For manual review suggestions, log but don't apply unless explicitly requested
    if (!shouldAutoApply && !options.applySuggestions) {
      manualReviewRequired++;
      logger.debug("Suggestion requires manual review", {
        originalText: s.entity.text,
        suggestedReplacement: s.suggestedReplacement,
        confidence: s.confidence,
        source: s.source
      });
      continue;
    }
    
    // Escape suggestion text for literal replace; allow configurable boundaries
    const escaped = s.entity.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // If entity contains whitespace or punctuation, don't use \b boundaries (may not help)
    const useWordBoundary = /^\w+$/.test(s.entity.text);
    const flags = "g";
    const pattern = useWordBoundary ? new RegExp(`\\b${escaped}\\b`, flags) : new RegExp(escaped, flags);

    const { result, replacedCount } = deepReplace(workingDoc, pattern, s.suggestedReplacement, {
      updateUrls: options.updateUrls ?? true,
      updateEmails: options.updateEmails ?? true
    });

    workingDoc = result;
    totalReplaced += replacedCount;
    
    if (shouldAutoApply) {
      autoAppliedCount += replacedCount;
    }
    
    summary.push({
      originalText: s.entity.text,
      suggested: s.suggestedReplacement,
      confidence: s.confidence,
      replacedCount,
      source: s.source || 'heuristic',
      autoApplied: shouldAutoApply
    });
  }

  logger.info("Suggestions applied successfully", {
    totalReplaced,
    autoAppliedCount,
    manualReviewRequired,
    summaryCount: summary.length
  });

  return {
    before: normalizedDoc,
    after: workingDoc,
    summary,
    totalReplaced,
    autoAppliedCount,
    manualReviewRequired
  };
}

/**
 * Preview suggestions without applying them
 */
export function previewSuggestions(
  doc: any, 
  suggestions: ReplacementSuggestion[], 
  options: ApplyOptions = {}
): {
  suggestions: Array<{
    originalText: string;
    suggestedReplacement: string;
    confidence: number;
    source: string;
    autoApply: boolean;
    occurrenceCount: number;
    relevanceScore?: number;
  }>;
  summary: {
    totalSuggestions: number;
    autoApplyCount: number;
    manualReviewCount: number;
    highConfidenceCount: number;
    sourceBreakdown: Record<string, number>;
  };
} {
  const config = getSuggestionConfig();
  const normalizedDoc = normalizeEntryForProcessing(doc);
  const docText = JSON.stringify(normalizedDoc);
  
  const threshold = options.suggestionThreshold ?? config.thresholds.minimum;
  
  let filteredSuggestions = suggestions.filter(s => 
    s && s.entity && s.suggestedReplacement !== undefined && s.confidence >= threshold
  );
  
  if (options.sourceFilter && options.sourceFilter.length > 0) {
    filteredSuggestions = filteredSuggestions.filter(s => 
      options.sourceFilter!.includes(s.source || 'heuristic')
    );
  }
  
  const previewSuggestions = filteredSuggestions.map(s => {
    // Count occurrences in document
    const escaped = s.entity.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const useWordBoundary = /^\w+$/.test(s.entity.text);
    const pattern = useWordBoundary ? new RegExp(`\\b${escaped}\\b`, "g") : new RegExp(escaped, "g");
    const matches = docText.match(pattern) || [];
    
    const shouldAutoApply = (options.autoApplyEnabled ?? true) && 
                          (s.autoApply || canAutoApply(s));
    
    return {
      originalText: s.entity.text,
      suggestedReplacement: s.suggestedReplacement,
      confidence: s.confidence,
      source: s.source || 'heuristic',
      autoApply: shouldAutoApply,
      occurrenceCount: matches.length,
      ...(s.relevanceScore !== undefined && { relevanceScore: s.relevanceScore })
    };
  });
  
  // Calculate summary statistics
  const autoApplyCount = previewSuggestions.filter(s => s.autoApply).length;
  const manualReviewCount = previewSuggestions.filter(s => !s.autoApply).length;
  const highConfidenceCount = previewSuggestions.filter(s => s.confidence >= 0.8).length;
  
  const sourceBreakdown: Record<string, number> = {};
  previewSuggestions.forEach(s => {
    sourceBreakdown[s.source] = (sourceBreakdown[s.source] || 0) + 1;
  });
  
  return {
    suggestions: previewSuggestions,
    summary: {
      totalSuggestions: previewSuggestions.length,
      autoApplyCount,
      manualReviewCount,
      highConfidenceCount,
      sourceBreakdown
    }
  };
}
import { deepReplace } from "../utils/deepReplace.js";
import { logger } from "../utils/logger.js";

export interface ApplyOptions {
  updateUrls?: boolean;
  updateEmails?: boolean;
  applySuggestions?: boolean;
  suggestionThreshold?: number; // Only apply suggestions above this confidence threshold
}

export interface ApplyResult {
  before: any;
  after: any;
  summary: Array<{
    originalText: string;
    suggested: string;
    confidence: number;
    replacedCount: number;
  }>;
  totalReplaced: number;
}

/**
 * applySuggestionsToDoc
 * - suggestions: array { entity.text, suggestedReplacement, confidence, source, entity.start, entity.end }
 * - doc: deep object (entry)
 * Returns: { preview: { before, after }, replacedCount }
 *
 * This function performs exact-text replacements for each suggestion across the entry,
 * respecting options such as updateUrls/updateEmails if present.
 */
export function applySuggestionsToDoc(
  doc: any, 
  suggestions: any[], 
  options: ApplyOptions = {}
): ApplyResult {
  // Build combined per-suggestion regex with word boundary / exact-match heuristics.
  // We will run deepReplace sequentially for each suggestion so we can track replacement counts per suggestion.
  let workingDoc = JSON.parse(JSON.stringify(doc));
  const summary: any[] = [];
  let totalReplaced = 0;

  const threshold = options.suggestionThreshold ?? 0.5;
  const filteredSuggestions = suggestions.filter(s => 
    s && s.entity && s.suggestedReplacement !== undefined && s.confidence >= threshold
  );

  logger.info("Applying suggestions to document", {
    totalSuggestions: suggestions.length,
    filteredSuggestions: filteredSuggestions.length,
    threshold,
    options
  });

  for (const s of filteredSuggestions) {
    if (!s || !s.entity || s.suggestedReplacement === undefined) continue;
    
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
    summary.push({
      originalText: s.entity.text,
      suggested: s.suggestedReplacement,
      confidence: s.confidence,
      replacedCount
    });
  }

  logger.info("Suggestions applied successfully", {
    totalReplaced,
    summaryCount: summary.length
  });

  return {
    before: doc,
    after: workingDoc,
    summary,
    totalReplaced
  };
}
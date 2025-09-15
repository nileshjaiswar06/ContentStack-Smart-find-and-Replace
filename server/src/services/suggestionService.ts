// server/src/services/suggestionService.ts
import { extractNamedEntitiesFromText, type NamedEntity } from "./nerService.js";
import { askAIForSuggestions, generateContextualReplacements, isAiServiceAvailable } from "./aiService.js";
import { logger } from "../utils/logger.js";

export type ReplacementSuggestion = {
  entity: NamedEntity;
  suggestedReplacement: string;
  confidence: number;
  reason?: string;
  source?: "heuristic" | "ai" | "brandkit" | "contextual";
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
  },
    requestId?: string
): Promise<ReplacementSuggestion[]> {
  // 1) First do lightweight NER-based heuristics
  const entities = extractNamedEntitiesFromText(text);
  const suggestions: ReplacementSuggestion[] = [];

  for (const entity of entities) {
    if (entity.type === "Email") {
      suggestions.push({ 
        entity, 
        suggestedReplacement: "contact@yourcompany.com", 
        confidence: 0.6, 
        reason: "Suggest default contact pattern",
        source: "heuristic"
      });
      continue;
    }
    if (entity.type === "Version") {
      // heuristic bump version
      const parts = entity.text.split(".").map((p) => Number(p));
      const [major, minor, patch] = parts;
      if (major !== undefined && minor !== undefined && !Number.isNaN(minor)) {
        const suggested = `${major}.${minor + 1}${patch !== undefined ? "." + patch : ""}`;
        suggestions.push({ 
          entity, 
          suggestedReplacement: suggested, 
          confidence: 0.5, 
          reason: "Suggest next minor version",
          source: "heuristic"
        });
        continue;
      }
    }
    // fallback
    suggestions.push({ 
      entity, 
      suggestedReplacement: entity.text, 
      confidence: 0.1, 
      reason: "No strong suggestion available",
      source: "heuristic"
    });
  }

  // 2) Optionally call AI for smarter suggestions (non-blocking attempt)
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
        for (const ai of aiResults) {
          const match = suggestions.find(s => s.entity.text === ai.originalText);
          const entry: ReplacementSuggestion = {
            entity: match ? match.entity : ({ 
              text: ai.originalText, 
              type: "Unknown", 
              start: 0, 
              end: ai.originalText.length 
            } as any),
            suggestedReplacement: ai.suggestedReplacement,
            confidence: ai.confidence ?? 0.7,
            ...(ai.reason && { reason: ai.reason }),
            source: "ai"
          };
          
          // replace existing or push
          const idx = suggestions.findIndex(s => s.entity.text === ai.originalText);
          if (idx >= 0) {
            suggestions[idx] = entry;
          } else {
            suggestions.push(entry);
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

  // 3) Generate contextual replacements if we have a replacement rule
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
        for (const contextual of contextualResults) {
          const entry: ReplacementSuggestion = {
            entity: { 
              text: contextual.originalText, 
              type: "Contextual", 
              start: 0, 
              end: contextual.originalText.length 
            } as any,
            suggestedReplacement: contextual.suggestedReplacement,
            confidence: contextual.confidence ?? 0.6,
            reason: contextual.reason || "Contextual alternative",
            source: "contextual"
          };
          suggestions.push(entry);
        }
      }
    } catch (err: any) {
      logger.debug("Contextual replacement generation failed", { 
        requestId,
        err: err?.message ?? String(err) 
      });
    }
  }

  // Sort by confidence (highest first) and source priority (AI > contextual > heuristic)
  const sourcePriority = { ai: 3, contextual: 2, heuristic: 1, brandkit: 1 };
  
  return suggestions.sort((a, b) => {
    const aPriority = sourcePriority[a.source || "heuristic"];
    const bPriority = sourcePriority[b.source || "heuristic"];
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority; // Higher priority first
    }
    
    return b.confidence - a.confidence; // Higher confidence first
  });
}

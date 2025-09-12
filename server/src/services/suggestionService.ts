// server/src/services/suggestionService.ts
import { extractNamedEntitiesFromText, type NamedEntity } from "./nerService.js";

export type ReplacementSuggestion = { entity: NamedEntity; suggestedReplacement: string; confidence: number; reason?: string };

export async function suggestReplacementsForText(text: string): Promise<ReplacementSuggestion[]> {
  const entities = extractNamedEntitiesFromText(text);
  const suggestions: ReplacementSuggestion[] = [];

  for (const entity of entities) {
    if (entity.type === "Email") {
      suggestions.push({ entity, suggestedReplacement: "contact@yourcompany.com", confidence: 0.6, reason: "Suggest default contact pattern" });
      continue;
    }
    if (entity.type === "Version") {
      // attempt to suggest next minor version
      const parts = entity.text.split(".").map((p) => Number(p));
      const [major, minor, patch] = parts;
      if (major !== undefined && minor !== undefined && !Number.isNaN(minor)) {
        const suggested = `${major}.${minor + 1}${patch !== undefined ? "." + patch : ""}`;
        suggestions.push({ entity, suggestedReplacement: suggested, confidence: 0.5, reason: "Suggest next minor version" });
        continue;
      }
    }
    // Fallback: no-op suggestion, low confidence
    suggestions.push({ entity, suggestedReplacement: entity.text, confidence: 0.1, reason: "No strong suggestion available" });
  }

  // Optionally call external AI if configured (left as pluggable)
  return suggestions;
}

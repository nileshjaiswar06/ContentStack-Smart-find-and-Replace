import nlp from "compromise";
import { mapToCanonicalType, type CanonicalEntityType } from "./canonicalMapping.js";

export type NamedEntity = {
  type: CanonicalEntityType;
  text: string;
  confidence?: number;
  source?: "spacy" | "compromise" | "pattern";
  originalLabel?: string;
};

const EMAIL_RX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const URL_RX = /\bhttps?:\/\/[^\s)>"']+/gi;
// allow optional leading v (v1.2.3) and at least two numeric parts (1.0)
const VERSION_RX = /\bv?\d+\.\d+(?:\.\d+)?\b/gi;

export function extractNamedEntitiesFromText(text: string): NamedEntity[] {
  const entities: NamedEntity[] = [];
  if (!text) return entities;

  // regex types with canonical mapping
  const emailMatches = Array.from(new Set((text.match(EMAIL_RX) ?? []) as string[]));
  emailMatches.forEach((e: string) => entities.push({ 
    type: "Email", 
    text: e, 
    confidence: 0.98, 
    source: "pattern" 
  }));

  const urlMatches = Array.from(new Set((text.match(URL_RX) ?? []) as string[]));
  urlMatches.forEach((u: string) => entities.push({ 
    type: "URL", 
    text: u, 
    confidence: 0.98, 
    source: "pattern" 
  }));

  const versionMatches = Array.from(new Set((text.match(VERSION_RX) ?? []) as string[]));
  versionMatches.forEach((v: string) => entities.push({ 
    type: "Version", 
    text: v, 
    confidence: 0.95, 
    source: "pattern" 
  }));

  // compromise NER with canonical mapping
  const doc = nlp(text);

  const people = Array.from(new Set(doc.people().out("array") as string[]));
  people.forEach((p: string) => {
    const mapping = mapToCanonicalType("PERSON", p, text);
    entities.push({ 
      type: mapping.canonicalType, 
      text: p, 
      confidence: mapping.confidence,
      source: "compromise",
      originalLabel: "PERSON"
    });
  });

  const orgs = Array.from(new Set(doc.organizations().out("array") as string[]));
  orgs.forEach((o: string) => {
    const mapping = mapToCanonicalType("ORG", o, text);
    entities.push({ 
      type: mapping.canonicalType, 
      text: o, 
      confidence: mapping.confidence,
      source: "compromise",
      originalLabel: "ORG"
    });
  });

  // Dates and places using compromise shortcuts
  try {
    const dates = Array.from(new Set(((doc as any).dates()?.out("array") ?? []) as string[]));
    dates.forEach((d: string) => {
      const mapping = mapToCanonicalType("DATE", d, text);
      entities.push({ 
        type: mapping.canonicalType, 
        text: d, 
        confidence: mapping.confidence,
        source: "compromise",
        originalLabel: "DATE"
      });
    });
  } catch (e) {
    // dates() method not available, skipped
  }

  try {
    const places = Array.from(new Set(((doc as any).places()?.out("array") ?? []) as string[]));
    places.forEach((p: string) => {
      const mapping = mapToCanonicalType("GPE", p, text);
      entities.push({ 
        type: mapping.canonicalType, 
        text: p, 
        confidence: mapping.confidence,
        source: "compromise",
        originalLabel: "GPE"
      });
    });
  } catch (e) {
    // places() method not available, skipped
  }

  // Use noun chunks as a lightweight fallback for 'Other' entities, avoid repeating existing entities
  const existing = new Set(entities.map((e) => e.text.toLowerCase()));
  const nouns = (doc.nouns().out("array") as string[]).map((s) => s.trim()).filter(Boolean);
  for (const n of nouns) {
    if (!existing.has(n.toLowerCase())) {
      const mapping = mapToCanonicalType("MISC", n, text);
      entities.push({ 
        type: mapping.canonicalType, 
        text: n, 
        confidence: mapping.confidence,
        source: "compromise",
        originalLabel: "MISC"
      });
      existing.add(n.toLowerCase());
    }
  }

  // Final dedupe by text and type (keep highest confidence)
  const entityMap = new Map<string, NamedEntity>();
  for (const e of entities) {
    const key = e.text.toLowerCase();
    const existing = entityMap.get(key);
    if (!existing || (e.confidence || 0) > (existing.confidence || 0)) {
      entityMap.set(key, e);
    }
  }

  return Array.from(entityMap.values());
}

// Process spaCy entities with canonical mapping and confidence scoring
export function processSpaCyEntities(
  spacyEntities: Array<{ text: string; label: string; start: number; end: number; confidence: number }>,
  text: string
): NamedEntity[] {
  return spacyEntities.map(entity => {
    const mapping = mapToCanonicalType(entity.label, entity.text, text);
    return {
      type: mapping.canonicalType,
      text: entity.text,
      confidence: Math.min(entity.confidence, mapping.confidence),
      source: "spacy" as const,
      originalLabel: entity.label
    };
  });
}


// Merge and deduplicate entities from multiple sources
export function mergeEntities(...entityArrays: NamedEntity[][]): NamedEntity[] {
  const entityMap = new Map<string, NamedEntity>();
  
  for (const entities of entityArrays) {
    for (const entity of entities) {
      const key = entity.text.toLowerCase();
      const existing = entityMap.get(key);
      
      if (!existing || (entity.confidence || 0) > (existing.confidence || 0)) {
        entityMap.set(key, entity);
      }
    }
  }
  
  return Array.from(entityMap.values());
}

 // Enhanced NER function that combines spaCy with canonical mapping and fallback
export async function extractEntitiesWithCanonicalMapping(
  text: string, 
  requestId?: string
): Promise<{
  entities: NamedEntity[];
  model_used: string;
  processing_time_ms: number;
  text_length: number;
  entity_count: number;
  source: "spacy_enhanced" | "fallback";
}> {
  const startTime = Date.now();
  
  try {
    // Try spaCy first with TRF model
    const { extractEntities } = await import("./nerProxy.js");
    const spacyResult = await extractEntities(text, 'en_core_web_trf', 0.5, requestId);
    
    // Apply canonical mapping to spaCy results
    const enhancedEntities: NamedEntity[] = spacyResult.entities.map(entity => {
      const mapping = mapToCanonicalType(entity.label, entity.text, text);
      return {
        type: mapping.canonicalType,
        text: entity.text,
        confidence: entity.confidence * mapping.confidence, // Combine confidences
        source: "spacy" as const,
        originalLabel: entity.label
      };
    });
    
    // Merge with compromise and pattern-based entities
    const fallbackEntities = extractNamedEntitiesFromText(text);
    const mergedEntities = mergeEntities([...enhancedEntities, ...fallbackEntities]);
    
    return {
      entities: mergedEntities,
      model_used: spacyResult.model_used + "_enhanced",
      processing_time_ms: Date.now() - startTime,
      text_length: text.length,
      entity_count: mergedEntities.length,
      source: "spacy_enhanced"
    };
    
  } catch (error) {
    // Fallback to compromise only
    const fallbackEntities = extractNamedEntitiesFromText(text);
    
    return {
      entities: fallbackEntities,
      model_used: "compromise_fallback",
      processing_time_ms: Date.now() - startTime,
      text_length: text.length,
      entity_count: fallbackEntities.length,
      source: "fallback"
    };
  }
}

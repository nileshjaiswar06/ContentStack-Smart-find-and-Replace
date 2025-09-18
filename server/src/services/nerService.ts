import nlp from "compromise";

export type NamedEntity = {
  type: "Person" | "Organization" | "Email" | "URL" | "Version" | "Date" | "Place" | "Other";
  text: string;
};

const EMAIL_RX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const URL_RX = /\bhttps?:\/\/[^\s)>"']+/gi;
// allow optional leading v (v1.2.3) and at least two numeric parts (1.0)
const VERSION_RX = /\bv?\d+\.\d+(?:\.\d+)?\b/gi;

export function extractNamedEntitiesFromText(text: string): NamedEntity[] {
  const entities: NamedEntity[] = [];
  if (!text) return entities;

  // regex types
  const emailMatches = Array.from(new Set((text.match(EMAIL_RX) ?? []) as string[]));
  emailMatches.forEach((e: string) => entities.push({ type: "Email", text: e }));

  const urlMatches = Array.from(new Set((text.match(URL_RX) ?? []) as string[]));
  urlMatches.forEach((u: string) => entities.push({ type: "URL", text: u }));

  const versionMatches = Array.from(new Set((text.match(VERSION_RX) ?? []) as string[]));
  versionMatches.forEach((v: string) => entities.push({ type: "Version", text: v }));

  // compromise NER
  const doc = nlp(text);

  const people = Array.from(new Set(doc.people().out("array") as string[]));
  people.forEach((p: string) => entities.push({ type: "Person", text: p }));

  const orgs = Array.from(new Set(doc.organizations().out("array") as string[]));
  orgs.forEach((o: string) => entities.push({ type: "Organization", text: o }));

  // Dates and places using compromise shortcuts
  // Note: dates() and places() methods may not be available in all versions
  try {
    const dates = Array.from(new Set(((doc as any).dates()?.out("array") ?? []) as string[]));
    dates.forEach((d: string) => entities.push({ type: "Date", text: d }));
  } catch (e) {
    // dates() method not available, skipped
  }

  try {
    const places = Array.from(new Set(((doc as any).places()?.out("array") ?? []) as string[]));
    places.forEach((p: string) => entities.push({ type: "Place", text: p }));
  } catch (e) {
    // places() method not available, skipped
  }

  // Use noun chunks as a lightweight fallback for 'Other' entities, avoid repeating existing entities
  const existing = new Set(entities.map((e) => e.text));
  const nouns = (doc.nouns().out("array") as string[]).map((s) => s.trim()).filter(Boolean);
  for (const n of nouns) {
    if (!existing.has(n)) {
      entities.push({ type: "Other", text: n });
      existing.add(n);
    }
  }

  // Final dedupe by text and type (keep first occurrence)
  const seen = new Set<string>();
  const deduped: NamedEntity[] = [];
  for (const e of entities) {
    const key = `${e.type}::${e.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
  }

  return deduped;
}

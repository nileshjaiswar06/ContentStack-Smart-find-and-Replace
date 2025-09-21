import { replaceWithCase } from "./text.js";
import { replaceInRteDocImmutable } from "./richTextParser.js";
import { canonicalizeUrlsInText } from "./urlCanonicalizer.js";
import { logger } from "./logger.js";
import { normalizeEntryForProcessing } from "../services/contentstackService.js";

const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-zA-Z]{2,}/gi;

function countMatches(text: string, rx: RegExp): number {
  if (!text || !rx) return 0;
  const flags = rx.flags.includes("g") ? rx.flags : rx.flags + "g";
  const clone = new RegExp(rx.source, flags);
  const matches = [...text.matchAll(clone)];
  return matches.length;
}

export function deepReplace(
  obj: any,
  rx: RegExp,
  replacement: string,
  {
    updateUrls = true,
    updateEmails = true,
  }: { updateUrls?: boolean; updateEmails?: boolean } = {}
) : { result: any; replacedCount: number } {
  let replacedCount = 0;

  function processValue(value: any): any {
    if (value == null) return value;

    if (typeof value === "string") {
      if (!updateUrls && URL_PATTERN.test(value)) return value;
      if (!updateEmails && EMAIL_PATTERN.test(value)) return value;

      let target = value;

      // If updateUrls is true, canonicalize any absolute URLs after replacement
      const matches = countMatches(target, rx);
      if (matches === 0) return target;

      replacedCount += matches;
      target = replaceWithCase(target, rx, replacement, true);

      if (updateUrls) {
        try {
          target = canonicalizeUrlsInText(target);
        } catch (err) {
          // ignore canonicalization errors and keep replaced text
        }
      }

      return target;
    }

    if (Array.isArray(value)) {
      return value.map(v => processValue(v));
    }

    if (typeof value === "object") {
      // Detect RTE by content/children keys
      if (value && (value.content || value.children || value.nodeType)) {
        const { doc: newRte, count } = replaceInRteDocImmutable(value, rx, replacement, {
          updateUrls: updateUrls
        });
        replacedCount += count;
        return newRte;
      }

      // clone object
      const out: any = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = processValue(v);
      }
      return out;
    }
    return value;
  }

  const result = processValue(JSON.parse(JSON.stringify(obj)));
  return { result, replacedCount };
}

// Helper function for processing entries with logging
export function processEntry(
  entry: any,
  rx: RegExp,
  replacement: string,
  entryUid: string,
  options: { updateUrls?: boolean; updateEmails?: boolean } = {},
  requestId?: string
) {
  // Normalize the entry structure for consistent processing
  const normalizedEntry = normalizeEntryForProcessing(entry);
  const { result, replacedCount } = deepReplace(normalizedEntry, rx, replacement, options);
  
  if (replacedCount > 0) {
    logger.info(`Replaced ${replacedCount} occurrences in entry ${entryUid}`, requestId);
  }
  
  return { result, replacedCount };
}

import { replaceWithCase } from "./text.js";
import { replaceInRteDoc } from "./richTextParser.js";
import { logger } from "./logger.js";

// Simple URL and email detection patterns
const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

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
      // Check if we should skip URLs or emails
      if (!updateUrls && URL_PATTERN.test(value)) {
        return value;
      }
      if (!updateEmails && EMAIL_PATTERN.test(value)) {
        return value;
      }

      const originalValue = value;
      const newValue = replaceWithCase(value, rx, replacement, true);
      
      // Count replacements
      const matches = value.match(rx);
      if (matches) {
        replacedCount += matches.length;
      }
      
      return newValue;
    }

    // RTE docs: detect by having typical keys
    if (typeof value === "object" && (value.nodeType || value.type || value.content || value.children)) {
      const rteResult = replaceInRteDoc(value, rx, replacement);
      // Count RTE replacements (simplified - you might want to enhance this)
      const originalText = JSON.stringify(value);
      const newText = JSON.stringify(rteResult);
      if (originalText !== newText) {
        const matches = originalText.match(rx);
        if (matches) {
          replacedCount += matches.length;
        }
      }
      return rteResult;
    }

    if (Array.isArray(value)) {
      return value.map(v => processValue(v));
    }

    if (typeof value === "object") {
      const out: any = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = processValue(v);
      }
      return out;
    }

    return value;
  }

  const result = processValue(obj);
  return { result, replacedCount };
}

// Helper function for processing entries with logging
export function processEntry(
  entry: any,
  rx: RegExp,
  replacement: string,
  entryUid: string,
  options: { updateUrls?: boolean; updateEmails?: boolean } = {}
) {
  const { result, replacedCount } = deepReplace(entry, rx, replacement, options);
  
  if (replacedCount > 0) {
    logger.info(`Replaced ${replacedCount} occurrences in entry ${entryUid}`);
  }
  
  return { result, replacedCount };
}

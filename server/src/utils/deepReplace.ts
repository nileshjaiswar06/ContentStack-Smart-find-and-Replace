import { replaceWithCase } from "./text.js";
import { replaceInRteDocImmutable } from "./richTextParser.js";
import { canonicalizeUrlsInText } from "./urlCanonicalizer.js";
import { processTableField, isTableField } from "./tableParser.js";
import { processComponentField, isComponentField, isComponentGroup, processComponentGroup } from "./componentParser.js";
import { processCustomFieldValue, isJsonField, isGroupField, isReferenceField, isFileField, isDateField, isNumberField, isBooleanField } from "./customFieldParser.js";
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

      // Handle table fields
      if (isTableField(value)) {
        const { table, replacedCount: tableCount } = processTableField(value, rx, replacement, {
          updateUrls,
          updateEmails
        });
        replacedCount += tableCount;
        return table;
      }

      // Handle component fields
      if (isComponentField(value)) {
        const { processedValue, replacedCount: componentCount } = processComponentField(value, rx, replacement, {
          updateUrls,
          updateEmails
        });
        replacedCount += componentCount;
        return processedValue;
      }

      // Handle component groups (arrays of components)
      if (isComponentGroup(value)) {
        const { components, replacedCount: groupCount } = processComponentGroup(value, rx, replacement, {
          updateUrls,
          updateEmails
        });
        replacedCount += groupCount;
        return components;
      }

      // Handle custom field types
      if (isJsonField(value) || isGroupField(value) || isReferenceField(value) || isFileField(value) || 
          isDateField(value) || isNumberField(value) || isBooleanField(value)) {
        const { processedValue, replacedCount: customCount } = processCustomFieldValue(value, rx, replacement, {
          updateUrls,
          updateEmails
        });
        replacedCount += customCount;
        return processedValue;
      }

      // Handle regular objects
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
  
  // Log field types being processed
  const fieldTypes = analyzeFieldTypes(normalizedEntry);
  logger.info(`Processing entry ${entryUid} with field types: ${JSON.stringify(fieldTypes)}`, requestId);
  
  const { result, replacedCount } = deepReplace(normalizedEntry, rx, replacement, options);
  
  if (replacedCount > 0) {
    logger.info(`Replaced ${replacedCount} occurrences in entry ${entryUid}`, requestId);
  }
  
  return { result, replacedCount };
}

/**
 * Analyze field types in an entry for logging
 */
function analyzeFieldTypes(obj: any, path: string = ''): Record<string, number> {
  const fieldTypes: Record<string, number> = {};
  
  function analyzeValue(value: any, currentPath: string) {
    if (value == null) return;
    
    if (typeof value === 'string') {
      fieldTypes['string'] = (fieldTypes['string'] || 0) + 1;
    } else if (typeof value === 'number') {
      fieldTypes['number'] = (fieldTypes['number'] || 0) + 1;
    } else if (typeof value === 'boolean') {
      fieldTypes['boolean'] = (fieldTypes['boolean'] || 0) + 1;
    } else if (Array.isArray(value)) {
      fieldTypes['array'] = (fieldTypes['array'] || 0) + 1;
      if (isComponentGroup(value)) {
        fieldTypes['component_group'] = (fieldTypes['component_group'] || 0) + 1;
      }
      value.forEach((item, index) => analyzeValue(item, `${currentPath}[${index}]`));
    } else if (typeof value === 'object') {
      if (value && (value.content || value.children || value.nodeType)) {
        fieldTypes['rich_text'] = (fieldTypes['rich_text'] || 0) + 1;
      } else if (isTableField(value)) {
        fieldTypes['table'] = (fieldTypes['table'] || 0) + 1;
      } else if (isComponentField(value)) {
        fieldTypes['component'] = (fieldTypes['component'] || 0) + 1;
      } else if (isJsonField(value)) {
        fieldTypes['json'] = (fieldTypes['json'] || 0) + 1;
      } else if (isGroupField(value)) {
        fieldTypes['group'] = (fieldTypes['group'] || 0) + 1;
      } else if (isReferenceField(value)) {
        fieldTypes['reference'] = (fieldTypes['reference'] || 0) + 1;
      } else if (isFileField(value)) {
        fieldTypes['file'] = (fieldTypes['file'] || 0) + 1;
      } else if (isDateField(value)) {
        fieldTypes['date'] = (fieldTypes['date'] || 0) + 1;
      } else {
        fieldTypes['object'] = (fieldTypes['object'] || 0) + 1;
      }
      
      // Recursively analyze object properties
      for (const [key, val] of Object.entries(value)) {
        analyzeValue(val, currentPath ? `${currentPath}.${key}` : key);
      }
    }
  }
  
  analyzeValue(obj, path);
  return fieldTypes;
}

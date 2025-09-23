import { replaceWithCase } from "./text.js";
import { replaceInRteDocImmutable } from "./richTextParser.js";
import { processTableField, isTableField } from "./tableParser.js";
import { processComponentField, isComponentField, isComponentGroup, processComponentGroup } from "./componentParser.js";
import { logger } from "./logger.js";

/**
 * Custom Field Parser
 * Handles various Contentstack field types for find and replace operations
 */

function countMatches(text: string, rx: RegExp): number {
  if (!text || !rx) return 0;
  const flags = rx.flags.includes("g") ? rx.flags : rx.flags + "g";
  const clone = new RegExp(rx.source, flags);
  const matches = [...text.matchAll(clone)];
  return matches.length;
}

/**
 * Check if a field is a JSON field
 */
export function isJsonField(field: any): boolean {
  return field && 
         typeof field === 'object' && 
         !Array.isArray(field) && 
         !field._content_type_uid && 
         !field.rows && 
         !field.content && 
         !field.children && 
         !field.nodeType;
}

/**
 * Check if a field is a reference field
 */
export function isReferenceField(field: any): boolean {
  return field && 
         typeof field === 'object' && 
         (field.uid || field._content_type_uid) && 
         !field.rows && 
         !field.content && 
         !field.children && 
         !field.nodeType;
}

/**
 * Check if a field is a group field
 */
export function isGroupField(field: any): boolean {
  return field && 
         typeof field === 'object' && 
         !Array.isArray(field) && 
         !field._content_type_uid && 
         !field.rows && 
         !field.content && 
         !field.children && 
         !field.nodeType &&
         Object.keys(field).length > 0;
}

/**
 * Check if a field is a file field
 */
export function isFileField(field: any): boolean {
  return field && 
         typeof field === 'object' && 
         (field.uid || field.url || field.filename) && 
         !field._content_type_uid;
}

/**
 * Check if a field is a date field
 */
export function isDateField(field: any): boolean {
  return field && 
         (typeof field === 'string' && /^\d{4}-\d{2}-\d{2}/.test(field)) ||
         (typeof field === 'object' && field.date);
}

/**
 * Check if a field is a number field
 */
export function isNumberField(field: any): boolean {
  return typeof field === 'number' || 
         (typeof field === 'string' && !isNaN(Number(field)));
}

/**
 * Check if a field is a boolean field
 */
export function isBooleanField(field: any): boolean {
  return typeof field === 'boolean';
}

/**
 * Process a JSON field for find and replace operations
 */
function processJsonField(field: any, rx: RegExp, replacement: string, options: { updateUrls?: boolean; updateEmails?: boolean } = {}): { field: any; replacedCount: number } {
  if (!isJsonField(field)) {
    return { field, replacedCount: 0 };
  }

  let totalReplacedCount = 0;
  const newField: any = {};

  for (const [key, value] of Object.entries(field)) {
    const { processedValue, replacedCount } = processCustomFieldValue(value, rx, replacement, options);
    newField[key] = processedValue;
    totalReplacedCount += replacedCount;
  }

  return { field: newField, replacedCount: totalReplacedCount };
}

/**
 * Process a group field for find and replace operations
 */
function processGroupField(field: any, rx: RegExp, replacement: string, options: { updateUrls?: boolean; updateEmails?: boolean } = {}): { field: any; replacedCount: number } {
  if (!isGroupField(field)) {
    return { field, replacedCount: 0 };
  }

  let totalReplacedCount = 0;
  const newField: any = {};

  for (const [key, value] of Object.entries(field)) {
    const { processedValue, replacedCount } = processCustomFieldValue(value, rx, replacement, options);
    newField[key] = processedValue;
    totalReplacedCount += replacedCount;
  }

  return { field: newField, replacedCount: totalReplacedCount };
}

/**
 * Process a reference field for find and replace operations
 */
function processReferenceField(field: any, rx: RegExp, replacement: string, options: { updateUrls?: boolean; updateEmails?: boolean } = {}): { field: any; replacedCount: number } {
  if (!isReferenceField(field)) {
    return { field, replacedCount: 0 };
  }

  // Reference fields typically contain UIDs and metadata
  // We might want to update display names or titles if they exist
  let totalReplacedCount = 0;
  const newField: any = { ...field };

  // Check if there are any string fields that might contain the search text
  for (const [key, value] of Object.entries(field)) {
    if (typeof value === 'string') {
      const matches = countMatches(value, rx);
      if (matches > 0) {
        newField[key] = replaceWithCase(value, rx, replacement, true);
        totalReplacedCount += matches;
      }
    }
  }

  return { field: newField, replacedCount: totalReplacedCount };
}

/**
 * Process a file field for find and replace operations
 */
function processFileField(field: any, rx: RegExp, replacement: string, options: { updateUrls?: boolean; updateEmails?: boolean } = {}): { field: any; replacedCount: number } {
  if (!isFileField(field)) {
    return { field, replacedCount: 0 };
  }

  let totalReplacedCount = 0;
  const newField: any = { ...field };

  // Update filename if it contains the search text
  if (typeof field.filename === 'string') {
    const matches = countMatches(field.filename, rx);
    if (matches > 0) {
      newField.filename = replaceWithCase(field.filename, rx, replacement, true);
      totalReplacedCount += matches;
    }
  }

  // Update title if it exists and contains the search text
  if (typeof field.title === 'string') {
    const matches = countMatches(field.title, rx);
    if (matches > 0) {
      newField.title = replaceWithCase(field.title, rx, replacement, true);
      totalReplacedCount += matches;
    }
  }

  // Update description if it exists and contains the search text
  if (typeof field.description === 'string') {
    const matches = countMatches(field.description, rx);
    if (matches > 0) {
      newField.description = replaceWithCase(field.description, rx, replacement, true);
      totalReplacedCount += matches;
    }
  }

  return { field: newField, replacedCount: totalReplacedCount };
}

/**
 * Process a custom field value for find and replace operations
 */
export function processCustomFieldValue(fieldValue: any, rx: RegExp, replacement: string, options: { updateUrls?: boolean; updateEmails?: boolean } = {}): { processedValue: any; replacedCount: number } {
  if (fieldValue == null) {
    return { processedValue: fieldValue, replacedCount: 0 };
  }

  // Handle string fields
  if (typeof fieldValue === 'string') {
    const matches = countMatches(fieldValue, rx);
    if (matches === 0) {
      return { processedValue: fieldValue, replacedCount: 0 };
    }
    const newValue = replaceWithCase(fieldValue, rx, replacement, true);
    return { processedValue: newValue, replacedCount: matches };
  }

  // Handle number fields
  if (isNumberField(fieldValue)) {
    // Numbers typically don't need replacement, but we can convert to string and back
    const stringValue = String(fieldValue);
    const matches = countMatches(stringValue, rx);
    if (matches === 0) {
      return { processedValue: fieldValue, replacedCount: 0 };
    }
    const newValue = replaceWithCase(stringValue, rx, replacement, true);
    const numericValue = isNaN(Number(newValue)) ? newValue : Number(newValue);
    return { processedValue: numericValue, replacedCount: matches };
  }

  // Handle boolean fields
  if (isBooleanField(fieldValue)) {
    // Booleans typically don't need replacement
    return { processedValue: fieldValue, replacedCount: 0 };
  }

  // Handle date fields
  if (isDateField(fieldValue)) {
    const stringValue = typeof fieldValue === 'string' ? fieldValue : fieldValue.date || String(fieldValue);
    const matches = countMatches(stringValue, rx);
    if (matches === 0) {
      return { processedValue: fieldValue, replacedCount: 0 };
    }
    const newValue = replaceWithCase(stringValue, rx, replacement, true);
    return { processedValue: newValue, replacedCount: matches };
  }

  // Handle array fields
  if (Array.isArray(fieldValue)) {
    let totalReplacedCount = 0;
    const newArray: any[] = [];

    for (const item of fieldValue) {
      const { processedValue, replacedCount } = processCustomFieldValue(item, rx, replacement, options);
      newArray.push(processedValue);
      totalReplacedCount += replacedCount;
    }

    return { processedValue: newArray, replacedCount: totalReplacedCount };
  }

  // Handle object fields
  if (typeof fieldValue === 'object') {
    // Check if it's a Rich Text field
    if (fieldValue && (fieldValue.content || fieldValue.children || fieldValue.nodeType)) {
      const { doc: newRte, count } = replaceInRteDocImmutable(fieldValue, rx, replacement, {
        updateUrls: options.updateUrls ?? true
      });
      return { processedValue: newRte, replacedCount: count };
    }

    // Check if it's a table field
    if (isTableField(fieldValue)) {
      const { table, replacedCount } = processTableField(fieldValue, rx, replacement, options);
      return { processedValue: table, replacedCount };
    }

    // Check if it's a component field
    if (isComponentField(fieldValue)) {
      return processComponentField(fieldValue, rx, replacement, options);
    }

    // Check if it's a component group
    if (isComponentGroup(fieldValue)) {
      const { components, replacedCount } = processComponentGroup(fieldValue, rx, replacement, options);
      return { processedValue: components, replacedCount };
    }

    // Check if it's a JSON field
    if (isJsonField(fieldValue)) {
      const { field, replacedCount } = processJsonField(fieldValue, rx, replacement, options);
      return { processedValue: field, replacedCount };
    }

    // Check if it's a group field
    if (isGroupField(fieldValue)) {
      const { field, replacedCount } = processGroupField(fieldValue, rx, replacement, options);
      return { processedValue: field, replacedCount };
    }

    // Check if it's a reference field
    if (isReferenceField(fieldValue)) {
      const { field, replacedCount } = processReferenceField(fieldValue, rx, replacement, options);
      return { processedValue: field, replacedCount };
    }

    // Check if it's a file field
    if (isFileField(fieldValue)) {
      const { field, replacedCount } = processFileField(fieldValue, rx, replacement, options);
      return { processedValue: field, replacedCount };
    }

    // Handle regular objects
    let totalReplacedCount = 0;
    const newObject: any = {};

    for (const [key, value] of Object.entries(fieldValue)) {
      const { processedValue, replacedCount } = processCustomFieldValue(value, rx, replacement, options);
      newObject[key] = processedValue;
      totalReplacedCount += replacedCount;
    }

    return { processedValue: newObject, replacedCount: totalReplacedCount };
  }

  // Handle primitive values
  return { processedValue: fieldValue, replacedCount: 0 };
}

/**
 * Extract text content from a custom field for analysis
 */
export function extractCustomFieldText(fieldValue: any): string {
  if (fieldValue == null) return '';

  if (typeof fieldValue === 'string') {
    return fieldValue;
  }

  if (typeof fieldValue === 'number' || typeof fieldValue === 'boolean') {
    return String(fieldValue);
  }

  if (Array.isArray(fieldValue)) {
    const textParts: string[] = [];
    for (const item of fieldValue) {
      textParts.push(extractCustomFieldText(item));
    }
    return textParts.join(' ');
  }

  if (typeof fieldValue === 'object') {
    // Handle Rich Text fields
    if (fieldValue && (fieldValue.content || fieldValue.children || fieldValue.nodeType)) {
      // This would need to be implemented based on your Rich Text structure
      return JSON.stringify(fieldValue);
    }

    // Handle table fields
    if (isTableField(fieldValue)) {
      // This would need to be implemented based on your table structure
      return JSON.stringify(fieldValue);
    }

    // Handle component fields
    if (isComponentField(fieldValue)) {
      // This would need to be implemented based on your component structure
      return JSON.stringify(fieldValue);
    }

    // Handle other object types
    const textParts: string[] = [];
    for (const value of Object.values(fieldValue)) {
      textParts.push(extractCustomFieldText(value));
    }
    return textParts.join(' ');
  }

  return String(fieldValue);
}

/**
 * Get custom field statistics for logging
 */
export function getCustomFieldStats(fieldValue: any): { fieldType: string; textLength: number; complexity: number } {
  if (fieldValue == null) {
    return { fieldType: 'null', textLength: 0, complexity: 0 };
  }

  let fieldType = 'unknown';
  let textLength = 0;
  let complexity = 0;

  if (typeof fieldValue === 'string') {
    fieldType = 'string';
    textLength = fieldValue.length;
    complexity = 1;
  } else if (typeof fieldValue === 'number') {
    fieldType = 'number';
    textLength = String(fieldValue).length;
    complexity = 1;
  } else if (typeof fieldValue === 'boolean') {
    fieldType = 'boolean';
    textLength = String(fieldValue).length;
    complexity = 1;
  } else if (Array.isArray(fieldValue)) {
    fieldType = 'array';
    textLength = fieldValue.reduce((sum, item) => sum + extractCustomFieldText(item).length, 0);
    complexity = fieldValue.length;
  } else if (typeof fieldValue === 'object') {
    if (isTableField(fieldValue)) {
      fieldType = 'table';
    } else if (isComponentField(fieldValue)) {
      fieldType = 'component';
    } else if (isJsonField(fieldValue)) {
      fieldType = 'json';
    } else if (isGroupField(fieldValue)) {
      fieldType = 'group';
    } else if (isReferenceField(fieldValue)) {
      fieldType = 'reference';
    } else if (isFileField(fieldValue)) {
      fieldType = 'file';
    } else {
      fieldType = 'object';
    }
    
    textLength = extractCustomFieldText(fieldValue).length;
    complexity = Object.keys(fieldValue).length;
  }

  return { fieldType, textLength, complexity };
}
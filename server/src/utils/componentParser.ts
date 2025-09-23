import { replaceWithCase } from "./text.js";
import { replaceInRteDocImmutable } from "./richTextParser.js";
import { processTableField, isTableField } from "./tableParser.js";
import { logger } from "./logger.js";

/**
 * Contentstack Component Parser
 * Handles nested custom components and their fields for find and replace operations
 */

interface ComponentField {
  uid: string;
  [key: string]: any;
}

interface Component {
  uid: string;
  _content_type_uid: string;
  [key: string]: any;
}

function countMatches(text: string, rx: RegExp): number {
  if (!text || !rx) return 0;
  const flags = rx.flags.includes("g") ? rx.flags : rx.flags + "g";
  const clone = new RegExp(rx.source, flags);
  const matches = [...text.matchAll(clone)];
  return matches.length;
}

/**
 * Check if a field is a component field
 */
export function isComponentField(field: any): boolean {
  return field && 
         typeof field === 'object' && 
         field._content_type_uid && 
         typeof field._content_type_uid === 'string';
}

/**
 * Check if a field is a component group (array of components)
 */
export function isComponentGroup(field: any): boolean {
  return Array.isArray(field) && 
         field.length > 0 && 
         field[0] && 
         typeof field[0] === 'object' && 
         field[0]._content_type_uid;
}

/**
 * Process a single component for find and replace operations
 */
function processComponent(component: Component, rx: RegExp, replacement: string, options: { updateUrls?: boolean; updateEmails?: boolean } = {}): { component: Component; replacedCount: number } {
  if (!component || typeof component !== 'object') {
    return { component, replacedCount: 0 };
  }

  let totalReplacedCount = 0;
  const newComponent: Component = { ...component };

  // Process each field in the component
  for (const [fieldKey, fieldValue] of Object.entries(component)) {
    if (fieldKey === 'uid' || fieldKey === '_content_type_uid') {
      continue; // Skip metadata fields
    }

    const { processedValue, replacedCount } = processComponentField(fieldValue, rx, replacement, options);
    newComponent[fieldKey] = processedValue;
    totalReplacedCount += replacedCount;
  }

  return { component: newComponent, replacedCount: totalReplacedCount };
}

/**
 * Process a component field value for find and replace operations
 */
export function processComponentField(fieldValue: any, rx: RegExp, replacement: string, options: { updateUrls?: boolean; updateEmails?: boolean } = {}): { processedValue: any; replacedCount: number } {
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

  // Handle array fields
  if (Array.isArray(fieldValue)) {
    let totalReplacedCount = 0;
    const newArray: any[] = [];

    for (const item of fieldValue) {
      if (isComponentField(item)) {
        // This is a nested component
        const { component, replacedCount } = processComponent(item, rx, replacement, options);
        newArray.push(component);
        totalReplacedCount += replacedCount;
      } else {
        // This is a regular array item
        const { processedValue, replacedCount } = processComponentField(item, rx, replacement, options);
        newArray.push(processedValue);
        totalReplacedCount += replacedCount;
      }
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

    // Check if it's a nested component
    if (isComponentField(fieldValue)) {
      const { component, replacedCount } = processComponent(fieldValue, rx, replacement, options);
      return { processedValue: component, replacedCount };
    }

    // Handle regular object fields
    let totalReplacedCount = 0;
    const newObject: any = {};

    for (const [key, value] of Object.entries(fieldValue)) {
      const { processedValue, replacedCount } = processComponentField(value, rx, replacement, options);
      newObject[key] = processedValue;
      totalReplacedCount += replacedCount;
    }

    return { processedValue: newObject, replacedCount: totalReplacedCount };
  }

  // Handle primitive values
  return { processedValue: fieldValue, replacedCount: 0 };
}

/**
 * Process a component group (array of components) for find and replace operations
 */
export function processComponentGroup(components: Component[], rx: RegExp, replacement: string, options: { updateUrls?: boolean; updateEmails?: boolean } = {}): { components: Component[]; replacedCount: number } {
  if (!Array.isArray(components)) {
    return { components: [], replacedCount: 0 };
  }

  let totalReplacedCount = 0;
  const newComponents: Component[] = [];

  for (const component of components) {
    const { component: newComponent, replacedCount } = processComponent(component, rx, replacement, options);
    newComponents.push(newComponent);
    totalReplacedCount += replacedCount;
  }

  return { components: newComponents, replacedCount: totalReplacedCount };
}

/**
 * Extract text content from a component for analysis
 */
export function extractComponentText(component: Component): string {
  if (!component || typeof component !== 'object') return '';

  const textParts: string[] = [];

  for (const [fieldKey, fieldValue] of Object.entries(component)) {
    if (fieldKey === 'uid' || fieldKey === '_content_type_uid') {
      continue; // Skip metadata fields
    }

    const fieldText = extractComponentFieldText(fieldValue);
    if (fieldText) {
      textParts.push(fieldText);
    }
  }

  return textParts.join(' ');
}

/**
 * Extract text content from a component field
 */
function extractComponentFieldText(fieldValue: any): string {
  if (fieldValue == null) return '';

  if (typeof fieldValue === 'string') {
    return fieldValue;
  }

  if (Array.isArray(fieldValue)) {
    const textParts: string[] = [];
    for (const item of fieldValue) {
      if (isComponentField(item)) {
        textParts.push(extractComponentText(item));
      } else {
        textParts.push(extractComponentFieldText(item));
      }
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

    // Handle nested components
    if (isComponentField(fieldValue)) {
      return extractComponentText(fieldValue);
    }

    // Handle regular objects
    const textParts: string[] = [];
    for (const value of Object.values(fieldValue)) {
      textParts.push(extractComponentFieldText(value));
    }
    return textParts.join(' ');
  }

  return String(fieldValue);
}

/**
 * Get component statistics for logging
 */
export function getComponentStats(component: Component): { fields: number; textLength: number; componentType: string } {
  if (!component || typeof component !== 'object') {
    return { fields: 0, textLength: 0, componentType: 'unknown' };
  }

  let fieldCount = 0;
  let textLength = 0;

  for (const [fieldKey, fieldValue] of Object.entries(component)) {
    if (fieldKey === 'uid' || fieldKey === '_content_type_uid') {
      continue; // Skip metadata fields
    }

    fieldCount++;
    const fieldText = extractComponentFieldText(fieldValue);
    textLength += fieldText.length;
  }

  return {
    fields: fieldCount,
    textLength,
    componentType: component._content_type_uid || 'unknown'
  };
}
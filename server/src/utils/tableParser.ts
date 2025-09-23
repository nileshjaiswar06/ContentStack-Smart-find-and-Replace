import { replaceWithCase } from "./text.js";
import { logger } from "./logger.js";

/**
 * Contentstack Table Field Parser
 * Handles table fields with rows and columns for find and replace operations
 */

interface TableCell {
  uid: string;
  value: string;
  [key: string]: any;
}

interface TableRow {
  uid: string;
  cells: TableCell[];
  [key: string]: any;
}

interface TableField {
  uid: string;
  rows: TableRow[];
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
 * Process a table cell for find and replace operations
 */
function processTableCell(cell: TableCell, rx: RegExp, replacement: string, options: { updateUrls?: boolean; updateEmails?: boolean } = {}): { cell: TableCell; replacedCount: number } {
  if (!cell || typeof cell.value !== 'string') {
    return { cell, replacedCount: 0 };
  }

  const matches = countMatches(cell.value, rx);
  if (matches === 0) {
    return { cell, replacedCount: 0 };
  }

  const newValue = replaceWithCase(cell.value, rx, replacement, true);
  const newCell = { ...cell, value: newValue };
  
  return { cell: newCell, replacedCount: matches };
}

/**
 * Process a table row for find and replace operations
 */
function processTableRow(row: TableRow, rx: RegExp, replacement: string, options: { updateUrls?: boolean; updateEmails?: boolean } = {}): { row: TableRow; replacedCount: number } {
  if (!row || !Array.isArray(row.cells)) {
    return { row, replacedCount: 0 };
  }

  let totalReplacedCount = 0;
  const newCells: TableCell[] = [];

  for (const cell of row.cells) {
    const { cell: newCell, replacedCount } = processTableCell(cell, rx, replacement, options);
    newCells.push(newCell);
    totalReplacedCount += replacedCount;
  }

  const newRow = { ...row, cells: newCells };
  return { row: newRow, replacedCount: totalReplacedCount };
}

/**
 * Process a table field for find and replace operations
 */
export function processTableField(table: TableField, rx: RegExp, replacement: string, options: { updateUrls?: boolean; updateEmails?: boolean } = {}): { table: TableField; replacedCount: number } {
  if (!table || !Array.isArray(table.rows)) {
    return { table, replacedCount: 0 };
  }

  let totalReplacedCount = 0;
  const newRows: TableRow[] = [];

  for (const row of table.rows) {
    const { row: newRow, replacedCount } = processTableRow(row, rx, replacement, options);
    newRows.push(newRow);
    totalReplacedCount += replacedCount;
  }

  const newTable = { ...table, rows: newRows };
  return { table: newTable, replacedCount: totalReplacedCount };
}

/**
 * Check if a field is a table field
 */
export function isTableField(field: any): boolean {
  return field && 
         typeof field === 'object' && 
         Array.isArray(field.rows) && 
         field.rows.length > 0 &&
         field.rows[0] && 
         Array.isArray(field.rows[0].cells);
}

/**
 * Extract text content from a table for analysis
 */
export function extractTableText(table: TableField): string {
  if (!isTableField(table)) return '';

  const textParts: string[] = [];
  
  for (const row of table.rows) {
    if (Array.isArray(row.cells)) {
      const rowText = row.cells
        .map(cell => cell.value || '')
        .join(' | ');
      textParts.push(rowText);
    }
  }
  
  return textParts.join('\n');
}

/**
 * Get table statistics for logging
 */
export function getTableStats(table: TableField): { rows: number; cells: number; totalTextLength: number } {
  if (!isTableField(table)) {
    return { rows: 0, cells: 0, totalTextLength: 0 };
  }

  let totalCells = 0;
  let totalTextLength = 0;

  for (const row of table.rows) {
    if (Array.isArray(row.cells)) {
      totalCells += row.cells.length;
      for (const cell of row.cells) {
        if (typeof cell.value === 'string') {
          totalTextLength += cell.value.length;
        }
      }
    }
  }

  return {
    rows: table.rows.length,
    cells: totalCells,
    totalTextLength
  };
}
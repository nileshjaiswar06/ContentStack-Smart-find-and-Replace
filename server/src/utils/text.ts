
 //Escape regex special characters if we are doing literal search
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build regex safely (literal or regex mode)
export function buildRegex(
  find: string,
  mode: "literal" | "regex" = "literal",
  { caseSensitive = false, wholeWord = true }: { caseSensitive?: boolean; wholeWord?: boolean } = {}
): RegExp {
  if (!find) throw new Error("Search pattern cannot be empty");

  const src = mode === "regex" ? find : escapeRegExp(find);
  const withBoundary = (mode === "regex" || !wholeWord) ? src : `\\b${src}\\b`;
  return new RegExp(withBoundary, caseSensitive ? "g" : "gi");
}

/**
 * Preserve case when replacing text
 * "Gemini" -> "Claude"
 * "GEMINI" -> "CLAUDE"
 * "gemini" -> "claude"
 */
export function preserveCase(source: string, replacement: string): string {
  if (source.toUpperCase() === source) return replacement.toUpperCase();
  if (source.toLowerCase() === source) return replacement.toLowerCase();
  // Titlecase heuristic
  if (source[0] && replacement[0] && source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

 // Replace text with optional case preservation
export function replaceWithCase(
  text: string,
  rx: RegExp,
  replacement: string,
  keepCase = true
): string {
  return text.replace(rx, (match) => (keepCase ? preserveCase(match, replacement) : replacement));
}

// Common regex helpers
export const EMAIL_RX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
export const URL_RX = /\bhttps?:\/\/[^\s)>"']+/gi;

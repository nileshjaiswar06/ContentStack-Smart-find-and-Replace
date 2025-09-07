import { diff_match_patch, DIFF_INSERT, DIFF_DELETE } from "diff-match-patch";

// Text diff (for strings)
export function diffText(before: string, after: string) {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(before || "", after || "");
  dmp.diff_cleanupSemantic(diffs);
  return diffs.map(([op, text]) => ({ op, text }));
}

/**
 * Summarize how many string fields changed between two objects
 * Groups counts by top-level field (demo-friendly)
 */
export function changeCount(before: any, after: any) {
  const counts: Record<string, number> = {};

  const walk = (a: any, b: any, path: string, topField: string) => {
    if (typeof a === "string" && typeof b === "string") {
      if (a !== b) counts[topField] = (counts[topField] ?? 0) + 1;
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        walk(a[i], b[i], `${path}[${i}]`, topField);
      }
      return;
    }
    if (typeof a === "object" && typeof b === "object" && a && b) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      keys.forEach((k) =>
        walk((a as any)[k], (b as any)[k], path ? `${path}.${k}` : k, topField)
      );
    }
  };

  // Only walk top-level fields and track them by their name
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  keys.forEach((key) => walk(before?.[key], after?.[key], key, key));

  return Object.entries(counts).map(([field, count]) => ({ field, count }));
}

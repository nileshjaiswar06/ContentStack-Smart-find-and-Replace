import { replaceWithCase } from "./text.js";

type Node = Record<string, any>;

function mapChildrenKey(node: Node) {
  return Array.isArray(node?.content) ? "content" :
         Array.isArray(node?.children) ? "children" : null;
}

function countMatches(text: string, rx: RegExp): number {
  if (!text || !rx) return 0;
  const flags = rx.flags.includes("g") ? rx.flags : rx.flags + "g";
  const clone = new RegExp(rx.source, flags);
  return Array.from(text.matchAll(clone)).length;
}

/**
 * Walks a node immutably, returning { node: newNode, count: number }
 * Special handling for link nodes: if the href contains the match OR the inner text contains it,
 * replace both, but count as the number of matches total.
 */
function walkAndReplaceImmutable(node: any, rx: RegExp, replacement: string): { node: any; count: number } {
  if (!node) return { node, count: 0 };

  const out: any = { ...node };
  let count = 0;

  // Replace plain text on node
  if (typeof out.text === "string") {
    const matches = countMatches(out.text, rx);
    if (matches > 0) {
      out.text = replaceWithCase(out.text, rx, replacement, true);
      count += matches;
    }
  }

  // If node has attrs.href (common Contentstack RTE), replace href and, if applicable, the display text.
  if (out.attrs && typeof out.attrs.href === "string") {
    const hrefMatches = countMatches(out.attrs.href, rx);
    if (hrefMatches > 0) {
      out.attrs = { ...out.attrs, href: out.attrs.href.replace(rx, replacement) };
      count += hrefMatches;
    }
  }

  // Visit children
  const key = mapChildrenKey(out);
  if (key) {
    const kids = out[key] || [];
    const newKids: any[] = [];
    for (const child of kids) {
      const res = walkAndReplaceImmutable(child, rx, replacement);
      newKids.push(res.node);
      count += res.count;
    }
    out[key] = newKids;
  }

  return { node: out, count };
}

/**
 * Immutable replacement on a rich text document. Returns { doc: newDoc, count }
 */
export function replaceInRteDocImmutable(doc: any, rx: RegExp, replacement: string): { doc: any; count: number } {
  if (!doc) return { doc, count: 0 };
  if (Array.isArray(doc)) {
    const newDocs: any[] = [];
    let total = 0;
    for (const n of doc) {
      const res = walkAndReplaceImmutable(n, rx, replacement);
      newDocs.push(res.node);
      total += res.count;
    }
    return { doc: newDocs, count: total };
  }
  if (doc.content || doc.children) {
    const res = walkAndReplaceImmutable(doc, rx, replacement);
    return { doc: res.node, count: res.count };
  }
  return { doc, count: 0 };
}

// Extract plain text (for diffs/Brandkit)
export function extractText(doc: any): string {
  let out = "";
  const visit = (n: any) => {
    if (!n) return;
    if (typeof n.text === "string") out += n.text + " ";
    const kids = n.content ?? n.children ?? [];
    kids.forEach(visit);
  };
  if (Array.isArray(doc)) doc.forEach(visit); else visit(doc);
  return out.trim();
}
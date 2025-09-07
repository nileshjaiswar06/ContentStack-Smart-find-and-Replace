import { replaceWithCase } from "./text.js";

type Node = Record<string, any>;

function mapChildrenKey(node: Node) {
  return Array.isArray(node?.content) ? "content" :
         Array.isArray(node?.children) ? "children" : null;
}

export function walkAndReplace(node: any, rx: RegExp, replacement: string) {
  if (!node) return node;

  // Text node
  if (typeof node.text === "string") {
    node.text = replaceWithCase(node.text, rx, replacement, true);
  }

  // Link node (href + maybe text inside)
  if (node.attrs?.href && typeof node.attrs.href === "string") {
    node.attrs.href = node.attrs.href.replace(rx, replacement); // URL case doesn't matter
  }

  const key = mapChildrenKey(node);
  if (key) {
    node[key] = node[key].map((child: Node) => walkAndReplace(child, rx, replacement));
  }
  return node;
}

export function replaceInRteDoc(doc: any, rx: RegExp, replacement: string) {
  if (!doc) return doc;
  if (Array.isArray(doc)) return doc.map(n => walkAndReplace(n, rx, replacement));
  if (doc.content || doc.children) return walkAndReplace(doc, rx, replacement);
  return doc;
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
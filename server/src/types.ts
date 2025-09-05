export type ReplacementMode = "literal" | "regex";
export interface ReplacementRule {
  find: string;            // literal string or regex source
  replace: string;
  mode?: ReplacementMode;  // default: "literal"
  caseSensitive?: boolean; // default: false
  wholeWord?: boolean;     // default: true (for literal)
  preserveCase?: boolean;  // default: true (Map "Gemini"->"Claude", "GEMINI"->"CLAUDE")
  updateLinks?: boolean;   // update link text + href
  updateEmails?: boolean;  // mailto + plain emails
  updateUrls?: boolean;    // plain URL fields
}

export interface EntryTarget {
  contentTypeUid: string;
  entryUid: string;
}

export interface PreviewResponse {
  entryUid: string;
  before: any;
  after: any;
  changes: Array<{ field: string; count: number }>;
}

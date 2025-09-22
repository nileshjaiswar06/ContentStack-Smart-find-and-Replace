/**
 * Canonical Label Mapping System
 * Maps spaCy entity labels to standardized canonical types for consistent processing
 */

export type CanonicalEntityType = 
  | "Person" 
  | "Organization" 
  | "Location" 
  | "Product" 
  | "Brand" 
  | "Technology" 
  | "Date" 
  | "Time" 
  | "Email" 
  | "URL" 
  | "Version" 
  | "Currency" 
  | "Percentage" 
  | "Other";

export interface CanonicalMapping {
  canonicalType: CanonicalEntityType;
  confidence: number;
  description: string;
  aliases: string[];
}

/**
 * Comprehensive mapping from spaCy labels to canonical types
 * Includes confidence scores and context-aware mappings
 */
export const SPA_CY_TO_CANONICAL_MAP: Record<string, CanonicalMapping> = {
  // Person entities
  "PERSON": { canonicalType: "Person", confidence: 0.95, description: "Individual person", aliases: ["person", "individual", "human"] },
  "PER": { canonicalType: "Person", confidence: 0.90, description: "Person (abbreviated)", aliases: ["person"] },
  
  // Organization entities
  "ORG": { canonicalType: "Organization", confidence: 0.90, description: "Organization or company", aliases: ["organization", "company", "corporation", "firm"] },
  "ORGANIZATION": { canonicalType: "Organization", confidence: 0.95, description: "Organization", aliases: ["organization", "company"] },
  
  // Location entities
  "GPE": { canonicalType: "Location", confidence: 0.85, description: "Geopolitical entity (country, city, state)", aliases: ["location", "place", "geography"] },
  "LOC": { canonicalType: "Location", confidence: 0.90, description: "Location", aliases: ["location", "place"] },
  "LOCATION": { canonicalType: "Location", confidence: 0.95, description: "Geographic location", aliases: ["location", "place"] },
  "FAC": { canonicalType: "Location", confidence: 0.80, description: "Building or facility", aliases: ["facility", "building", "structure"] },
  "NORP": { canonicalType: "Organization", confidence: 0.75, description: "Nationality, religious, or political group", aliases: ["group", "nationality"] },
  
  // Product and Brand entities (custom labels)
  "PRODUCT": { canonicalType: "Product", confidence: 0.95, description: "Product or service", aliases: ["product", "service", "item"] },
  "BRAND": { canonicalType: "Brand", confidence: 0.95, description: "Brand or company name", aliases: ["brand", "company", "trademark"] },
  
  // Technology entities
  "TECH": { canonicalType: "Technology", confidence: 0.90, description: "Technology or software", aliases: ["technology", "software", "tech"] },
  "SOFTWARE": { canonicalType: "Technology", confidence: 0.95, description: "Software application", aliases: ["software", "app", "application"] },
  "PLATFORM": { canonicalType: "Technology", confidence: 0.90, description: "Technology platform", aliases: ["platform", "system", "framework"] },
  
  // Date and time entities
  "DATE": { canonicalType: "Date", confidence: 0.95, description: "Date", aliases: ["date", "time", "calendar"] },
  "TIME": { canonicalType: "Time", confidence: 0.90, description: "Time", aliases: ["time", "hour", "minute"] },
  
  // Contact information
  "EMAIL": { canonicalType: "Email", confidence: 0.98, description: "Email address", aliases: ["email", "mail"] },
  "URL": { canonicalType: "URL", confidence: 0.98, description: "Web URL", aliases: ["url", "link", "website"] },
  
  // Version and technical
  "VERSION": { canonicalType: "Version", confidence: 0.95, description: "Version number", aliases: ["version", "release", "build"] },
  "CARDINAL": { canonicalType: "Other", confidence: 0.60, description: "Cardinal number", aliases: ["number", "count"] },
  "ORDINAL": { canonicalType: "Other", confidence: 0.60, description: "Ordinal number", aliases: ["ordinal", "sequence"] },
  
  // Financial
  "MONEY": { canonicalType: "Currency", confidence: 0.90, description: "Monetary amount", aliases: ["money", "currency", "price"] },
  "PERCENT": { canonicalType: "Percentage", confidence: 0.90, description: "Percentage", aliases: ["percentage", "percent", "%"] },
  
  // Other entities
  "EVENT": { canonicalType: "Other", confidence: 0.80, description: "Event", aliases: ["event", "occasion"] },
  "WORK_OF_ART": { canonicalType: "Other", confidence: 0.75, description: "Work of art", aliases: ["art", "creative", "work"] },
  "LAW": { canonicalType: "Other", confidence: 0.85, description: "Legal document", aliases: ["law", "legal", "regulation"] },
  "LANGUAGE": { canonicalType: "Other", confidence: 0.90, description: "Language", aliases: ["language", "tongue"] },
  "QUANTITY": { canonicalType: "Other", confidence: 0.70, description: "Quantity or measurement", aliases: ["quantity", "amount", "measure"] },
  "MISC": { canonicalType: "Other", confidence: 0.50, description: "Miscellaneous", aliases: ["misc", "other"] },
};

// Context-aware entity type detection based on text patterns
export const CONTEXT_PATTERNS: Record<CanonicalEntityType, RegExp[]> = {
  Person: [
    /\b(?:Mr|Mrs|Ms|Dr|Prof|Sir|Madam)\s+\w+/i,
    /\b[A-Z][a-z]+\s+[A-Z][a-z]+/,
    /\b(?:CEO|CTO|CFO|President|Director|Manager)\s+[A-Z][a-z]+/i
  ],
  Organization: [
    /\b(?:Inc|Corp|LLC|Ltd|Co|Company|Corporation|Organization|Group|Associates)\b/i,
    /\b[A-Z][a-z]+\s+(?:Inc|Corp|LLC|Ltd|Co)\b/i,
    /\b(?:University|College|Institute|School|Hospital|Foundation)\b/i
  ],
  Location: [
    /\b(?:Street|Ave|Road|Boulevard|Drive|Lane|Way|Place)\b/i,
    /\b(?:City|Town|Village|County|State|Country|Nation)\b/i,
    /\b(?:North|South|East|West|Central|Upper|Lower)\s+\w+/i
  ],
  Product: [
    /\b(?:v\d+\.\d+|version\s+\d+|release\s+\d+)/i,
    /\b(?:Pro|Plus|Premium|Standard|Basic|Enterprise|Professional)\b/i,
    /\b(?:API|SDK|Framework|Library|Tool|Service|Platform)\b/i
  ],
  Brand: [
    /\b[A-Z][a-z]+\s+(?:AI|ML|Cloud|Tech|Digital|Solutions|Systems)\b/i,
    /\b(?:Google|Microsoft|Apple|Amazon|Facebook|Twitter|LinkedIn|GitHub)\b/i,
    /\b[A-Z][A-Z]+\b/ // Acronyms like IBM, NASA, etc.
  ],
  Technology: [
    /\b(?:JavaScript|Python|Java|C\+\+|React|Vue|Angular|Node\.js|Express)\b/i,
    /\b(?:API|REST|GraphQL|JSON|XML|HTML|CSS|SQL|NoSQL)\b/i,
    /\b(?:Docker|Kubernetes|AWS|Azure|GCP|Firebase|MongoDB|PostgreSQL)\b/i
  ],
  Date: [
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+/i,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
    /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i
  ],
  Time: [
    /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/i,
    /\b(?:morning|afternoon|evening|night|midnight|noon)\b/i,
    /\b(?:hour|minute|second|day|week|month|year)s?\b/i
  ],
  Email: [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
  ],
  URL: [
    /\bhttps?:\/\/[^\s<>"{}|\\^`\[\]]+/i,
    /\bwww\.[^\s<>"{}|\\^`\[\]]+/i
  ],
  Version: [
    /\bv?\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9]+)?\b/,
    /\b(?:version|v|release|r)\s*\d+\.\d+(?:\.\d+)?/i
  ],
  Currency: [
    /\$\d+(?:,\d{3})*(?:\.\d{2})?\b/,
    /\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:dollars?|USD|EUR|GBP|JPY|CAD|AUD)\b/i
  ],
  Percentage: [
    /\b\d+(?:\.\d+)?%\b/,
    /\b\d+(?:\.\d+)?\s*percent\b/i
  ],
  Other: []
};

// Maps spaCy entity label to canonical type with confidence scoring
export function mapToCanonicalType(
  spacyLabel: string, 
  text: string, 
  context?: string
): { canonicalType: CanonicalEntityType; confidence: number; reason: string } {
  // First, check special-case mappings for labels known to be frequently misclassified
  // (e.g., LOC/GPE often includes product/brand names like 'Gemini AI')
  if (spacyLabel === 'LOC' || spacyLabel === 'GPE' || spacyLabel === 'LOCATION') {
    const specialCasesForLoc = getSpecialCaseMappings(text, spacyLabel);
    if (specialCasesForLoc) return specialCasesForLoc;
  }

  // Context-aware pattern matching (helps when labels are missing)
  for (const [canonicalType, patterns] of Object.entries(CONTEXT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return {
          canonicalType: canonicalType as CanonicalEntityType,
          confidence: 0.85,
          reason: `Pattern match for '${canonicalType}' in text: '${text}'`
        };
      }
    }
  }

  // Direct mapping from spaCy labels
  const directMapping = SPA_CY_TO_CANONICAL_MAP[spacyLabel];
  if (directMapping) {
    return {
      canonicalType: directMapping.canonicalType,
      confidence: directMapping.confidence,
      reason: `Direct mapping from spaCy label '${spacyLabel}'`
    };
  }

  // Fallback
  return {
    canonicalType: "Other",
    confidence: 0.30,
    reason: `Unknown spaCy label '${spacyLabel}' - defaulting to Other`
  };
}

// Handle special cases and common misclassifications
function getSpecialCaseMappings(
  text: string, 
  spacyLabel: string
): { canonicalType: CanonicalEntityType; confidence: number; reason: string } | null {
  const lowerText = text.toLowerCase();
  
  // Common brand names that might be misclassified
  const brandNames = [
    'google', 'microsoft', 'apple', 'amazon', 'facebook', 'meta', 'twitter', 'linkedin',
    'github', 'gitlab', 'docker', 'kubernetes', 'redis', 'mongodb', 'postgresql',
    'contentstack', 'gemini', 'chatgpt', 'openai', 'anthropic', 'claude'
  ];
  
  if (brandNames.some(brand => lowerText.includes(brand))) {
    return {
      canonicalType: "Brand",
      confidence: 0.90,
      reason: `Recognized brand name: '${text}'`
    };
  }

  // AI/Tech products that might be misclassified as LOC
  const aiProducts = [
    'gemini ai', 'chatgpt', 'claude ai', 'gpt-4', 'bard', 'copilot', 'azure ai',
    'openai', 'anthropic claude', 'google ai', 'microsoft ai', 'aws ai'
  ];
  
  if (aiProducts.some(product => lowerText.includes(product))) {
    return {
      canonicalType: "Product",
      confidence: 0.92,
      reason: `AI product misclassified as location: '${text}'`
    };
  }

  // Cloud services that might be misclassified
  const cloudServices = [
    'azure', 'aws', 'gcp', 'google cloud', 'microsoft azure', 'amazon web services',
    'firebase', 'vercel', 'netlify', 'heroku', 'digitalocean'
  ];
  
  if (cloudServices.some(service => lowerText.includes(service))) {
    return {
      canonicalType: "Product",
      confidence: 0.88,
      reason: `Cloud service: '${text}'`
    };
  }

  // Technology terms that might be misclassified
  const techTerms = [
    'api', 'sdk', 'framework', 'library', 'platform', 'service', 'microservice',
    'database', 'cache', 'queue', 'message', 'event', 'stream', 'pipeline'
  ];
  
  if (techTerms.some(term => lowerText.includes(term))) {
    return {
      canonicalType: "Technology",
      confidence: 0.85,
      reason: `Technology term: '${text}'`
    };
  }

  // Product version patterns
  if (/\b(?:pro|plus|premium|standard|basic|enterprise|professional|advanced)\b/i.test(text)) {
    return {
      canonicalType: "Product",
      confidence: 0.80,
      reason: `Product variant: '${text}'`
    };
  }

  // Geographic entities that might be misclassified as organizations
  if (spacyLabel === 'ORG' && /(?:city|town|village|county|state|country|nation|region)/i.test(text)) {
    return {
      canonicalType: "Location",
      confidence: 0.85,
      reason: `Geographic entity misclassified as organization: '${text}'`
    };
  }

  // Special handling for LOC label - many tech products get misclassified as LOC
  if (spacyLabel === 'LOC') {
    // Check if it's likely a product/brand rather than location
    if (/\b(?:ai|ml|cloud|tech|digital|solutions|systems|platform|service|app|software)\b/i.test(text)) {
      return {
        canonicalType: "Product",
        confidence: 0.85,
        reason: `Tech product misclassified as location: '${text}'`
      };
    }
  }

  return null;
}

 // Get all available canonical types
export function getCanonicalTypes(): CanonicalEntityType[] {
  return [
    "Person", "Organization", "Location", "Product", "Brand", "Technology",
    "Date", "Time", "Email", "URL", "Version", "Currency", "Percentage", "Other"
  ];
}

// Get mapping statistics for monitoring
export function getMappingStats(): {
  totalMappings: number;
  canonicalTypes: number;
  averageConfidence: number;
} {
  const mappings = Object.values(SPA_CY_TO_CANONICAL_MAP);
  const canonicalTypes = new Set(mappings.map(m => m.canonicalType)).size;
  const averageConfidence = mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length;
  
  return {
    totalMappings: mappings.length,
    canonicalTypes,
    averageConfidence: Math.round(averageConfidence * 100) / 100
  };
}
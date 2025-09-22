import { logger } from "../utils/logger.js";
import { extractNamedEntitiesFromText, type NamedEntity } from "./nerService.js";

export interface BrandMapping {
  brandName: string;
  aliases: string[];
  products: ProductMapping[];
  domains: string[];
  confidence: number;
  lastUpdated: Date;
}

export interface ProductMapping {
  productName: string;
  aliases: string[];
  category: string;
  brandOwner: string;
  confidence: number;
  suggestedReplacements?: string[];
}

export interface BrandkitSuggestion {
  originalText: string;
  suggestedReplacement: string;
  confidence: number;
  reason: string;
  context: string;
  brandMapping?: BrandMapping;
  productMapping?: ProductMapping;
  suggestionType?: 'brand_standardization' | 'product_standardization' | 'banned_phrase' | 'tone_style' | 'consistency';
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface BannedPhrase {
  phrase: string;
  category: 'outdated' | 'offensive' | 'legal' | 'brand_conflict' | 'trademark' | 'inappropriate';
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedReplacement?: string;
  reason: string;
  lastUpdated: Date;
  isActive: boolean;
}

export interface ToneStyleRule {
  ruleId: string;
  name: string;
  description: string;
  pattern: string | RegExp;
  tone: 'formal' | 'casual' | 'professional' | 'friendly' | 'technical' | 'marketing';
  style: 'concise' | 'detailed' | 'conversational' | 'academic' | 'promotional';
  severity: 'low' | 'medium' | 'high';
  suggestedFix: string;
  isActive: boolean;
}

export interface BrandkitConfig {
  bannedPhrases: BannedPhrase[];
  toneStyleRules: ToneStyleRule[];
  brandMappings: BrandMapping[];
  lastUpdated: Date;
  version: string;
}

// Default banned phrases - in production this would come from a database or external service
const DEFAULT_BANNED_PHRASES: BannedPhrase[] = [
  {
    phrase: "best of breed",
    category: "outdated",
    severity: "medium",
    suggestedReplacement: "industry-leading",
    reason: "Outdated business terminology",
    lastUpdated: new Date(),
    isActive: true
  },
  {
    phrase: "synergy",
    category: "outdated",
    severity: "low",
    suggestedReplacement: "collaboration",
    reason: "Overused corporate buzzword",
    lastUpdated: new Date(),
    isActive: true
  },
  {
    phrase: "leverage",
    category: "outdated",
    severity: "low",
    suggestedReplacement: "use",
    reason: "Overused business jargon",
    lastUpdated: new Date(),
    isActive: true
  },
  {
    phrase: "disrupt",
    category: "outdated",
    severity: "medium",
    suggestedReplacement: "transform",
    reason: "Overused tech industry term",
    lastUpdated: new Date(),
    isActive: true
  },
  {
    phrase: "paradigm shift",
    category: "outdated",
    severity: "high",
    suggestedReplacement: "significant change",
    reason: "Overused academic terminology",
    lastUpdated: new Date(),
    isActive: true
  },
  {
    phrase: "cutting-edge",
    category: "outdated",
    severity: "low",
    suggestedReplacement: "advanced",
    reason: "Overused marketing term",
    lastUpdated: new Date(),
    isActive: true
  },
  {
    phrase: "revolutionary",
    category: "outdated",
    severity: "medium",
    suggestedReplacement: "innovative",
    reason: "Overused marketing hyperbole",
    lastUpdated: new Date(),
    isActive: true
  },
  {
    phrase: "game-changer",
    category: "outdated",
    severity: "high",
    suggestedReplacement: "significant improvement",
    reason: "Overused marketing cliché",
    lastUpdated: new Date(),
    isActive: true
  }
];

// Default tone and style rules
const DEFAULT_TONE_STYLE_RULES: ToneStyleRule[] = [
  {
    ruleId: "avoid-passive-voice",
    name: "Avoid Passive Voice",
    description: "Replace passive voice with active voice for clarity",
    pattern: /\b(was|were|is|are|been|being)\s+\w+ed\b/gi,
    tone: "professional",
    style: "concise",
    severity: "medium",
    suggestedFix: "Rewrite in active voice",
    isActive: true
  },
  {
    ruleId: "avoid-contractions",
    name: "Avoid Contractions in Formal Content",
    description: "Use full forms instead of contractions in professional content",
    pattern: /\b(don't|won't|can't|shouldn't|couldn't|wouldn't|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|doesn't|didn't)\b/gi,
    tone: "formal",
    style: "concise",
    severity: "low",
    suggestedFix: "Use full forms (do not, will not, cannot, etc.)",
    isActive: true
  },
  {
    ruleId: "avoid-exclamation-marks",
    name: "Limit Exclamation Marks",
    description: "Avoid excessive use of exclamation marks in professional content",
    pattern: /!{2,}/g,
    tone: "professional",
    style: "concise",
    severity: "low",
    suggestedFix: "Use single exclamation mark or period",
    isActive: true
  },
  {
    ruleId: "avoid-all-caps",
    name: "Avoid All Caps",
    description: "Avoid using all capital letters for emphasis",
    pattern: /\b[A-Z]{3,}\b/g,
    tone: "professional",
    style: "concise",
    severity: "medium",
    suggestedFix: "Use proper emphasis techniques",
    isActive: true
  },
  {
    ruleId: "avoid-redundant-phrases",
    name: "Avoid Redundant Phrases",
    description: "Remove redundant phrases that don't add value",
    pattern: /\b(completely|totally|absolutely|entirely|wholly)\s+(unique|perfect|complete|finished|done)\b/gi,
    tone: "professional",
    style: "concise",
    severity: "low",
    suggestedFix: "Remove redundant modifier",
    isActive: true
  },
  {
    ruleId: "avoid-filler-words",
    name: "Avoid Filler Words",
    description: "Remove unnecessary filler words",
    pattern: /\b(just|simply|basically|actually|really|quite|rather|somewhat|fairly)\s+/gi,
    tone: "professional",
    style: "concise",
    severity: "low",
    suggestedFix: "Remove filler word",
    isActive: true
  }
];

//  Default brand mappings - in production this would come from a database or external service
const DEFAULT_BRAND_MAPPINGS: BrandMapping[] = [
  {
    brandName: "Microsoft",
    aliases: ["MSFT", "Microsoft Corp", "Microsoft Corporation"],
    domains: ["microsoft.com", "outlook.com", "hotmail.com", "live.com"],
    confidence: 0.95,
    lastUpdated: new Date(),
    products: [
      {
        productName: "Microsoft 365",
        aliases: ["Office 365", "O365", "Microsoft Office"],
        category: "productivity",
        brandOwner: "Microsoft",
        confidence: 0.9,
        suggestedReplacements: ["Microsoft 365", "M365"]
      },
      {
        productName: "Azure",
        aliases: ["Microsoft Azure", "Azure Cloud"],
        category: "cloud",
        brandOwner: "Microsoft",
        confidence: 0.95,
        suggestedReplacements: ["Microsoft Azure", "Azure"]
      },
      {
        productName: "Visual Studio Code",
        aliases: ["VS Code", "VSCode", "Visual Studio Code"],
        category: "developer-tools",
        brandOwner: "Microsoft",
        confidence: 0.9,
        suggestedReplacements: ["Visual Studio Code", "VS Code"]
      }
    ]
  },
  {
    brandName: "Google",
    aliases: ["Google Inc", "Alphabet", "Google LLC"],
    domains: ["google.com", "gmail.com", "googlecloud.com"],
    confidence: 0.95,
    lastUpdated: new Date(),
    products: [
      {
        productName: "Google Workspace",
        aliases: ["G Suite", "Google Apps", "Gmail for Business"],
        category: "productivity",
        brandOwner: "Google",
        confidence: 0.9,
        suggestedReplacements: ["Google Workspace", "Workspace"]
      },
      {
        productName: "Google Cloud Platform",
        aliases: ["GCP", "Google Cloud", "Google Cloud Services"],
        category: "cloud",
        brandOwner: "Google",
        confidence: 0.95,
        suggestedReplacements: ["Google Cloud", "GCP"]
      }
    ]
  },
  {
    brandName: "Amazon",
    aliases: ["Amazon.com", "Amazon Inc", "AMZN"],
    domains: ["amazon.com", "aws.amazon.com"],
    confidence: 0.95,
    lastUpdated: new Date(),
    products: [
      {
        productName: "Amazon Web Services",
        aliases: ["AWS", "Amazon Cloud", "Amazon Web Services"],
        category: "cloud",
        brandOwner: "Amazon",
        confidence: 0.95,
        suggestedReplacements: ["Amazon Web Services", "AWS"]
      }
    ]
  },
  {
    brandName: "Contentstack",
    aliases: ["Content Stack", "ContentStack Inc"],
    domains: ["contentstack.com", "contentstack.io"],
    confidence: 0.98,
    lastUpdated: new Date(),
    products: [
      {
        productName: "Contentstack CMS",
        aliases: ["Contentstack", "Content Management System"],
        category: "cms",
        brandOwner: "Contentstack",
        confidence: 0.95,
        suggestedReplacements: ["Contentstack", "Contentstack CMS"]
      }
    ]
  }
];


// In-memory cache for brandkit configuration
let brandkitConfig: BrandkitConfig = {
  bannedPhrases: [...DEFAULT_BANNED_PHRASES],
  toneStyleRules: [...DEFAULT_TONE_STYLE_RULES],
  brandMappings: [...DEFAULT_BRAND_MAPPINGS],
  lastUpdated: new Date(),
  version: "1.0.0"
};

// Legacy cache for backward compatibility
let brandMappingsCache: BrandMapping[] = [...DEFAULT_BRAND_MAPPINGS];
let cacheLastUpdated = new Date();

// Get all brand mappings
export function getBrandMappings(): BrandMapping[] {
  return brandMappingsCache;
}

// Find brand mapping by name or alias
export function findBrandMapping(brandName: string): BrandMapping | null {
  const normalizedName = brandName.toLowerCase().trim();
  
  return brandMappingsCache.find(mapping => 
    mapping.brandName.toLowerCase() === normalizedName ||
    mapping.aliases.some(alias => alias.toLowerCase() === normalizedName)
  ) || null;
}

// Find product mapping by name or alias
export function findProductMapping(productName: string): { brand: BrandMapping; product: ProductMapping } | null {
  const normalizedName = productName.toLowerCase().trim();
  
  for (const brand of brandMappingsCache) {
    const product = brand.products.find(p => 
      p.productName.toLowerCase() === normalizedName ||
      p.aliases.some(alias => alias.toLowerCase() === normalizedName)
    );
    
    if (product) {
      return { brand, product };
    }
  }
  
  return null;
}

//  Extract brand and product entities from text using NER
export function extractBrandProductEntities(text: string): {
  brands: NamedEntity[];
  products: NamedEntity[];
  other: NamedEntity[];
} {
  const entities = extractNamedEntitiesFromText(text);
  
  return {
    brands: entities.filter(e => 
      e.type === "Organization" || 
      e.type === "Person" // Sometimes brand names are detected as persons
    ),
    products: entities.filter(e => 
      e.type === "Other" && 
      (e.text.toLowerCase().includes("cloud") ||
       e.text.toLowerCase().includes("software") ||
       e.text.toLowerCase().includes("service") ||
       e.text.toLowerCase().includes("platform"))
    ),
    other: entities.filter(e => 
      e.type !== "Organization" && 
      e.type !== "Person" &&
      !(e.type === "Other" && 
        (e.text.toLowerCase().includes("cloud") ||
         e.text.toLowerCase().includes("software") ||
         e.text.toLowerCase().includes("service") ||
         e.text.toLowerCase().includes("platform")))
    )
  };
}

// Generate brandkit suggestions for text content
export async function generateBrandkitSuggestions(
  text: string,
  context?: {
    contentTypeUid?: string;
    entryUid?: string;
    preferredBrands?: string[];
  },
  requestId?: string
): Promise<BrandkitSuggestion[]> {
  logger.info("Generating brandkit suggestions", {
    requestId,
    textLength: text.length,
    context: context?.contentTypeUid
  });

  const suggestions: BrandkitSuggestion[] = [];
  const { brands, products } = extractBrandProductEntities(text);
  
  // Process brand entities
  for (const brandEntity of brands) {
    const mapping = findBrandMapping(brandEntity.text);
    if (mapping) {
      // Suggest canonical brand name if different
      if (mapping.brandName !== brandEntity.text) {
        suggestions.push({
          originalText: brandEntity.text,
          suggestedReplacement: mapping.brandName,
          confidence: mapping.confidence * 0.9, // Slightly lower for brand standardization
          reason: `Standardize brand name to canonical form`,
          context: `Brand standardization: ${brandEntity.text} → ${mapping.brandName}`,
          brandMapping: mapping,
          suggestionType: 'brand_standardization',
          severity: 'medium'
        });
      }
      
      // Check for product suggestions within the brand
      for (const product of mapping.products) {
        if (text.toLowerCase().includes(product.productName.toLowerCase()) ||
            product.aliases.some(alias => text.toLowerCase().includes(alias.toLowerCase()))) {
          
          // Find the best replacement for this product mention
          const bestReplacement = product.suggestedReplacements?.[0] || product.productName;
          
          suggestions.push({
            originalText: findProductMentionInText(text, product),
            suggestedReplacement: bestReplacement,
            confidence: product.confidence,
            reason: `Use preferred product name for ${mapping.brandName}`,
            context: `Product standardization within ${mapping.brandName} context`,
            brandMapping: mapping,
            productMapping: product,
            suggestionType: 'product_standardization',
            severity: 'medium'
          });
        }
      }
    } else {
      // Unknown brand - suggest investigation
      logger.debug("Unknown brand entity detected", {
        requestId,
        brandText: brandEntity.text,
        entityType: brandEntity.type
      });
    }
  }
  
  // Process product entities
  for (const productEntity of products) {
    const mapping = findProductMapping(productEntity.text);
    if (mapping) {
      const { brand, product } = mapping;
      const bestReplacement = product.suggestedReplacements?.[0] || product.productName;
      
      // Only suggest if different from current text
      if (bestReplacement !== productEntity.text) {
        suggestions.push({
          originalText: productEntity.text,
          suggestedReplacement: bestReplacement,
          confidence: product.confidence,
          reason: `Use canonical product name for ${brand.brandName}`,
          context: `Product name standardization`,
          brandMapping: brand,
          productMapping: product,
          suggestionType: 'product_standardization',
          severity: 'medium'
        });
      }
    }
  }
  
  // Check for banned phrases
  const bannedPhraseSuggestions = detectBannedPhrases(text, requestId);
  suggestions.push(...bannedPhraseSuggestions);
  
  // Check for tone and style issues
  const toneStyleSuggestions = detectToneStyleIssues(text, requestId);
  suggestions.push(...toneStyleSuggestions);
  
  // Check for brand consistency across the text
  const brandConsistencySuggestions = checkBrandConsistency(text, suggestions, requestId);
  suggestions.push(...brandConsistencySuggestions);
  
  // Apply context-based filtering
  const filteredSuggestions = filterSuggestionsByContext(suggestions, context);
  
  logger.info("Brandkit suggestions generated", {
    requestId,
    totalSuggestions: filteredSuggestions.length,
    brandEntities: brands.length,
    productEntities: products.length,
    bannedPhrases: bannedPhraseSuggestions.length,
    toneStyleIssues: toneStyleSuggestions.length
  });
  
  return filteredSuggestions;
}

// Find specific product mention in text
function findProductMentionInText(text: string, product: ProductMapping): string {
  const lowerText = text.toLowerCase();
  
  // Check for exact product name match
  if (lowerText.includes(product.productName.toLowerCase())) {
    return product.productName;
  }
  
  // Check for alias matches
  for (const alias of product.aliases) {
    if (lowerText.includes(alias.toLowerCase())) {
      return alias;
    }
  }
  
  return product.productName; // Fallback
}

 // Check for brand consistency issues across the text
function checkBrandConsistency(
  text: string, 
  existingSuggestions: BrandkitSuggestion[],
  requestId?: string
): BrandkitSuggestion[] {
  const consistencySuggestions: BrandkitSuggestion[] = [];
  
  // Find all brand mentions in the text
  const brandMentions = new Map<string, string[]>();
  
  for (const mapping of brandMappingsCache) {
    const mentions: string[] = [];
    
    // Check for canonical name
    if (text.includes(mapping.brandName)) {
      mentions.push(mapping.brandName);
    }
    
    // Check for aliases
    for (const alias of mapping.aliases) {
      if (text.includes(alias)) {
        mentions.push(alias);
      }
    }
    
    if (mentions.length > 1) {
      brandMentions.set(mapping.brandName, mentions);
    }
  }
  
  // Generate consistency suggestions
  for (const [canonicalBrand, mentions] of brandMentions) {
    if (mentions.length > 1) {
      const mapping = findBrandMapping(canonicalBrand);
      if (mapping) {
        // Suggest using the canonical name for all mentions
        for (const mention of mentions) {
          if (mention !== canonicalBrand) {
            consistencySuggestions.push({
              originalText: mention,
              suggestedReplacement: canonicalBrand,
              confidence: mapping.confidence * 0.8, // Lower confidence for consistency changes
              reason: `Maintain consistent brand naming throughout content`,
              context: `Brand consistency: Use "${canonicalBrand}" consistently`,
              brandMapping: mapping
            });
          }
        }
      }
    }
  }
  
  return consistencySuggestions;
}

// Filter suggestions based on context preferences
function filterSuggestionsByContext(
  suggestions: BrandkitSuggestion[],
  context?: {
    contentTypeUid?: string;
    entryUid?: string;
    preferredBrands?: string[];
  }
): BrandkitSuggestion[] {
  if (!context?.preferredBrands || context.preferredBrands.length === 0) {
    return suggestions;
  }
  
  // Boost confidence for preferred brands
  return suggestions.map(suggestion => {
    if (suggestion.brandMapping && 
        context.preferredBrands!.includes(suggestion.brandMapping.brandName)) {
      return {
        ...suggestion,
        confidence: Math.min(suggestion.confidence * 1.1, 1.0),
        reason: suggestion.reason + " (preferred brand)"
      };
    }
    return suggestion;
  });
}

// Update brand mappings cache (for future database integration)
export function updateBrandMappings(newMappings: BrandMapping[]): void {
  brandMappingsCache = [...newMappings];
  cacheLastUpdated = new Date();
  
  logger.info("Brand mappings cache updated", {
    mappingCount: brandMappingsCache.length,
    lastUpdated: cacheLastUpdated
  });
}

 // Get cache status
export function getBrandkitCacheStatus() {
  return {
    mappingCount: brandMappingsCache.length,
    lastUpdated: cacheLastUpdated,
    brands: brandMappingsCache.map(m => m.brandName),
    totalProducts: brandMappingsCache.reduce((sum, m) => sum + m.products.length, 0)
  };
}

// Detect banned phrases in text
export function detectBannedPhrases(text: string, requestId?: string): BrandkitSuggestion[] {
  const suggestions: BrandkitSuggestion[] = [];
  const lowerText = text.toLowerCase();
  
  for (const bannedPhrase of brandkitConfig.bannedPhrases) {
    if (!bannedPhrase.isActive) continue;
    
    const phrase = bannedPhrase.phrase.toLowerCase();
    if (lowerText.includes(phrase)) {
      const confidence = getSeverityConfidence(bannedPhrase.severity);
      
      suggestions.push({
        originalText: bannedPhrase.phrase,
        suggestedReplacement: bannedPhrase.suggestedReplacement || "Consider alternative phrasing",
        confidence,
        reason: bannedPhrase.reason,
        context: `Banned phrase detected: ${bannedPhrase.category}`,
        suggestionType: 'banned_phrase',
        severity: bannedPhrase.severity
      });
      
      logger.debug("Banned phrase detected", {
        requestId,
        phrase: bannedPhrase.phrase,
        category: bannedPhrase.category,
        severity: bannedPhrase.severity
      });
    }
  }
  
  return suggestions;
}

// Detect tone and style issues in text
export function detectToneStyleIssues(text: string, requestId?: string): BrandkitSuggestion[] {
  const suggestions: BrandkitSuggestion[] = [];
  
  for (const rule of brandkitConfig.toneStyleRules) {
    if (!rule.isActive) continue;
    
    const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern, 'gi') : rule.pattern;
    const matches = text.match(pattern);
    
    if (matches && matches.length > 0) {
      for (const match of matches) {
        const confidence = getSeverityConfidence(rule.severity);
        
        suggestions.push({
          originalText: match,
          suggestedReplacement: rule.suggestedFix,
          confidence,
          reason: rule.description,
          context: `Tone/style rule: ${rule.name}`,
          suggestionType: 'tone_style',
          severity: rule.severity
        });
      }
      
      logger.debug("Tone/style issue detected", {
        requestId,
        ruleId: rule.ruleId,
        ruleName: rule.name,
        matches: matches.length,
        severity: rule.severity
      });
    }
  }
  
  return suggestions;
}

// Get confidence score based on severity
function getSeverityConfidence(severity: 'low' | 'medium' | 'high' | 'critical'): number {
  switch (severity) {
    case 'low': return 0.6;
    case 'medium': return 0.75;
    case 'high': return 0.9;
    case 'critical': return 0.95;
    default: return 0.7;
  }
}

// Get complete brandkit configuration
export function getBrandkitConfig(): BrandkitConfig {
  return { ...brandkitConfig };
}

// Update brandkit configuration
export function updateBrandkitConfig(newConfig: Partial<BrandkitConfig>): void {
  brandkitConfig = {
    ...brandkitConfig,
    ...newConfig,
    lastUpdated: new Date(),
    version: incrementVersion(brandkitConfig.version)
  };
  
  // Update legacy cache for backward compatibility
  brandMappingsCache = [...brandkitConfig.brandMappings];
  cacheLastUpdated = new Date();
  
  logger.info("Brandkit configuration updated", {
    version: brandkitConfig.version,
    bannedPhrases: brandkitConfig.bannedPhrases.length,
    toneStyleRules: brandkitConfig.toneStyleRules.length,
    brandMappings: brandkitConfig.brandMappings.length
  });
}

// Add new brand mapping
export function addBrandMapping(mapping: BrandMapping): void {
  const existingIndex = brandkitConfig.brandMappings.findIndex(m => m.brandName === mapping.brandName);
  
  if (existingIndex >= 0) {
    brandkitConfig.brandMappings[existingIndex] = { ...mapping, lastUpdated: new Date() };
  } else {
    brandkitConfig.brandMappings.push({ ...mapping, lastUpdated: new Date() });
  }
  
  updateBrandkitConfig({});
  logger.info("Brand mapping added/updated", { brandName: mapping.brandName, products: mapping.products.length });
}

// Add new banned phrase
export function addBannedPhrase(phrase: BannedPhrase): void {
  const existingIndex = brandkitConfig.bannedPhrases.findIndex(p => p.phrase === phrase.phrase);
  
  if (existingIndex >= 0) {
    brandkitConfig.bannedPhrases[existingIndex] = { ...phrase, lastUpdated: new Date() };
  } else {
    brandkitConfig.bannedPhrases.push({ ...phrase, lastUpdated: new Date() });
  }
  
  updateBrandkitConfig({});
  logger.info("Banned phrase added/updated", { phrase: phrase.phrase, category: phrase.category });
}

// Add new tone/style rule
export function addToneStyleRule(rule: ToneStyleRule): void {
  const existingIndex = brandkitConfig.toneStyleRules.findIndex(r => r.ruleId === rule.ruleId);
  
  if (existingIndex >= 0) {
    brandkitConfig.toneStyleRules[existingIndex] = rule;
  } else {
    brandkitConfig.toneStyleRules.push(rule);
  }
  
  updateBrandkitConfig({});
  logger.info("Tone/style rule added/updated", { ruleId: rule.ruleId, name: rule.name });
}

// Remove banned phrase
export function removeBannedPhrase(phrase: string): boolean {
  const index = brandkitConfig.bannedPhrases.findIndex(p => p.phrase === phrase);
  if (index >= 0) {
    brandkitConfig.bannedPhrases.splice(index, 1);
    updateBrandkitConfig({});
    logger.info("Banned phrase removed", { phrase });
    return true;
  }
  return false;
}

// Remove brand mapping
export function removeBrandMapping(brandName: string): boolean {
  const index = brandkitConfig.brandMappings.findIndex(m => m.brandName === brandName);
  if (index >= 0) {
    brandkitConfig.brandMappings.splice(index, 1);
    updateBrandkitConfig({});
    logger.info("Brand mapping removed", { brandName });
    return true;
  }
  return false;
}

// Remove tone/style rule
export function removeToneStyleRule(ruleId: string): boolean {
  const index = brandkitConfig.toneStyleRules.findIndex(r => r.ruleId === ruleId);
  if (index >= 0) {
    brandkitConfig.toneStyleRules.splice(index, 1);
    updateBrandkitConfig({});
    logger.info("Tone/style rule removed", { ruleId });
    return true;
  }
  return false;
}

// Increment version number
function incrementVersion(version: string): string {
  const parts = version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
}

// Validate brand mapping data
export function validateBrandMapping(mapping: BrandMapping): string[] {
  const errors: string[] = [];
  
  if (!mapping.brandName || mapping.brandName.trim().length === 0) {
    errors.push("Brand name is required");
  }
  
  if (!Array.isArray(mapping.aliases)) {
    errors.push("Aliases must be an array");
  }
  
  if (!Array.isArray(mapping.domains)) {
    errors.push("Domains must be an array");
  }
  
  if (mapping.confidence < 0 || mapping.confidence > 1) {
    errors.push("Confidence must be between 0 and 1");
  }
  
  if (!Array.isArray(mapping.products)) {
    errors.push("Products must be an array");
  } else {
    mapping.products.forEach((product, index) => {
      if (!product.productName || product.productName.trim().length === 0) {
        errors.push(`Product ${index}: name is required`);
      }
      if (product.confidence < 0 || product.confidence > 1) {
        errors.push(`Product ${index}: confidence must be between 0 and 1`);
      }
    });
  }
  
  return errors;
}
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
}

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


// In-memory cache for brand mappings
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
          brandMapping: mapping
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
            productMapping: product
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
          productMapping: product
        });
      }
    }
  }
  
  // Check for brand consistency across the text
  const brandConsistencySuggestions = checkBrandConsistency(text, suggestions, requestId);
  suggestions.push(...brandConsistencySuggestions);
  
  // Apply context-based filtering
  const filteredSuggestions = filterSuggestionsByContext(suggestions, context);
  
  logger.info("Brandkit suggestions generated", {
    requestId,
    totalSuggestions: filteredSuggestions.length,
    brandEntities: brands.length,
    productEntities: products.length
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
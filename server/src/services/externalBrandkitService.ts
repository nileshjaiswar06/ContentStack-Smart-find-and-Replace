import axios from "axios";
import { promises as fs } from "fs";
import { logger } from "../utils/logger.js";
import type { 
  BrandMapping, 
  BannedPhrase, 
  ToneStyleRule, 
  BrandkitConfig
} from "./brandkitService.js";
import { 
  addBrandMapping,
  addBannedPhrase,
  addToneStyleRule,
  updateBrandkitConfig
} from "./brandkitService.js";

export interface ExternalBrandkitProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
}

export interface BrandkitSyncResult {
  success: boolean;
  brandsUpdated: number;
  bannedPhrasesUpdated: number;
  toneRulesUpdated: number;
  errors: string[];
  lastSync: Date;
}

// External brandkit providers configuration
const EXTERNAL_PROVIDERS: ExternalBrandkitProvider[] = [
  {
    name: "brandkit-api",
    baseUrl: process.env.BRANDKIT_API_URL || "https://api.brandkit.com/v1",
    apiKey: process.env.BRANDKIT_API_KEY || "",
    enabled: !!(process.env.BRANDKIT_API_KEY && process.env.BRANDKIT_API_URL)
  },
  {
    name: "contentstack-brandkit",
  baseUrl: process.env.CONTENTSTACK_BRANDKIT_URL || process.env.CONTENTSTACK_DELIVERY_API || "https://api.contentstack.io/v3/brandkit",
    // Prefer a dedicated Brandkit API key if provided, fall back to generic CONTENTSTACK_API_KEY for compatibility
    apiKey: process.env.CONTENTSTACK_BRANDKIT_API_KEY || process.env.CONTENTSTACK_API_KEY || "",
    // Allow enabling when both base URL and an API key (either brandkit-specific or generic) are present
  // enable if we have delivery API and credentials for CDA or legacy brandkit URL
  enabled: !!((process.env.CONTENTSTACK_BRANDKIT_API_KEY || process.env.CONTENTSTACK_API_KEY) && (process.env.CONTENTSTACK_BRANDKIT_URL || process.env.CONTENTSTACK_DELIVERY_API))
  }
];

// Sync brandkit data from external providers
export async function syncExternalBrandkitData(
  requestId?: string
): Promise<BrandkitSyncResult> {
  const result: BrandkitSyncResult = {
    success: true,
    brandsUpdated: 0,
    bannedPhrasesUpdated: 0,
    toneRulesUpdated: 0,
    errors: [],
    lastSync: new Date()
  };

  logger.info("Starting external brandkit sync", { requestId });

  console.log('Available providers:', EXTERNAL_PROVIDERS.map(p => ({ name: p.name, enabled: p.enabled })));
  console.log('CDA environment check:', {
    CONTENTSTACK_DELIVERY_API: !!process.env.CONTENTSTACK_DELIVERY_API,
    CONTENTSTACK_API_KEY: !!process.env.CONTENTSTACK_API_KEY,
    CONTENTSTACK_DELIVERY_TOKEN: !!process.env.CONTENTSTACK_DELIVERY_TOKEN,
    CONTENTSTACK_ENVIRONMENT: process.env.CONTENTSTACK_ENVIRONMENT
  });

  for (const provider of EXTERNAL_PROVIDERS) {
    console.log('Processing provider:', provider.name, 'enabled:', provider.enabled);
    if (!provider.enabled) {
      logger.debug("Provider disabled, skipping", { 
        requestId, 
        provider: provider.name 
      });
      continue;
    }

    try {
      logger.info("Syncing from provider", { 
        requestId, 
        provider: provider.name 
      });

      console.log(`Starting sync for provider: ${provider.name}`);
      console.log(`Provider baseUrl: ${provider.baseUrl}`);
      console.log(`Provider apiKey present: ${!!provider.apiKey}`);

      // Sync brands
      console.log('Starting brand sync...');
      const brandsResult = await syncBrandsFromProvider(provider, requestId);
      console.log('Brand sync result:', brandsResult);
      result.brandsUpdated += brandsResult.brandsUpdated;
      result.errors.push(...brandsResult.errors);

      // Sync banned phrases
      console.log('Starting banned phrases sync...');
      const bannedPhrasesResult = await syncBannedPhrasesFromProvider(provider, requestId);
      console.log('Banned phrases sync result:', bannedPhrasesResult);
      result.bannedPhrasesUpdated += bannedPhrasesResult.bannedPhrasesUpdated;
      result.errors.push(...bannedPhrasesResult.errors);

      // Sync tone/style rules
      console.log('Starting tone rules sync...');
      const toneRulesResult = await syncToneRulesFromProvider(provider, requestId);
      console.log('Tone rules sync result:', toneRulesResult);
      result.toneRulesUpdated += toneRulesResult.toneRulesUpdated;
      result.errors.push(...toneRulesResult.errors);

    } catch (error: any) {
      const errorMsg = `Failed to sync from ${provider.name}: ${error.message}`;
      result.errors.push(errorMsg);
      result.success = false;
      
      logger.error("Provider sync failed", {
        requestId,
        provider: provider.name,
        error: error.message
      });
    }
  }

  // Update brandkit configuration if any data was synced
  if (result.brandsUpdated > 0 || result.bannedPhrasesUpdated > 0 || result.toneRulesUpdated > 0) {
    updateBrandkitConfig({});
  }

  logger.info("External brandkit sync completed", {
    requestId,
    success: result.success,
    brandsUpdated: result.brandsUpdated,
    bannedPhrasesUpdated: result.bannedPhrasesUpdated,
    toneRulesUpdated: result.toneRulesUpdated,
    errors: result.errors.length
  });

  return result;
}

// Sync brands from external provider
async function syncBrandsFromProvider(
  provider: ExternalBrandkitProvider,
  requestId?: string
): Promise<{ brandsUpdated: number; errors: string[] }> {
  const result: { brandsUpdated: number; errors: string[] } = { brandsUpdated: 0, errors: [] };

  try {
    // If this is the Contentstack provider and CDA is available, use CDA endpoints
    console.log('Provider name:', provider.name);
    console.log('CDA env vars:', {
      CONTENTSTACK_DELIVERY_API: !!process.env.CONTENTSTACK_DELIVERY_API,
      CONTENTSTACK_API_KEY: !!process.env.CONTENTSTACK_API_KEY,
      CONTENTSTACK_DELIVERY_TOKEN: !!process.env.CONTENTSTACK_DELIVERY_TOKEN
    });
    
    if (provider.name === 'contentstack-brandkit' && process.env.CONTENTSTACK_DELIVERY_API && process.env.CONTENTSTACK_API_KEY && process.env.CONTENTSTACK_DELIVERY_TOKEN) {
      console.log('Using CDA approach for brands');
      const items = await fetchCdaEntries('brands');
      console.log('Brands items received:', items.length);
      if (items.length > 0) {
        console.log('First brand item:', JSON.stringify(items[0], null, 2));
      }
      
      if (items && items.length > 0) {
        for (const item of items) {
          try {
            const brandMapping = transformCdaBrandData(item);
            console.log('Transformed brand mapping:', brandMapping);
            if (brandMapping) {
              addBrandMapping(brandMapping);
              result.brandsUpdated++;
            }
          } catch (error: any) {
            result.errors.push(`Failed to process CDA brand entry ${item.uid || item.title || ''}: ${error.message}`);
          }
        }
      }
      // if no items, try fallback JSON
      if (result.brandsUpdated === 0) {
        const fallback = await loadFallbackBrandkit();
        if (fallback?.brandMappings) {
          for (const mapping of fallback.brandMappings) {
            addBrandMapping(mapping as any);
            result.brandsUpdated++;
          }
        }
      }
    } else {
      const extraHeaders: any = {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      };

      // If a Contentstack organization UID is provided, include it for Contentstack provider requests
      if (process.env.CONTENTSTACK_ORGANIZATION_UID && provider.name === 'contentstack-brandkit') {
        extraHeaders['X-Contentstack-Organization-Uid'] = process.env.CONTENTSTACK_ORGANIZATION_UID;
      }

      // If the Contentstack stack API key and delivery token are available, include them for compatibility
      if (provider.name === 'contentstack-brandkit') {
        if (process.env.CONTENTSTACK_API_KEY) extraHeaders['api_key'] = process.env.CONTENTSTACK_API_KEY;
        if (process.env.CONTENTSTACK_DELIVERY_TOKEN) extraHeaders['access_token'] = process.env.CONTENTSTACK_DELIVERY_TOKEN;
      }

      // Discover working endpoint path for brands (some providers use org-scoped or different paths)
      const brandsUrl = await discoverProviderEndpoint(provider, ['brands', 'brandkits/brands', 'brand-kits/brands', 'brand-kits/' + (process.env.CONTENTSTACK_ORGANIZATION_UID || '' ) + '/brands']);
      const response = await axios.get(brandsUrl, {
        headers: extraHeaders,
        timeout: 10000
      });

      if (response.data && Array.isArray(response.data.brands)) {
        for (const brandData of response.data.brands) {
          try {
            const brandMapping = transformExternalBrandData(brandData);
            if (brandMapping) {
              // Add or update brand mapping
              addBrandMapping(brandMapping);
              result.brandsUpdated++;
            }
          } catch (error: any) {
            result.errors.push(`Failed to process brand ${brandData.name}: ${error.message}`);
          }
        }
      }
    }

  } catch (error: any) {
    result.errors.push(`Failed to fetch brands from ${provider.name}: ${error.message}`);
  }

  return result;
}

// Sync banned phrases from external provider
async function syncBannedPhrasesFromProvider(
  provider: ExternalBrandkitProvider,
  requestId?: string
): Promise<{ bannedPhrasesUpdated: number; errors: string[] }> {
  const result: { bannedPhrasesUpdated: number; errors: string[] } = { bannedPhrasesUpdated: 0, errors: [] };

  try {
    // Use CDA for banned phrases if available
    if (provider.name === 'contentstack-brandkit' && process.env.CONTENTSTACK_DELIVERY_API && process.env.CONTENTSTACK_API_KEY && process.env.CONTENTSTACK_DELIVERY_TOKEN) {
      const items = await fetchCdaEntries('banned_phrases');
      if (items && items.length > 0) {
        for (const item of items) {
          try {
            const bannedPhrase = transformCdaBannedPhrase(item);
            if (bannedPhrase) {
              addBannedPhrase(bannedPhrase);
              result.bannedPhrasesUpdated++;
            }
          } catch (error: any) {
            result.errors.push(`Failed to process CDA banned phrase ${item.uid || item.title || ''}: ${error.message}`);
          }
        }
      }
      if (result.bannedPhrasesUpdated === 0) {
        const fallback = await loadFallbackBrandkit();
        if (fallback?.bannedPhrases) {
          for (const p of fallback.bannedPhrases) {
            addBannedPhrase(p as any);
            result.bannedPhrasesUpdated++;
          }
        }
      }
    } else {
      const extraHeaders2: any = {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      };
      if (process.env.CONTENTSTACK_ORGANIZATION_UID && provider.name === 'contentstack-brandkit') {
        extraHeaders2['X-Contentstack-Organization-Uid'] = process.env.CONTENTSTACK_ORGANIZATION_UID;
      }
      if (provider.name === 'contentstack-brandkit') {
        if (process.env.CONTENTSTACK_API_KEY) extraHeaders2['api_key'] = process.env.CONTENTSTACK_API_KEY;
        if (process.env.CONTENTSTACK_DELIVERY_TOKEN) extraHeaders2['access_token'] = process.env.CONTENTSTACK_DELIVERY_TOKEN;
      }

      const bannedUrl = await discoverProviderEndpoint(provider, ['banned-phrases', 'brandkits/banned-phrases', 'brand-kits/banned-phrases', 'brand-kits/' + (process.env.CONTENTSTACK_ORGANIZATION_UID || '') + '/banned-phrases']);
      const response = await axios.get(bannedUrl, {
        headers: extraHeaders2,
        timeout: 10000
      });

      if (response.data && Array.isArray(response.data.phrases)) {
        for (const phraseData of response.data.phrases) {
          try {
            const bannedPhrase = transformExternalBannedPhraseData(phraseData);
            if (bannedPhrase) {
              addBannedPhrase(bannedPhrase);
              result.bannedPhrasesUpdated++;
            }
          } catch (error: any) {
            result.errors.push(`Failed to process banned phrase ${phraseData.phrase}: ${error.message}`);
          }
        }
      }
    }

  } catch (error: any) {
    result.errors.push(`Failed to fetch banned phrases from ${provider.name}: ${error.message}`);
  }

  return result;
}

// Sync tone/style rules from external provider
async function syncToneRulesFromProvider(
  provider: ExternalBrandkitProvider,
  requestId?: string
): Promise<{ toneRulesUpdated: number; errors: string[] }> {
  const result: { toneRulesUpdated: number; errors: string[] } = { toneRulesUpdated: 0, errors: [] };

  try {
    // Use CDA for tone rules if available
    if (provider.name === 'contentstack-brandkit' && process.env.CONTENTSTACK_DELIVERY_API && process.env.CONTENTSTACK_API_KEY && process.env.CONTENTSTACK_DELIVERY_TOKEN) {
      const items = await fetchCdaEntries('tone_rules');
      if (items && items.length > 0) {
        for (const item of items) {
          try {
            const toneRule = transformCdaToneRule(item);
            if (toneRule) {
              addToneStyleRule(toneRule);
              result.toneRulesUpdated++;
            }
          } catch (error: any) {
            result.errors.push(`Failed to process CDA tone rule ${item.uid || item.title || ''}: ${error.message}`);
          }
        }
      }
      if (result.toneRulesUpdated === 0) {
        const fallback = await loadFallbackBrandkit();
        if (fallback?.toneStyleRules) {
          for (const r of fallback.toneStyleRules) {
            addToneStyleRule(r as any);
            result.toneRulesUpdated++;
          }
        }
      }
    } else {
      const extraHeaders3: any = {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      };
      if (process.env.CONTENTSTACK_ORGANIZATION_UID && provider.name === 'contentstack-brandkit') {
        extraHeaders3['X-Contentstack-Organization-Uid'] = process.env.CONTENTSTACK_ORGANIZATION_UID;
      }
      if (provider.name === 'contentstack-brandkit') {
        if (process.env.CONTENTSTACK_API_KEY) extraHeaders3['api_key'] = process.env.CONTENTSTACK_API_KEY;
        if (process.env.CONTENTSTACK_DELIVERY_TOKEN) extraHeaders3['access_token'] = process.env.CONTENTSTACK_DELIVERY_TOKEN;
      }

      const toneUrl = await discoverProviderEndpoint(provider, ['tone-rules', 'brandkits/tone-rules', 'brand-kits/tone-rules', 'brand-kits/' + (process.env.CONTENTSTACK_ORGANIZATION_UID || '') + '/tone-rules']);
      const response = await axios.get(toneUrl, {
        headers: extraHeaders3,
        timeout: 10000
      });

      if (response.data && Array.isArray(response.data.rules)) {
        for (const ruleData of response.data.rules) {
          try {
            const toneRule = transformExternalToneRuleData(ruleData);
            if (toneRule) {
              addToneStyleRule(toneRule);
              result.toneRulesUpdated++;
            }
          } catch (error: any) {
            result.errors.push(`Failed to process tone rule ${ruleData.ruleId}: ${error.message}`);
          }
        }
      }
    }

  } catch (error: any) {
    result.errors.push(`Failed to fetch tone rules from ${provider.name}: ${error.message}`);
  }

  return result;
}

// Transform external brand data to internal format
function transformExternalBrandData(data: any): BrandMapping | null {
  try {
    if (!data.name || !data.aliases || !Array.isArray(data.aliases)) {
      return null;
    }

    return {
      brandName: data.name,
      aliases: data.aliases,
      domains: data.domains || [],
      confidence: Math.min(Math.max(data.confidence || 0.8, 0), 1),
      lastUpdated: new Date(),
      products: (data.products || []).map((product: any) => ({
        productName: product.name,
        aliases: product.aliases || [],
        category: product.category || "general",
        brandOwner: data.name,
        confidence: Math.min(Math.max(product.confidence || 0.8, 0), 1),
        suggestedReplacements: product.suggestedReplacements || []
      }))
    };
  } catch (error: any) {
    logger.error("Failed to transform external brand data", {
      error: error.message,
      data: JSON.stringify(data)
    });
    return null;
  }
}

// Transform external banned phrase data to internal format
function transformExternalBannedPhraseData(data: any): BannedPhrase | null {
  try {
    if (!data.phrase || !data.category) {
      return null;
    }

    return {
      phrase: data.phrase,
      category: data.category,
      severity: data.severity || "medium",
      suggestedReplacement: data.suggestedReplacement,
      reason: data.reason || "External brandkit rule",
      lastUpdated: new Date(),
      isActive: data.isActive !== false
    };
  } catch (error: any) {
    logger.error("Failed to transform external banned phrase data", {
      error: error.message,
      data: JSON.stringify(data)
    });
    return null;
  }
}

// Transform external tone rule data to internal format
function transformExternalToneRuleData(data: any): ToneStyleRule | null {
  try {
    if (!data.ruleId || !data.name || !data.pattern) {
      return null;
    }

    return {
      ruleId: data.ruleId,
      name: data.name,
      description: data.description || "",
      pattern: data.pattern,
      tone: data.tone || "professional",
      style: data.style || "concise",
      severity: data.severity || "medium",
      suggestedFix: data.suggestedFix || "",
      isActive: data.isActive !== false
    };
  } catch (error: any) {
    logger.error("Failed to transform external tone rule data", {
      error: error.message,
      data: JSON.stringify(data)
    });
    return null;
  }
}

// Get external provider status
export function getExternalProviderStatus(): Array<{
  name: string;
  enabled: boolean;
  configured: boolean;
  baseUrl: string;
}> {
  return EXTERNAL_PROVIDERS.map(provider => ({
    name: provider.name,
    enabled: provider.enabled,
    configured: !!(provider.apiKey && provider.baseUrl),
    baseUrl: provider.baseUrl
  }));
}

// Discover the first responsive endpoint for a list of candidate paths under provider.baseUrl
async function discoverProviderEndpoint(provider: ExternalBrandkitProvider, candidates: string[]): Promise<string> {
  for (const candidate of candidates) {
    const url = provider.baseUrl.replace(/\/+$/,'') + '/' + candidate.replace(/^\/+/, '');
    try {
      const resp = await axios.head(url, { timeout: 5000 });
      if (resp.status >= 200 && resp.status < 400) return url;
    } catch (err) {
      // ignore and try next
    }
  }

  // Fallback to base + first candidate (if provided) otherwise just baseUrl
  if (candidates && candidates.length > 0) {
    const first = candidates[0] || '';
    return provider.baseUrl.replace(/\/+$/,'') + '/' + first.replace(/^\/+/, '');
  }
  return provider.baseUrl;
}

// Test connection to external provider
export async function testExternalProviderConnection(
  providerName: string,
  requestId?: string
): Promise<{ success: boolean; error?: string }> {
  const provider = EXTERNAL_PROVIDERS.find(p => p.name === providerName);
  
  if (!provider) {
    return { success: false, error: "Provider not found" };
  }

  if (!provider.enabled) {
    return { success: false, error: "Provider is disabled" };
  }

  try {
    const response = await axios.get(`${provider.baseUrl}/health`, {
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    return { success: response.status === 200 };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message 
    };
  }
}

// Schedule automatic sync (for future implementation)
export function scheduleAutomaticSync(intervalMinutes: number = 60): void {
  logger.info("Scheduling automatic brandkit sync", { 
    intervalMinutes 
  });
  
  // This would be implemented with a proper job scheduler
  // For now, just log the intention
  setInterval(async () => {
    try {
      await syncExternalBrandkitData();
    } catch (error: any) {
      logger.error("Automatic sync failed", { error: error.message });
    }
  }, intervalMinutes * 60 * 1000);
}

// Fetch CDA entries for a content type uid (handles simple pagination)
export async function fetchCdaEntries(contentTypeUid: string): Promise<any[]> {
  const base = (process.env.CONTENTSTACK_DELIVERY_API || '').replace(/\/+$/,'');
  if (!base) {
    console.log('No CONTENTSTACK_DELIVERY_API found');
    return [];
  }

  const apiKey = process.env.CONTENTSTACK_API_KEY;
  const accessToken = process.env.CONTENTSTACK_DELIVERY_TOKEN;
  const environment = 'development'; // Use environment name instead of UID

  console.log('CDA fetch parameters:', { base, apiKey: !!apiKey, accessToken: !!accessToken, environment, contentTypeUid });

  if (!apiKey || !accessToken) {
    console.log('Missing API key or access token');
    return [];
  }

  const limit = 100;
  let skip = 0;
  let all: any[] = [];

  while (true) {
    const url = `${base}/v3/content_types/${encodeURIComponent(contentTypeUid)}/entries?environment=${encodeURIComponent(environment)}&limit=${limit}&skip=${skip}`;
    console.log('Fetching CDA entries from:', url);
    
    try {
      const resp = await axios.get(url, {
        headers: {
          api_key: apiKey,
          access_token: accessToken
        },
        timeout: 10000
      });

      console.log('CDA response status:', resp.status);
      console.log('CDA full response:', JSON.stringify(resp.data, null, 2));
      console.log('CDA response data structure:', { 
        hasData: !!resp.data, 
        hasEntries: !!(resp.data && resp.data.entries), 
        entriesLength: resp.data?.entries?.length || 0,
        total: resp.data?.count || 0
      });

      if (resp.data && Array.isArray(resp.data.entries)) {
        all = all.concat(resp.data.entries);
        const count = resp.data.entries.length || 0;
        console.log(`Fetched ${count} entries, total so far: ${all.length}`);
        if (count < limit) break;
        skip += count;
      } else {
        console.log('No entries found in response or invalid structure');
        break;
      }
    } catch (err) {
      const e: any = err;
      console.error('CDA fetch failed:', e?.message || String(e));
      console.error('Response:', e?.response?.data);
      logger.debug('CDA fetch failed', { url, err: e?.message || String(e) });
      break;
    }
  }

  console.log(`Total CDA entries fetched for ${contentTypeUid}:`, all.length);
  return all;
}

// Extract text from Rich Text field
function extractRichTextContent(richTextField: any): string[] {
  if (!richTextField) return [];
  
  // Handle JSON string
  if (typeof richTextField === 'string') {
    try {
      richTextField = JSON.parse(richTextField);
    } catch {
      return [richTextField]; // Return as-is if not JSON
    }
  }
  
  // Handle Rich Text structure (Contentstack format)
  if (richTextField.type === 'doc' && richTextField.children) {
    const extractText = (node: any): string[] => {
      if (typeof node === 'string') return [node];
      if (node.text) return [node.text];
      if (node.children && Array.isArray(node.children)) {
        return node.children.flatMap(extractText);
      }
      return [];
    };
    
    const texts = richTextField.children.flatMap(extractText).filter(Boolean);
    console.log('Extracted Rich Text content:', { original: richTextField, extracted: texts });
    return texts;
  }
  
  // Handle array of strings
  if (Array.isArray(richTextField)) {
    return richTextField.map(String).filter(Boolean);
  }
  
  // Handle plain text
  if (typeof richTextField === 'string') {
    return [richTextField];
  }
  
  // Handle object with text property
  if (richTextField.text) {
    return [richTextField.text];
  }
  
  console.log('Unhandled Rich Text format:', richTextField);
  return [];
}

// Transform CDA brand entry
function transformCdaBrandData(entry: any): BrandMapping | null {
  try {
    console.log('Transforming CDA brand entry:', JSON.stringify(entry, null, 2));
    
    const f = entry.fields || entry;
    const name = f.canonical_name || f.name || f.brandName || f.title || f.brand_name;
    
    console.log('Brand name found:', name);
    console.log('Raw fields:', { aliases: f.aliases, domains: f.domains, products: f.products });
    
    const aliases = extractRichTextContent(f.aliases);
    const domains = extractRichTextContent(f.domains);
    const products = extractRichTextContent(f.products);

    console.log('Extracted data:', { name, aliases, domains, products });

    if (!name) {
      console.log('No brand name found, skipping entry');
      return null;
    }

    const brandMapping = {
      brandName: name,
      aliases: aliases,
      domains: domains,
      confidence: 0.9,
      lastUpdated: new Date(),
      products: products.map((productName: string) => ({
        productName: productName,
        aliases: [],
        category: 'general',
        brandOwner: name,
        confidence: 0.8,
        suggestedReplacements: []
      }))
    };
    
    console.log('Final brand mapping:', brandMapping);
    return brandMapping;
  } catch (err) {
    const e: any = err;
    console.error('Failed to transform CDA brand:', e?.message || String(e), entry);
    logger.error('Failed to transform CDA brand', { err: e?.message || String(e), entry });
    return null;
  }
}

// Transform CDA banned phrase
function transformCdaBannedPhrase(entry: any): BannedPhrase | null {
  try {
    console.log('Transforming CDA banned phrase entry:', JSON.stringify(entry, null, 2));
    
    const f = entry.fields || entry;
    const phrase = f.phrase || f.text || f.name;
    
    console.log('Banned phrase found:', phrase);
    
    if (!phrase) {
      console.log('No phrase found, skipping entry');
      return null;
    }
    
    const bannedPhrase = {
      phrase,
      category: (f.category || 'brand_conflict') as any,
      severity: (f.severity || 'medium') as any,
      suggestedReplacement: f.suggestedReplacement || f.replacement || undefined,
      reason: f.reason || 'Imported from CDA',
      lastUpdated: new Date(),
      isActive: f.isActive !== false
    };
    
    console.log('Final banned phrase:', bannedPhrase);
    return bannedPhrase;
  } catch (err) {
    const e: any = err;
    console.error('Failed to transform CDA banned phrase:', e?.message || String(e), entry);
    logger.error('Failed to transform CDA banned phrase', { err: e?.message || String(e), entry });
    return null;
  }
}

// Transform CDA tone rule
function transformCdaToneRule(entry: any): ToneStyleRule | null {
  try {
    console.log('Transforming CDA tone rule entry:', JSON.stringify(entry, null, 2));
    
    const f = entry.fields || entry;
    const ruleId = entry.uid || f.ruleId || f.id || f.name;
    
    console.log('Tone rule ID found:', ruleId);
    console.log('Pattern found:', f.pattern);
    
    if (!ruleId || !f.pattern) {
      console.log('Missing ruleId or pattern, skipping entry');
      return null;
    }
    
    const toneRule = {
      ruleId: String(ruleId),
      name: f.name || f.title || 'tone-rule',
      description: f.description || '',
      pattern: f.pattern,
      tone: (f.tone || 'professional') as any,
      style: (f.style || 'concise') as any,
      severity: (f.severity || 'medium') as any,
      suggestedFix: f.suggestedFix || f.fix || '',
      isActive: f.isActive !== false
    };
    
    console.log('Final tone rule:', toneRule);
    return toneRule;
  } catch (err) {
    const e: any = err;
    console.error('Failed to transform CDA tone rule:', e?.message || String(e), entry);
    logger.error('Failed to transform CDA tone rule', { err: e?.message || String(e), entry });
    return null;
  }
}

// Load fallback JSON from disk
async function loadFallbackBrandkit(): Promise<any | null> {
  try {
    const p = 'server/data/brandkit-fallback.json';
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    const e: any = err;
    logger.debug('No fallback brandkit found', { err: e?.message || String(e) });
    return null;
  }
}
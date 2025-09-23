import axios from "axios";
import fs from "fs/promises";
import { logger } from "../utils/logger.js";
import type {
  BrandMapping,
  BannedPhrase,
  ToneStyleRule
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
// Only Contentstack CDA provider is supported in this streamlined service
const EXTERNAL_PROVIDERS: ExternalBrandkitProvider[] = [
  {
    name: "contentstack-brandkit",
    baseUrl: (process.env.CONTENTSTACK_DELIVERY_API || "").replace(/\/+$/,'') || "",
    apiKey: process.env.CONTENTSTACK_API_KEY || "",
    enabled: !!(process.env.CONTENTSTACK_DELIVERY_API && process.env.CONTENTSTACK_API_KEY && process.env.CONTENTSTACK_DELIVERY_TOKEN)
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

  logger.info("Starting Contentstack brandkit sync", { requestId });

  const provider = EXTERNAL_PROVIDERS.find(p => p.name === 'contentstack-brandkit');
  if (!provider || !provider.enabled) {
    const msg = 'Contentstack provider not configured (missing CONTENTSTACK_* env vars)';
    logger.warn(msg, { requestId });
    return { ...result, success: false, errors: [msg] };
  }

  try {
    // Brands
    const brands = await fetchCdaEntries('brands');
    for (const entry of brands) {
      try {
        const mapping = transformCdaBrandData(entry);
        if (mapping) {
          addBrandMapping(mapping);
          result.brandsUpdated++;
        }
      } catch (e: any) {
        result.errors.push(`Failed to process brand entry: ${e?.message || String(e)}`);
      }
    }

    // Banned phrases
    const banned = await fetchCdaEntries('banned_phrases');
    for (const entry of banned) {
      try {
        const p = transformCdaBannedPhrase(entry);
        if (p) {
          addBannedPhrase(p);
          result.bannedPhrasesUpdated++;
        }
      } catch (e: any) {
        result.errors.push(`Failed to process banned phrase entry: ${e?.message || String(e)}`);
      }
    }

    // Tone/style rules
    const tones = await fetchCdaEntries('tone_rules');
    for (const entry of tones) {
      try {
        const r = transformCdaToneRule(entry);
        if (r) {
          addToneStyleRule(r);
          result.toneRulesUpdated++;
        }
      } catch (e: any) {
        result.errors.push(`Failed to process tone rule entry: ${e?.message || String(e)}`);
      }
    }

    if (result.brandsUpdated > 0 || result.bannedPhrasesUpdated > 0 || result.toneRulesUpdated > 0) {
      updateBrandkitConfig({});
    }

  } catch (err: any) {
    logger.error('Contentstack sync failed', { requestId, error: err?.message || String(err) });
    result.success = false;
    result.errors.push(err?.message || String(err));
  }

  logger.info('Contentstack sync completed', { requestId, ...result });
  return result;
}

// Legacy multi-provider sync helpers removed; this module focuses on Contentstack CDA

// Transform external brand data to internal format
// External-format transforms removed - CDA-specific transforms are used below

// Get external provider status
export function getExternalProviderStatus(): Array<{ name: string; enabled: boolean; configured: boolean; baseUrl: string }> {
  return EXTERNAL_PROVIDERS.map(provider => ({
    name: provider.name,
    enabled: provider.enabled,
    configured: !!(provider.baseUrl && provider.apiKey),
    baseUrl: provider.baseUrl
  }));
}

// Test connection to external provider (keeps simple health check for Contentstack CDA)
export async function testExternalProviderConnection(
  providerName: string,
  requestId?: string
): Promise<{ success: boolean; error?: string }> {
  const provider = EXTERNAL_PROVIDERS.find(p => p.name === providerName);
  if (!provider) return { success: false, error: 'Provider not found' };
  if (!provider.enabled) return { success: false, error: 'Provider disabled or not configured' };

  // For Contentstack CDA, a lightweight check is to fetch zero-limit entries for content_types
  try {
    const base = provider.baseUrl;
    const apiKey = process.env.CONTENTSTACK_API_KEY;
    const accessToken = process.env.CONTENTSTACK_DELIVERY_TOKEN;
    if (!base || !apiKey || !accessToken) return { success: false, error: 'Missing CDA env vars' };

    const url = `${base}/v3/content_types?limit=1`;
    const resp = await axios.get(url, { headers: { api_key: apiKey, access_token: accessToken }, timeout: 5000 });
    return { success: resp.status >= 200 && resp.status < 300 };
  } catch (err: any) {
    return { success: false, error: err?.response?.data || err?.message || String(err) };
  }
}

// Schedule automatic sync (for future implementation)
export function scheduleAutomaticSync(intervalMinutes: number = 60): void {
  logger.info('Scheduling automatic brandkit sync', { intervalMinutes });
  setInterval(async () => {
    try {
      await syncExternalBrandkitData();
    } catch (error: any) {
      logger.error('Automatic sync failed', { error: error?.message || String(error) });
    }
  }, intervalMinutes * 60 * 1000);
}

// Fetch CDA entries for a content type uid (handles simple pagination)
export async function fetchCdaEntries(contentTypeUid: string): Promise<any[]> {
  const base = (process.env.CONTENTSTACK_DELIVERY_API || '').replace(/\/+$/,'');
  if (!base) {
    logger.warn('No CONTENTSTACK_DELIVERY_API configured');
    return [];
  }

  const apiKey = process.env.CONTENTSTACK_API_KEY;
  const accessToken = process.env.CONTENTSTACK_DELIVERY_TOKEN;
  const environment = process.env.CONTENTSTACK_ENVIRONMENT || 'development';

  logger.debug('CDA fetch parameters', { base, apiKey: !!apiKey, accessToken: !!accessToken, environment, contentTypeUid });

  if (!apiKey || !accessToken) {
    logger.warn('Missing CONTENTSTACK API key or delivery token');
    return [];
  }

  const limit = 100;
  let skip = 0;
  let all: any[] = [];

  while (true) {
    const url = `${base}/v3/content_types/${encodeURIComponent(contentTypeUid)}/entries?environment=${encodeURIComponent(environment)}&limit=${limit}&skip=${skip}`;
    logger.debug('Fetching CDA entries from', { url });

    try {
      const resp = await axios.get(url, {
        headers: {
          api_key: apiKey,
          access_token: accessToken
        },
        timeout: 10000
      });

      if (resp.data && Array.isArray(resp.data.entries)) {
        all = all.concat(resp.data.entries);
        const count = resp.data.entries.length || 0;
        if (count < limit) break;
        skip += count;
      } else {
        logger.debug('No entries found in CDA response', { contentTypeUid, url });
        break;
      }
    } catch (err) {
      const e: any = err;
      logger.debug('CDA fetch failed', { url, err: e?.message || String(e), response: e?.response?.data });
      break;
    }
  }

  logger.info(`CDA entries fetched for ${contentTypeUid}`, { count: all.length });
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
  
        // Unhandled Rich Text format
  return [];
}

// Transform CDA brand entry
function transformCdaBrandData(entry: any): BrandMapping | null {
  try {
    logger.debug('Transforming CDA brand entry', { uid: entry.uid || entry._uid || null });
    const f = entry.fields || entry;
    const name = f.canonical_name || f.name || f.brandName || f.title || f.brand_name;
    const aliases = extractRichTextContent(f.aliases);
    const domains = extractRichTextContent(f.domains);
    const products = extractRichTextContent(f.products);

    if (!name) return null;

    const brandMapping = {
      brandName: name,
      aliases,
      domains,
      confidence: 0.9,
      lastUpdated: new Date(),
      products: products.map((productName: string) => ({
        productName,
        aliases: [],
        category: 'general',
        brandOwner: name,
        confidence: 0.8,
        suggestedReplacements: []
      }))
    };
    return brandMapping;
  } catch (err) {
    const e: any = err;
    logger.error('Failed to transform CDA brand', { err: e?.message || String(e), entry });
    return null;
  }
}

// Transform CDA banned phrase
function transformCdaBannedPhrase(entry: any): BannedPhrase | null {
  try {
    logger.debug('Transforming CDA banned phrase entry', { uid: entry.uid || null });
    const f = entry.fields || entry;
    const phrase = f.phrase || f.text || f.name;
    if (!phrase) return null;
    const bannedPhrase = {
      phrase,
      category: (f.category || 'brand_conflict') as any,
      severity: (f.severity || 'medium') as any,
      suggestedReplacement: f.suggestedReplacement || f.replacement || undefined,
      reason: f.reason || 'Imported from CDA',
      lastUpdated: new Date(),
      isActive: f.isActive !== false
    };
    return bannedPhrase;
  } catch (err) {
    const e: any = err;
    logger.error('Failed to transform CDA banned phrase', { err: e?.message || String(e), entry });
    return null;
  }
}

// Transform CDA tone rule
function transformCdaToneRule(entry: any): ToneStyleRule | null {
  try {
    logger.debug('Transforming CDA tone rule entry', { uid: entry.uid || null });
    const f = entry.fields || entry;
    const ruleId = entry.uid || f.ruleId || f.id || f.name;
    if (!ruleId || !f.pattern) return null;
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
    return toneRule;
  } catch (err) {
    const e: any = err;
    logger.error('Failed to transform CDA tone rule', { err: e?.message || String(e), entry });
    return null;
  }
}
// No local fallback loader - rely on Contentstack CDA
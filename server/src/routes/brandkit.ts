import { Router } from "express";
import type { Request, Response } from "express";
import { logger } from "../utils/logger.js";
import { 
  generateBrandkitSuggestions,
  getBrandkitConfig,
  updateBrandkitConfig,
  addBrandMapping,
  addBannedPhrase,
  addToneStyleRule,
  removeBrandMapping,
  removeBannedPhrase,
  removeToneStyleRule,
  getBrandkitCacheStatus,
  type BrandkitSuggestion,
  type BrandMapping,
  type BannedPhrase,
  type ToneStyleRule
} from "../services/brandkitService.js";
import { 
  analyzeTone,
  analyzeStyle,
  generateToneStyleSuggestions,
  type ToneAnalysis,
  type StyleAnalysis
} from "../services/aiService.js";
import { 
  syncExternalBrandkitData,
  getExternalProviderStatus,
  testExternalProviderConnection,
  type BrandkitSyncResult
} from "../services/externalBrandkitService.js";

const router = Router();

// Generate brandkit suggestions for text content
router.post("/suggestions", async (req: Request, res: Response) => {
  const requestId = req.headers["x-request-id"] as string;
  
  try {
    const { text, context } = req.body;
    
    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Text content is required"
      });
    }

    logger.info("Generating brandkit suggestions", {
      requestId,
      textLength: text.length,
      context: context?.contentTypeUid
    });

    const suggestions = await generateBrandkitSuggestions(text, context, requestId);
    
    res.json({
      success: true,
      data: {
        suggestions,
        count: suggestions.length,
        textLength: text.length,
        context: context || {}
      }
    });

  } catch (error: any) {
    logger.error("Brandkit suggestions generation failed", {
      requestId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to generate brandkit suggestions",
      details: error.message
    });
  }
});

// Analyze tone of text content
router.post("/analyze-tone", async (req: Request, res: Response) => {
  const requestId = req.headers["x-request-id"] as string;
  
  try {
    const { text, context } = req.body;
    
    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Text content is required"
      });
    }

    logger.info("Analyzing tone", {
      requestId,
      textLength: text.length,
      targetTone: context?.targetTone
    });

    const analysis = await analyzeTone(text, context, requestId);
    
    res.json({
      success: true,
      data: analysis
    });

  } catch (error: any) {
    logger.error("Tone analysis failed", {
      requestId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to analyze tone",
      details: error.message
    });
  }
});

// Analyze writing style of text content
router.post("/analyze-style", async (req: Request, res: Response) => {
  const requestId = req.headers["x-request-id"] as string;
  
  try {
    const { text, context } = req.body;
    
    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Text content is required"
      });
    }

    logger.info("Analyzing style", {
      requestId,
      textLength: text.length,
      targetStyle: context?.targetStyle
    });

    const analysis = await analyzeStyle(text, context, requestId);
    
    res.json({
      success: true,
      data: analysis
    });

  } catch (error: any) {
    logger.error("Style analysis failed", {
      requestId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to analyze style",
      details: error.message
    });
  }
});

// Generate comprehensive tone and style suggestions
router.post("/tone-style-suggestions", async (req: Request, res: Response) => {
  const requestId = req.headers["x-request-id"] as string;
  
  try {
    const { text, context } = req.body;
    
    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Text content is required"
      });
    }

    logger.info("Generating tone and style suggestions", {
      requestId,
      textLength: text.length,
      targetTone: context?.targetTone,
      targetStyle: context?.targetStyle
    });

    const suggestions = await generateToneStyleSuggestions(text, context, requestId);
    
    res.json({
      success: true,
      data: {
        suggestions,
        count: suggestions.length,
        textLength: text.length,
        context: context || {}
      }
    });

  } catch (error: any) {
    logger.error("Tone and style suggestions generation failed", {
      requestId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to generate tone and style suggestions",
      details: error.message
    });
  }
});

// Get brandkit configuration
router.get("/config", (req: Request, res: Response) => {
  try {
    const config = getBrandkitConfig();
    
    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    logger.error("Failed to get brandkit config", {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to get brandkit configuration",
      details: error.message
    });
  }
});

// Update brandkit configuration
router.put("/config", (req: Request, res: Response) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({
        success: false,
        error: "Configuration data is required"
      });
    }

    updateBrandkitConfig(config);
    
    res.json({
      success: true,
      message: "Brandkit configuration updated successfully"
    });
  } catch (error: any) {
    logger.error("Failed to update brandkit config", {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to update brandkit configuration",
      details: error.message
    });
  }
});

// Add brand mapping
router.post("/brands", (req: Request, res: Response) => {
  try {
    const { mapping } = req.body;
    
    if (!mapping || typeof mapping !== "object") {
      return res.status(400).json({
        success: false,
        error: "Brand mapping data is required"
      });
    }

    addBrandMapping(mapping as BrandMapping);
    
    res.json({
      success: true,
      message: "Brand mapping added successfully"
    });
  } catch (error: any) {
    logger.error("Failed to add brand mapping", {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to add brand mapping",
      details: error.message
    });
  }
});

// Remove brand mapping
router.delete("/brands/:brandName", (req: Request, res: Response) => {
  try {
    const { brandName } = req.params;
    
    if (!brandName) {
      return res.status(400).json({
        success: false,
        error: "Brand name is required"
      });
    }
    
    const success = removeBrandMapping(decodeURIComponent(brandName));
    
    if (success) {
      res.json({
        success: true,
        message: "Brand mapping removed successfully"
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Brand mapping not found"
      });
    }
  } catch (error: any) {
    logger.error("Failed to remove brand mapping", {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to remove brand mapping",
      details: error.message
    });
  }
});

// Add banned phrase
router.post("/banned-phrases", (req: Request, res: Response) => {
  try {
    const { phrase } = req.body;
    
    if (!phrase || typeof phrase !== "object") {
      return res.status(400).json({
        success: false,
        error: "Banned phrase data is required"
      });
    }

    addBannedPhrase(phrase as BannedPhrase);
    
    res.json({
      success: true,
      message: "Banned phrase added successfully"
    });
  } catch (error: any) {
    logger.error("Failed to add banned phrase", {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to add banned phrase",
      details: error.message
    });
  }
});

// Remove banned phrase
router.delete("/banned-phrases/:phrase", (req: Request, res: Response) => {
  try {
    const { phrase } = req.params;
    
    if (!phrase) {
      return res.status(400).json({
        success: false,
        error: "Phrase is required"
      });
    }
    
    const success = removeBannedPhrase(decodeURIComponent(phrase));
    
    if (success) {
      res.json({
        success: true,
        message: "Banned phrase removed successfully"
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Banned phrase not found"
      });
    }
  } catch (error: any) {
    logger.error("Failed to remove banned phrase", {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to remove banned phrase",
      details: error.message
    });
  }
});

// Add tone/style rule
router.post("/tone-rules", (req: Request, res: Response) => {
  try {
    const { rule } = req.body;
    
    if (!rule || typeof rule !== "object") {
      return res.status(400).json({
        success: false,
        error: "Tone/style rule data is required"
      });
    }

    addToneStyleRule(rule as ToneStyleRule);
    
    res.json({
      success: true,
      message: "Tone/style rule added successfully"
    });
  } catch (error: any) {
    logger.error("Failed to add tone/style rule", {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to add tone/style rule",
      details: error.message
    });
  }
});

// Remove tone/style rule
router.delete("/tone-rules/:ruleId", (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    
    if (!ruleId) {
      return res.status(400).json({
        success: false,
        error: "Rule ID is required"
      });
    }
    
    const success = removeToneStyleRule(decodeURIComponent(ruleId));
    
    if (success) {
      res.json({
        success: true,
        message: "Tone/style rule removed successfully"
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Tone/style rule not found"
      });
    }
  } catch (error: any) {
    logger.error("Failed to remove tone/style rule", {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to remove tone/style rule",
      details: error.message
    });
  }
});

// Sync external brandkit data
router.post("/sync", async (req: Request, res: Response) => {
  const requestId = req.headers["x-request-id"] as string;
  
  try {
    logger.info("Starting external brandkit sync", { requestId });
    
    const result = await syncExternalBrandkitData(requestId);
    
    res.json({
      success: result.success,
      data: result
    });
  } catch (error: any) {
    logger.error("External brandkit sync failed", {
      requestId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to sync external brandkit data",
      details: error.message
    });
  }
});

// Get external provider status
router.get("/providers", (req: Request, res: Response) => {
  try {
    const providers = getExternalProviderStatus();
    
    res.json({
      success: true,
      data: providers
    });
  } catch (error: any) {
    logger.error("Failed to get external provider status", {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to get external provider status",
      details: error.message
    });
  }
});

// Test external provider connection
router.post("/providers/:providerName/test", async (req: Request, res: Response) => {
  const requestId = req.headers["x-request-id"] as string;
  const { providerName } = req.params;
  
  if (!providerName) {
    return res.status(400).json({
      success: false,
      error: "Provider name is required"
    });
  }
  
  try {
    const result = await testExternalProviderConnection(decodeURIComponent(providerName), requestId);
    
    res.json({
      success: result.success,
      data: result
    });
  } catch (error: any) {
    logger.error("Provider connection test failed", {
      requestId,
      providerName,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to test provider connection",
      details: error.message
    });
  }
});

// Test CDA connection and fetch sample data
router.get("/test-cda", async (req: Request, res: Response) => {
  const requestId = req.headers["x-request-id"] as string;
  
  try {
    console.log('Testing CDA connection...');
    
    // Test environment variables
    const envCheck = {
      CONTENTSTACK_DELIVERY_API: !!process.env.CONTENTSTACK_DELIVERY_API,
      CONTENTSTACK_API_KEY: !!process.env.CONTENTSTACK_API_KEY,
      CONTENTSTACK_DELIVERY_TOKEN: !!process.env.CONTENTSTACK_DELIVERY_TOKEN,
      CONTENTSTACK_ENVIRONMENT: process.env.CONTENTSTACK_ENVIRONMENT
    };
    
    console.log('Environment check:', envCheck);
    
    // Test fetching brands
    const { fetchCdaEntries } = await import("../services/externalBrandkitService.js");
    const brands = await fetchCdaEntries('brands');
    const bannedPhrases = await fetchCdaEntries('banned_phrases');
    const toneRules = await fetchCdaEntries('tone_rules');
    
    res.json({
      success: true,
      data: {
        environment: envCheck,
        brands: {
          count: brands.length,
          sample: brands[0] || null
        },
        bannedPhrases: {
          count: bannedPhrases.length,
          sample: bannedPhrases[0] || null
        },
        toneRules: {
          count: toneRules.length,
          sample: toneRules[0] || null
        }
      }
    });
  } catch (error: any) {
    console.error('CDA test failed:', error);
    res.status(500).json({
      success: false,
      error: "CDA test failed",
      details: error.message
    });
  }
});

// Get brandkit cache status
router.get("/status", (req: Request, res: Response) => {
  try {
    const status = getBrandkitCacheStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    logger.error("Failed to get brandkit status", {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to get brandkit status",
      details: error.message
    });
  }
});

export default router;
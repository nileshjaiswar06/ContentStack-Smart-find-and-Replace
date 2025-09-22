import { Router } from "express";
import type { Request, Response } from "express";
import { logger } from "../utils/logger.js";
import {
  generateBrandkitSuggestions,
  getBrandkitCacheStatus
} from "../services/brandkitService.js";
import {
  analyzeTone
} from "../services/aiService.js";
import {
  syncExternalBrandkitData,
  getExternalProviderStatus
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

// Skip brandkit configuration and admin routes - content managed in Contentstack CMS

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

// Note: provider test endpoint removed (test-only).

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
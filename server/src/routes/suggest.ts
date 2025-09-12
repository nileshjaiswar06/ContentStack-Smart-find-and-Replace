import { Router, type Request, type Response } from "express";
import { suggestReplacementsForText, type ReplacementSuggestion } from "../services/suggestionService.js";
import { logger } from "../utils/logger.js";
import { asyncHandler } from "../middlewares/errorHandler.js";

const router = Router();

// Single text suggestion endpoint
router.post("/", asyncHandler(async (req: Request, res: Response) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      ok: false,
      error: "Text is required and must be a string"
    });
  }

  if (text.length > 50000) {
    return res.status(400).json({
      ok: false,
      error: "Text too long. Maximum 50,000 characters allowed"
    });
  }

  try {
    logger.info("Generating replacement suggestions", { textLength: text.length });
    
    const suggestions = await suggestReplacementsForText(text);
    
    logger.info("Suggestions generated", { 
      textLength: text.length, 
      suggestionCount: suggestions.length 
    });

    return res.json({
      ok: true,
      data: {
        suggestions,
        textLength: text.length,
        suggestionCount: suggestions.length
      }
    });
  } catch (error: any) {
    logger.error("Error generating suggestions", { 
      error: error.message, 
      textLength: text.length 
    });
    
    return res.status(500).json({
      ok: false,
      error: "Failed to generate suggestions"
    });
  }
}));

// Batch suggestions endpoint
router.post("/batch", asyncHandler(async (req: Request, res: Response) => {
  const { texts } = req.body;

  if (!Array.isArray(texts)) {
    return res.status(400).json({
      ok: false,
      error: "Texts must be an array"
    });
  }

  if (texts.length === 0) {
    return res.status(400).json({
      ok: false,
      error: "At least one text is required"
    });
  }

  if (texts.length > 20) {
    return res.status(400).json({
      ok: false,
      error: "Maximum 20 texts allowed per batch"
    });
  }

  // Validate each text
  for (let i = 0; i < texts.length; i++) {
    if (typeof texts[i] !== 'string') {
      return res.status(400).json({
        ok: false,
        error: `Text at index ${i} must be a string`
      });
    }
    if (texts[i].length > 50000) {
      return res.status(400).json({
        ok: false,
        error: `Text at index ${i} is too long. Maximum 50,000 characters allowed`
      });
    }
  }

  try {
    logger.info("Generating batch replacement suggestions", { 
      batchSize: texts.length,
      totalLength: texts.reduce((sum, text) => sum + text.length, 0)
    });

    const results = await Promise.all(
      texts.map(async (text, index) => {
        try {
          const suggestions = await suggestReplacementsForText(text);
          return {
            index,
            text,
            suggestions,
            suggestionCount: suggestions.length
          };
        } catch (error: any) {
          logger.error("Error processing text in batch", { 
            index, 
            error: error.message 
          });
          return {
            index,
            text,
            suggestions: [],
            suggestionCount: 0,
            error: "Failed to process this text"
          };
        }
      })
    );

    const totalSuggestions = results.reduce((sum, result) => sum + result.suggestionCount, 0);
    
    logger.info("Batch suggestions generated", { 
      batchSize: texts.length,
      totalSuggestions,
      successCount: results.filter(r => !r.error).length
    });

    return res.json({
      ok: true,
      data: {
        results,
        batchSize: texts.length,
        totalSuggestions,
        successCount: results.filter(r => !r.error).length
      }
    });
  } catch (error: any) {
    logger.error("Error generating batch suggestions", { 
      error: error.message, 
      batchSize: texts.length 
    });
    
    return res.status(500).json({
      ok: false,
      error: "Failed to generate batch suggestions"
    });
  }
}));

// Health check for suggestions service
router.get("/health", (_req: Request, res: Response) => {
  res.json({ 
    status: "ok", 
    service: "suggestions",
    timestamp: new Date().toISOString() 
  });
});

export default router;
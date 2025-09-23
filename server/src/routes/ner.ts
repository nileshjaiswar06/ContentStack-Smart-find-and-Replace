import { Router } from "express";
import expressRateLimit, { ipKeyGenerator }  from "express-rate-limit";
import { extractEntities, extractEntitiesBatch, checkNerHealth } from "../services/nerProxy.js";
import { extractNamedEntitiesFromText, extractEntitiesWithCanonicalMapping } from "../services/nerService.js";
import { logger } from "../utils/logger.js";

const router = Router();

// NER-specific rate limiter (more restrictive than general read/write)
const nerRateLimiter = expressRateLimit({
  windowMs: Number(process.env.NER_RATE_LIMIT_WINDOW_MS || 60_000), // 1 minute
  max: Number(process.env.NER_RATE_LIMIT_MAX || 30), // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "NER rate limit exceeded" },
  keyGenerator: (req) => {
    // ipKeyGenerator expects the ip string and optional ipv6Subnet; wrap to accept Request
    const ip = (req as any).ip || 'unknown';
    try {
      return (ipKeyGenerator as any)(ip);
    } catch (e) {
      return String(ip);
    }
  }
});

// Apply rate limiting to all NER routes
router.use(nerRateLimiter);

// Single text NER endpoint
router.post("/", async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { text, model = 'en_core_web_trf', min_confidence = 0.7 } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        ok: false, 
        error: "Missing or invalid 'text' field" 
      });
    }

    if (text.length > 10000) {
      return res.status(400).json({ 
        ok: false, 
        error: "Text too long (max 10,000 characters)" 
      });
    }

    let result;
    let usedFallback = false;
    
    // Check if mock mode is enabled
    if (process.env.USE_FAKE_NER === 'true') {
      logger.info("Using fake NER mode");
      result = { 
        entities: extractNamedEntitiesFromText(text).map(e => ({
          text: e.text,
          label: e.type.toUpperCase(),
          start: 0,
          end: e.text.length,
          confidence: 0.8
        })),
        model_used: "compromise_fallback",
        processing_time_ms: Date.now() - startTime,
        text_length: text.length,
        entity_count: 0
      };
      usedFallback = true;
    } else {
      try {
        // Try spacy-service first
        const requestId = (req as any).requestId;
        result = await extractEntities(text, model, min_confidence, requestId);
        logger.info(`Spacy-service processed text (${text.length} chars) in ${result.processing_time_ms}ms using ${result.model_used}`);
      } catch (spacyError) {
        logger.warn(`Spacy-service failed, trying enhanced NER: ${spacyError}`);
        try {
          // Fallback to enhanced NER service
          const requestId = (req as any).requestId;
          const enhancedResult = await extractEntitiesWithCanonicalMapping(text, requestId);
          // Convert to expected format for backwards compatibility
          result = {
            entities: enhancedResult.entities.map(e => ({
              text: e.text,
              label: e.originalLabel || e.type.toUpperCase(),
              start: 0, // Position info lost in canonical mapping
              end: e.text.length,
              confidence: e.confidence || 0.8,
              canonical_type: e.type,
              source: e.source
            })),
            model_used: enhancedResult.model_used,
            processing_time_ms: enhancedResult.processing_time_ms,
            text_length: enhancedResult.text_length,
            entity_count: enhancedResult.entity_count
          };
          logger.info(`Enhanced NER processed text (${text.length} chars) in ${result.processing_time_ms}ms using ${result.model_used}`);
        } catch (enhancedError) {
          logger.warn(`Enhanced NER failed, using basic fallback: ${enhancedError}`);
          result = { 
            entities: extractNamedEntitiesFromText(text).map(e => ({
              text: e.text,
              label: e.type.toUpperCase(),
              start: 0,
              end: e.text.length,
              confidence: 0.8
            })),
            model_used: "compromise_fallback",
            processing_time_ms: Date.now() - startTime,
            text_length: text.length,
            entity_count: 0,
            fallback: true
          };
          usedFallback = true;
        }
      }
    }

    result.entity_count = result.entities?.length || 0;
    
    logger.debug(`NER request completed: ${result.entity_count} entities, fallback: ${usedFallback}`);
    res.json(result);
  } catch (err) {
    const processingTime = Date.now() - startTime;
    logger.error(`NER request failed after ${processingTime}ms: ${err}`);
    next(err);
  }
});

// Batch NER endpoint
router.post("/batch", async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { texts, model = 'en_core_web_trf', min_confidence = 0.7 } = req.body;
    
    if (!Array.isArray(texts)) {
      return res.status(400).json({ 
        ok: false, 
        error: "Missing or invalid 'texts' array" 
      });
    }

    if (texts.length > 100) {
      return res.status(400).json({ 
        ok: false, 
        error: "Too many texts (max 100)" 
      });
    }

    if (texts.some(t => typeof t !== 'string' || t.length > 10000)) {
      return res.status(400).json({ 
        ok: false, 
        error: "Invalid text in batch (max 10,000 chars each)" 
      });
    }

    let result;
    let usedFallback = false;

    if (process.env.USE_FAKE_NER === 'true') {
      logger.info(`Using fake NER mode for batch of ${texts.length} texts`);
      result = {
        results: texts.map(text => ({
          entities: extractNamedEntitiesFromText(text).map(e => ({
            text: e.text,
            label: e.type.toUpperCase(),
            start: 0,
            end: e.text.length,
            confidence: 0.8
          })),
          model_used: "compromise_fallback",
          text_length: text.length,
          entity_count: 0
        })),
        processing_time_ms: Date.now() - startTime,
        batch_size: texts.length
      };
      usedFallback = true;
    } else {
      try {
        // Try spacy-service first
        result = await extractEntitiesBatch(texts, model, min_confidence);
        logger.info(`Spacy-service batch processed ${texts.length} texts in ${Date.now() - startTime}ms`);
      } catch (spacyError) {
        logger.warn(`Spacy-service batch failed, using fallback: ${spacyError}`);
        result = {
          results: texts.map(text => ({
            entities: extractNamedEntitiesFromText(text).map(e => ({
              text: e.text,
              label: e.type.toUpperCase(),
              start: 0,
              end: e.text.length,
              confidence: 0.8
            })),
            model_used: "compromise_fallback",
            text_length: text.length,
            entity_count: 0
          })),
          processing_time_ms: Date.now() - startTime,
          batch_size: texts.length,
          fallback: true
        };
        usedFallback = true;
      }
    }

    // Add entity counts
    if (result.results) {
      result.results.forEach(r => {
        r.entity_count = r.entities?.length || 0;
      });
    }

    logger.debug(`Batch NER completed: ${texts.length} texts, fallback: ${usedFallback}`);
    res.json(result);
  } catch (err) {
    const processingTime = Date.now() - startTime;
    logger.error(`Batch NER request failed after ${processingTime}ms: ${err}`);
    next(err);
  }
});

// Health check endpoint for NER service
router.get("/health", async (req, res) => {
  const startTime = Date.now();
  const healthCheck: any = {
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "ner",
    checks: {
      spacy_service: { status: "unknown", latency_ms: 0 },
      fallback_service: { status: "ok", available: true },
      mock_mode: process.env.USE_FAKE_NER === 'true'
    }
  };

  try {
    if (process.env.USE_FAKE_NER === 'true') {
      healthCheck.checks.spacy_service.status = "disabled";
      res.json(healthCheck);
      return;
    }

    // Test spacy-service health
    const spacyHealth = await checkNerHealth();
    if (spacyHealth.healthy) {
      healthCheck.checks.spacy_service.status = "ok";
      healthCheck.checks.spacy_service.latency_ms = spacyHealth.latency || 0;
      healthCheck.checks.spacy_service.details = spacyHealth.details;
    } else {
      healthCheck.status = "degraded";
      healthCheck.checks.spacy_service.status = "error";
      healthCheck.checks.spacy_service.error = spacyHealth.error;
    }
    
    logger.debug(`NER health check completed: spacy=${healthCheck.checks.spacy_service.status}`);
  } catch (error) {
    healthCheck.status = "degraded";
    healthCheck.checks.spacy_service.status = "error";
    healthCheck.checks.spacy_service.latency_ms = Date.now() - startTime;
    healthCheck.checks.spacy_service.error = String(error);
    
    logger.warn(`NER health check failed: ${error}`);
  }

  const statusCode = healthCheck.status === "ok" ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

export default router;

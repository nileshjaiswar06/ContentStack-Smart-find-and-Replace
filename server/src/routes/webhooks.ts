import { Router } from "express";
import type { Request, Response } from "express";
import { logger } from "../utils/logger.js";
import { syncExternalBrandkitData } from "../services/externalBrandkitService.js";
import crypto from "crypto";

const router = Router();

// Webhook signature verification middleware
function verifyWebhookSignature(req: Request, res: Response, next: any) {
  const signature = req.get('x-contentstack-signature');
  const webhookSecret = process.env.CONTENTSTACK_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    logger.warn("Webhook secret not configured, skipping signature verification");
    return next();
  }
  
  if (!signature) {
    logger.warn("Webhook signature missing");
    return res.status(401).json({ success: false, error: "Missing signature" });
  }
  
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');
  
  const providedSignature = signature.replace('sha256=', '');
  
  if (crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(providedSignature, 'hex')
  )) {
    next();
  } else {
    logger.warn("Webhook signature verification failed", {
      expected: expectedSignature,
      provided: providedSignature
    });
    res.status(401).json({ success: false, error: "Invalid signature" });
  }
}

/**
 * POST /webhooks/entry
 * Handle entry-related webhooks from Contentstack
 * Triggers real-time brandkit sync when brand-related content changes
 */
router.post("/entry", verifyWebhookSignature, async (req: Request, res: Response) => {
  try {
    const { event, data } = req.body;
    
    logger.info("Entry webhook received", {
      event,
      content_type: data?.content_type?.uid,
      entry_uid: data?.entry?.uid,
      environment: data?.environment?.name
    });

    // Check if this is a brand-related content type
    const brandContentTypes = ['brands', 'banned_phrases', 'tone_rules'];
    const contentTypeUid = data?.content_type?.uid;
    
    if (!brandContentTypes.includes(contentTypeUid)) {
      logger.debug("Non-brand content type, skipping sync", { contentTypeUid });
      return res.json({ success: true, message: "Non-brand content, no sync needed" });
    }

    // Trigger brandkit sync for brand-related changes
    if (['entry.create', 'entry.update', 'entry.delete', 'entry.publish', 'entry.unpublish'].includes(event)) {
      logger.info("Brand-related content changed, triggering sync", {
        event,
        contentTypeUid,
        entryUid: data?.entry?.uid
      });
      
      try {
        const syncResult = await syncExternalBrandkitData();
        logger.info("Real-time brandkit sync completed", syncResult);
        
        res.json({
          success: true,
          message: "Brandkit sync triggered",
          event,
          contentTypeUid,
          syncResult
        });
      } catch (syncError: any) {
        logger.error("Real-time brandkit sync failed", {
          error: syncError.message,
          event,
          contentTypeUid
        });
        
        res.status(500).json({
          success: false,
          error: "Brandkit sync failed",
          details: syncError.message
        });
      }
    } else {
      res.json({ success: true, message: "Event not relevant for brandkit sync" });
    }
  } catch (error: any) {
    logger.error("Entry webhook error", { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: "Webhook processing failed",
      details: error.message 
    });
  }
});

/**
 * POST /webhooks/asset
 * Handle asset-related webhooks from Contentstack
 * Currently not used for brandkit sync but available for future use
 */
router.post("/asset", verifyWebhookSignature, async (req: Request, res: Response) => {
  try {
    const { event, data } = req.body;
    
    logger.info("Asset webhook received", {
      event,
      asset_uid: data?.asset?.uid,
      environment: data?.environment?.name
    });

    // Assets don't typically affect brandkit data, but we can log for monitoring
    res.json({ 
      success: true, 
      message: "Asset webhook processed",
      event,
      assetUid: data?.asset?.uid
    });
  } catch (error: any) {
    logger.error("Asset webhook error", { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: "Asset webhook processing failed",
      details: error.message 
    });
  }
});

/**
 * POST /webhooks/publish
 * Handle publish-related webhooks from Contentstack
 * Triggers brandkit sync when brand content is published
 */
router.post("/publish", verifyWebhookSignature, async (req: Request, res: Response) => {
  try {
    const { event, data } = req.body;
    
    logger.info("Publish webhook received", {
      event,
      content_type: data?.content_type?.uid,
      entry_uid: data?.entry?.uid,
      environment: data?.environment?.name
    });

    // Check if this is a brand-related content type
    const brandContentTypes = ['brands', 'banned_phrases', 'tone_rules'];
    const contentTypeUid = data?.content_type?.uid;
    
    if (!brandContentTypes.includes(contentTypeUid)) {
      logger.debug("Non-brand content published, skipping sync", { contentTypeUid });
      return res.json({ success: true, message: "Non-brand content, no sync needed" });
    }

    // Trigger brandkit sync for published brand content
    logger.info("Brand content published, triggering sync", {
      contentTypeUid,
      entryUid: data?.entry?.uid,
      environment: data?.environment?.name
    });
    
    try {
      const syncResult = await syncExternalBrandkitData();
      logger.info("Publish-triggered brandkit sync completed", syncResult);
      
      res.json({
        success: true,
        message: "Brandkit sync triggered by publish",
        contentTypeUid,
        entryUid: data?.entry?.uid,
        syncResult
      });
    } catch (syncError: any) {
      logger.error("Publish-triggered brandkit sync failed", {
        error: syncError.message,
        contentTypeUid,
        entryUid: data?.entry?.uid
      });
      
      res.status(500).json({
        success: false,
        error: "Brandkit sync failed",
        details: syncError.message
      });
    }
  } catch (error: any) {
    logger.error("Publish webhook error", { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: "Publish webhook processing failed",
      details: error.message 
    });
  }
});

/**
 * POST /webhooks/automate
 * Handle Automate-triggered webhooks
 * This endpoint can be used by Contentstack Automate for custom workflows
 */
router.post("/automate", verifyWebhookSignature, async (req: Request, res: Response) => {
  try {
    const { trigger, data, workflow } = req.body;
    
    logger.info("Automate webhook received", {
      trigger,
      workflow: workflow?.name,
      data: data ? Object.keys(data) : null
    });

    let result: any = { success: true };

    switch (trigger) {
      case 'brandkit_sync':
        // Trigger brandkit sync
        const syncResult = await syncExternalBrandkitData();
        result = { 
          success: true, 
          trigger: 'brandkit_sync', 
          data: syncResult 
        };
        break;
        
      case 'content_analysis':
        // Analyze content for brand compliance
        if (data?.text) {
          // This would integrate with your content analysis service
          result = { 
            success: true, 
            trigger: 'content_analysis',
            data: { 
              text: data.text,
              analysis: "Content analysis would be performed here",
              suggestions: []
            }
          };
        } else {
          result = { success: false, error: 'No text provided for analysis' };
        }
        break;
        
      case 'bulk_replace':
        // Perform bulk find and replace operation
        if (data?.entries && data?.replacements) {
          // This would integrate with your apply service
          result = { 
            success: true, 
            trigger: 'bulk_replace',
            data: { 
              entries: data.entries,
              replacements: data.replacements,
              status: "Bulk replace operation would be performed here"
            }
          };
        } else {
          result = { success: false, error: 'Missing entries or replacements data' };
        }
        break;
        
      default:
        result = { success: false, error: `Unknown trigger: ${trigger}` };
    }

    res.json(result);
  } catch (error: any) {
    logger.error("Automate webhook error", { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: "Automate webhook processing failed",
      details: error.message 
    });
  }
});

/**
 * GET /webhooks/status
 * Health check endpoint for webhooks
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const status = {
      webhooks: {
        entry: { enabled: true, path: "/api/webhooks/entry" },
        asset: { enabled: true, path: "/api/webhooks/asset" },
        publish: { enabled: true, path: "/api/webhooks/publish" },
        automate: { enabled: true, path: "/api/webhooks/automate" }
      },
      security: {
        signature_verification: !!process.env.CONTENTSTACK_WEBHOOK_SECRET,
        webhook_secret_configured: !!process.env.CONTENTSTACK_WEBHOOK_SECRET
      },
      brandkit: {
        real_time_sync: true,
        content_types: ["brands", "banned_phrases", "tone_rules"],
        last_sync: new Date().toISOString()
      }
    };

    res.json({ success: true, data: status });
  } catch (error: any) {
    logger.error("Webhook status error", { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: "Failed to get webhook status",
      details: error.message 
    });
  }
});

export default router;
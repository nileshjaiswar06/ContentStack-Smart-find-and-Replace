import { Router, type Request, type Response } from "express";
import { fetchEntriesOfContentType, fetchEntryDraft, updateEntry } from "../services/contentstackService.js";
import { buildRegex } from "../utils/text.js";
import { deepReplace } from "../utils/deepReplace.js";
import { changeCount } from "../utils/diffPreview.js";
import { logger } from "../utils/logger.js";
import { extractEntities } from "../services/nerProxy.js";
import type { ReplacementRule } from "../types.js";
import cloneDeep from "lodash.clonedeep";

const router = Router();

// Root endpoint with documentation
router.get("/", (_req, res) => {
  res.status(400).json({
    ok: false,
    error: "Invalid endpoint",
    endpoints: [
      "GET    /:contentTypeUid - List entries of a content type",
      "POST   /preview - Preview changes before applying",
      "PUT    /apply - Apply changes to an entry",
      "POST   /bulk-preview - Preview changes for multiple entries",
      "PUT    /bulk-apply - Apply changes to multiple entries"
    ]
  });
});

// List entries of a content type
router.get("/:contentTypeUid", async (req, res) => {
  const { contentTypeUid } = req.params;
  
  if (!contentTypeUid) {
    return res.status(400).json({ 
      ok: false, 
      error: "Content Type UID is required" 
    });
  }

  try {
    const data = await fetchEntriesOfContentType(contentTypeUid);
    return res.json({ 
      ok: true, 
      data: {
        entries: data.entries || [],
        count: data.count || 0,
        contentTypeUid
      } 
    });
  } catch (error: any) {
    console.error(`Error fetching entries for ${contentTypeUid}:`, error);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error_message || 
                   error.message || 
                   'Failed to fetch entries';
    
    return res.status(status).json({ 
      ok: false, 
      error: message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Preview changes for a single entry
 * @body {Object} - Request body
 * @body {Object} target - Target entry information
 * @body {string} target.contentTypeUid - UID of the content type
 * @body {string} target.entryUid - UID of the entry
 * @body {ReplacementRule} rule - Replacement rule to apply
 * @returns {Object} - Preview of changes with before/after comparison
 */
router.post("/preview", async (req: Request, res: Response) => {
  const { target, rule } = req.body as {
    target?: { contentTypeUid?: string; entryUid?: string };
    rule?: ReplacementRule;
  };

  // Input validation
  if (!target?.contentTypeUid || !target?.entryUid) {
    return res.status(400).json({ 
      ok: false, 
      error: "Target object with contentTypeUid and entryUid is required" 
    });
  }
  
  if (!rule?.find || rule.replace === undefined) {
    return res.status(400).json({ 
      ok: false, 
      error: "Rule object with find and replace properties is required" 
    });
  }

  const { contentTypeUid, entryUid } = target;
  
  try {
  // Fetch the latest draft
  logger.info(`[Preview] Fetching draft for ${contentTypeUid}/${entryUid}`);
  const before = await fetchEntryDraft(contentTypeUid, entryUid);
    
    // Build regex from rule
    const rx = buildRegex(rule.find, rule.mode ?? "literal", {
      caseSensitive: rule.caseSensitive ?? false,
      wholeWord: rule.wholeWord ?? true,
    });

    // Apply replacements
    const { result: after, replacedCount } = deepReplace(cloneDeep(before), rx, rule.replace);
    
    // Calculate changes
    const changes = changeCount(before, after);
    const totalChanges = changes.reduce((sum, { count }) => sum + count, 0);
    
    logger.info(`[Preview] Found ${totalChanges} changes in ${contentTypeUid}/${entryUid}`);

    // Optionally enrich preview with NER suggestions
    const enableNer = process.env.ENABLE_NER === 'true';
    let ner: any = undefined;
    if (enableNer) {
      try {
        const text = JSON.stringify(after); // crude: run NER on serialized entry; adapt as needed
        ner = await extractEntities(text);
      } catch (e: any) {
        logger.warn(`NER enrichment failed: ${e.message || e}`);
      }
    }
    
    return res.json({ 
      ok: true, 
      entryUid,
      contentTypeUid,
      changes,
      totalChanges,
      before,
      after,
      replacedCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
  logger.error(`[Preview] Error processing ${contentTypeUid}/${entryUid}: ${error?.message || error}`);
    
    const status = error.response?.status || 500;
    const message = error.response?.data?.error_message || 
                   error.message || 
                   'Failed to generate preview';
    
    return res.status(status).json({
      ok: false,
      error: message,
      entryUid,
      contentTypeUid,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Apply changes to a single entry
 * @body {Object} - Request body
 * @body {Object} target - Target entry information
 * @body {string} target.contentTypeUid - UID of the content type
 * @body {string} target.entryUid - UID of the entry
 * @body {ReplacementRule} rule - Replacement rule to apply
 * @returns {Object} - Result of the update operation
 */
router.put("/apply", async (req: Request, res: Response) => {
  const { target, rule } = req.body as {
    target?: { contentTypeUid?: string; entryUid?: string };
    rule?: ReplacementRule;
  };

  // Input validation
  if (!target?.contentTypeUid || !target?.entryUid) {
    return res.status(400).json({ 
      ok: false, 
      error: "Target object with contentTypeUid and entryUid is required" 
    });
  }
  
  if (!rule?.find || rule.replace === undefined) {
    return res.status(400).json({ 
      ok: false, 
      error: "Rule object with find and replace properties is required" 
    });
  }

  const { contentTypeUid, entryUid } = target;
  
  try {
  logger.info(`[Apply] Starting update for ${contentTypeUid}/${entryUid}`);
    
    // 1. Fetch the latest draft
  logger.info(`[Apply] Fetching draft for ${contentTypeUid}/${entryUid}`);
  const before = await fetchEntryDraft(contentTypeUid, entryUid);
    
    // 2. Build regex from rule
    const rx = buildRegex(rule.find, rule.mode ?? "literal", {
      caseSensitive: rule.caseSensitive ?? false,
      wholeWord: rule.wholeWord ?? true,
    });

    // 3. Apply replacements
    const { result: after, replacedCount } = deepReplace(cloneDeep(before), rx, rule.replace);
    
    // 4. Calculate changes for logging
    const changes = changeCount(before, after);
    const totalChanges = changes.reduce((sum, { count }) => sum + count, 0);
    
    if (totalChanges === 0) {
    logger.info(`[Apply] No changes detected for ${contentTypeUid}/${entryUid}`);
      return res.json({ 
        ok: true, 
        entryUid,
        contentTypeUid,
        changes: [],
        totalChanges: 0,
        message: "No changes were made - content already matches the target state"
      });
    }
    
  logger.info(`[Apply] Found ${totalChanges} changes in ${contentTypeUid}/${entryUid}`);
    
    // 5. Update the entry
  logger.info(`[Apply] Updating entry ${contentTypeUid}/${entryUid}`);
    const updated = await updateEntry(contentTypeUid, entryUid, after);
    
  logger.info(`[Apply] Successfully updated ${contentTypeUid}/${entryUid}`);
    
    return res.json({ 
      ok: true, 
      entryUid,
      contentTypeUid,
      changes,
      totalChanges,
      updated: {
        uid: updated.uid,
        _version: updated._version,
        updated_at: updated.updated_at
      },
      replacedCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
  logger.error(`[Apply] Error updating ${contentTypeUid}/${entryUid}: ${error?.message || error}`);
    
    const status = error.response?.status || 500;
    const message = error.response?.data?.error_message || 
                   error.message || 
                   'Failed to apply changes';
    
    return res.status(status).json({
      ok: false,
      error: message,
      entryUid,
      contentTypeUid,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Bulk preview changes for multiple entries
 * @body {Object} - Request body
 * @body {string} contentTypeUid - UID of the content type
 * @body {string[]} entryUids - Array of entry UIDs to process
 * @body {ReplacementRule} rule - Replacement rule to apply
 * @returns {Object} - Preview of changes for all entries
 */
router.post("/bulk-preview", async (req: Request, res: Response) => {
  const { contentTypeUid, entryUids, rule } = req.body as {
    contentTypeUid?: string;
    entryUids?: string[];
    rule?: ReplacementRule;
  };

  // Input validation
  if (!contentTypeUid) {
    return res.status(400).json({ 
      ok: false, 
      error: "contentTypeUid is required" 
    });
  }

  if (!entryUids || !Array.isArray(entryUids) || entryUids.length === 0) {
    return res.status(400).json({ 
      ok: false, 
      error: "entryUids array is required and must not be empty" 
    });
  }
  
  if (!rule?.find || rule.replace === undefined) {
    return res.status(400).json({ 
      ok: false, 
      error: "Rule object with find and replace properties is required" 
    });
  }

  // Limit bulk operations to prevent overload
  if (entryUids.length > 50) {
    return res.status(400).json({ 
      ok: false, 
      error: "Maximum 50 entries allowed per bulk operation" 
    });
  }

  try {
    logger.info(`Bulk preview: Processing ${entryUids.length} entries in ${contentTypeUid}`);
    const startTime = Date.now();
    
    // Build regex from rule
    const rx = buildRegex(rule.find, rule.mode ?? "literal", {
      caseSensitive: rule.caseSensitive ?? false,
      wholeWord: rule.wholeWord ?? true,
    });

    const results = [];
    let totalChanges = 0;
    let processedCount = 0;

    // Process each entry
    for (const entryUid of entryUids) {
      try {
        const before = await fetchEntryDraft(contentTypeUid, entryUid);
        const { result: after, replacedCount } = deepReplace(cloneDeep(before), rx, rule.replace, {
          updateUrls: rule.updateUrls ?? true,
          updateEmails: rule.updateEmails ?? true
        });
        
        const changes = changeCount(before, after);
        const entryChanges = changes.reduce((sum, { count }) => sum + count, 0);
        
        results.push({
          entryUid,
          changes,
          totalChanges: entryChanges,
          replacedCount,
          before,
          after,
          success: true
        });

        totalChanges += entryChanges;
        processedCount++;
        
        if (entryChanges > 0) {
          logger.debug(`Changes found in ${entryUid}: ${entryChanges} fields updated`);
        }
        
      } catch (error: any) {
        logger.error(`Error in ${entryUid}: ${error.message || 'Unknown error'}`);
        results.push({
          entryUid,
          error: error.message || 'Failed to process entry',
          success: false
        });
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`Bulk preview completed: ${processedCount} entries processed in ${duration}s, ${totalChanges} total changes`);
    
    return res.json({ 
      ok: true, 
      contentTypeUid,
      processedCount,
      totalEntries: entryUids.length,
      totalChanges,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    logger.error(`Bulk preview error for ${contentTypeUid}:`, error);
    
    const status = error.response?.status || 500;
    const message = error.response?.data?.error_message || 
                   error.message || 
                   'Failed to generate bulk preview';
    
    return res.status(status).json({
      ok: false,
      error: message,
      contentTypeUid,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Bulk apply changes to multiple entries
 * @body {Object} - Request body
 * @body {string} contentTypeUid - UID of the content type
 * @body {string[]} entryUids - Array of entry UIDs to process
 * @body {ReplacementRule} rule - Replacement rule to apply
 * @body {boolean} dryRun - If true, only preview without applying changes
 * @returns {Object} - Result of the bulk update operation
 */
router.put("/bulk-apply", async (req: Request, res: Response) => {
  const { contentTypeUid, entryUids, rule, dryRun = false } = req.body as {
    contentTypeUid?: string;
    entryUids?: string[];
    rule?: ReplacementRule;
    dryRun?: boolean;
  };

  // Input validation
  if (!contentTypeUid) {
    return res.status(400).json({ 
      ok: false, 
      error: "contentTypeUid is required" 
    });
  }

  if (!entryUids || !Array.isArray(entryUids) || entryUids.length === 0) {
    return res.status(400).json({ 
      ok: false, 
      error: "entryUids array is required and must not be empty" 
    });
  }
  
  if (!rule?.find || rule.replace === undefined) {
    return res.status(400).json({ 
      ok: false, 
      error: "Rule object with find and replace properties is required" 
    });
  }

  // Limit bulk operations to prevent overload
  if (entryUids.length > 50) {
    return res.status(400).json({ 
      ok: false, 
      error: "Maximum 50 entries allowed per bulk operation" 
    });
  }

  try {
    logger.info(`Bulk ${dryRun ? 'dry-run' : 'apply'}: Processing ${entryUids.length} entries in ${contentTypeUid}`);
    const startTime = Date.now();
    
    // Build regex from rule
    const rx = buildRegex(rule.find, rule.mode ?? "literal", {
      caseSensitive: rule.caseSensitive ?? false,
      wholeWord: rule.wholeWord ?? true,
    });

    const results = [];
    let totalChanges = 0;
    let successCount = 0;
    let errorCount = 0;

    // Process each entry
    for (const entryUid of entryUids) {
      try {
        const before = await fetchEntryDraft(contentTypeUid, entryUid);
        const { result: after, replacedCount } = deepReplace(cloneDeep(before), rx, rule.replace, {
          updateUrls: rule.updateUrls ?? true,
          updateEmails: rule.updateEmails ?? true
        });
        
        const changes = changeCount(before, after);
        const entryChanges = changes.reduce((sum, { count }) => sum + count, 0);
        
        if (entryChanges === 0) {
          results.push({
            entryUid,
            changes: [],
            totalChanges: 0,
            replacedCount: 0,
            success: true,
            message: "No changes needed"
          });
          successCount++;
          continue;
        }

        if (dryRun) {
          results.push({
            entryUid,
            changes,
            totalChanges: entryChanges,
            replacedCount,
            success: true,
            message: "Dry run - no changes applied"
          });
          totalChanges += entryChanges;
          successCount++;
        } else {
          // Apply changes
          const updated = await updateEntry(contentTypeUid, entryUid, after);
          
          results.push({
            entryUid,
            changes,
            totalChanges: entryChanges,
            replacedCount,
            success: true,
            updated: {
              uid: updated.uid,
              _version: updated._version,
              updated_at: updated.updated_at
            }
          });
          
          totalChanges += entryChanges;
          successCount++;
          logger.debug(`Applied ${entryChanges} changes to ${entryUid}`);
        }
        
      } catch (error: any) {
        logger.error(`Error in ${entryUid}: ${error.message || 'Unknown error'}`);
        results.push({
          entryUid,
          error: error.message || 'Failed to process entry',
          success: false
        });
        errorCount++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`Bulk ${dryRun ? 'dry-run' : 'apply'} completed: ${successCount} successful, ${errorCount} errors, ${totalChanges} changes in ${duration}s`);
    
    return res.json({ 
      ok: true, 
      contentTypeUid,
      successCount,
      errorCount,
      totalEntries: entryUids.length,
      totalChanges,
      dryRun,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    logger.error(`Bulk apply error for ${contentTypeUid}:`, error);
    
    const status = error.response?.status || 500;
    const message = error.response?.data?.error_message || 
                   error.message || 
                   'Failed to apply bulk changes';
    
    return res.status(status).json({
      ok: false,
      error: message,
      contentTypeUid,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;

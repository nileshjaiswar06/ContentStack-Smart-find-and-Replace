import { Router, type Request, type Response } from "express";
import { fetchEntriesOfContentType, fetchEntryDraft, updateEntry } from "../services/contentstackService.js";
import path from "path";
import { buildRegex } from "../utils/text.js";
import { deepReplace, processEntry } from "../utils/deepReplace.js";
import { changeCount } from "../utils/diffPreview.js";
import { logger } from "../utils/logger.js";
import { createBatchJob, getJobStatus, loadJobFromDisk } from "../jobs/batchQueue.js";
import { loadSnapshot } from "../services/snapshotService.js";
import { listSnapshots } from "../services/snapshotService.js";
import { extractEntities } from "../services/nerProxy.js";
import { suggestReplacementsForText } from "../services/suggestionService.js";
import { applySuggestionsToDoc, type ApplyOptions } from "../services/applyService.js";
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
      "POST   /preview - Preview changes before applying (includes suggestions + applySuggestions option)",
      "PUT    /apply - Apply changes to an entry (includes applySuggestions option)",
      "POST   /bulk-preview - Preview changes for multiple entries",
      "PUT    /bulk-apply - Apply changes to multiple entries",
      "POST   /suggest - Generate replacement suggestions for text",
      "POST   /suggest/batch - Generate suggestions for multiple texts"
    ]
  });
});

// List available snapshots (placed before the :contentTypeUid param route to avoid param collisions)
router.get("/snapshots", async (_req: Request, res: Response) => {
  try {
    const files = await listSnapshots();
    const items = await Promise.all(files.map(async (p: string) => {
      try {
        const snap = await loadSnapshot(path.basename(p, '.json'));
        if (!snap) return null;
        return {
          id: snap.id,
          contentTypeUid: snap.contentTypeUid,
          entryUid: snap.entryUid,
          createdAt: snap.createdAt,
          description: snap.description
        };
      } catch (e) {
        return null;
      }
    }));

    return res.json({ ok: true, snapshots: items.filter(Boolean) });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: 'Failed to list snapshots', details: err?.message });
  }
});

// List entries of a content type
router.get("/:contentTypeUid", async (req, res) => {
  const { contentTypeUid } = req.params;
  const requestId = (req as any).requestId;
  
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
    logger.error(`Error fetching entries for ${contentTypeUid}: ${error?.message || error}`, requestId);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error_message || 
                   error.message || 
                   'Failed to fetch entries';
    
    return res.status(status).json({ 
      ok: false, 
      error: message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      requestId
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
  const requestId = (req as any).requestId;
  const { target, rule, applySuggestions, suggestionThreshold } = req.body as {
    target?: { contentTypeUid?: string; entryUid?: string };
    rule?: ReplacementRule;
    applySuggestions?: boolean;
    suggestionThreshold?: number;
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
  // Fetch the latest draft with deep content coverage
  logger.info(`[Preview] Fetching draft for ${contentTypeUid}/${entryUid}`, requestId);
  const before = await fetchEntryDraft(contentTypeUid, entryUid, {
    include: 10, // Deep include for components
    include_global: true, // Include global fields
    include_unpublished: true // Include unpublished content
  });
    
    // Build regex from rule
    const rx = buildRegex(rule.find, rule.mode ?? "literal", {
      caseSensitive: rule.caseSensitive ?? false,
      wholeWord: rule.wholeWord ?? true,
    });

  // Apply replacements
  const { result: after, replacedCount } = processEntry(cloneDeep(before), rx, rule.replace, entryUid, undefined, requestId);
    
    // Calculate changes (fields changed)
    const changes = changeCount(before, after);
    const totalChanges = changes.reduce((sum, { count }) => sum + count, 0);

    // Also compute occurrences per top-level field using the same regex
    const occurrencesByField: Array<{ field: string; occurrences: number }> = [];
    let occurrencesTotal = 0;
    try {
      for (const { field } of changes) {
        const beforeVal = JSON.stringify(before?.[field] ?? "");
        const flags = rx.flags.includes("g") ? rx.flags : rx.flags + "g";
        const clone = new RegExp(rx.source, flags);
        const matches = [...beforeVal.matchAll(clone)];
        const occ = matches.length;
        occurrencesByField.push({ field, occurrences: occ });
        occurrencesTotal += occ;
      }
    } catch (e) {
      // Non-fatal; fall back to empty occurrences
      logger.debug(`Failed to compute occurrencesByField: ${String(e)}`);
    }
    
  logger.info(`[Preview] Found ${totalChanges} changes in ${contentTypeUid}/${entryUid}`, requestId);

    // Optionally enrich preview with NER suggestions
    const enableNer = process.env.ENABLE_NER === 'true';
    let ner: any = undefined;
    if (enableNer) {
      try {
        const text = JSON.stringify(after); // crude: run NER on serialized entry; adapt as needed
        ner = await extractEntities(text);
      } catch (e: any) {
        logger.warn(`NER enrichment failed: ${e.message || e}`, requestId);
      }
    }

    // Generate smart replacement suggestions
    let suggestions: any[] = [];
    try {
      const text = JSON.stringify(after);
      const context = {
        contentTypeUid,
        entryUid,
        replacementRule: rule
      };
      suggestions = await suggestReplacementsForText(text, context);
      logger.debug(`Generated ${suggestions.length} replacement suggestions`, {
        contentTypeUid,
        entryUid,
        aiEnabled: process.env.AI_PROVIDER === "gemini",
        requestId
      });
    } catch (e: any) {
      logger.warn(`Suggestion generation failed: ${e.message || e}`, requestId);
    }

    // Apply suggestions if requested
    let appliedSuggestions: any = null;
    if (applySuggestions && suggestions.length > 0) {
      try {
        const applyOptions: ApplyOptions = {
          updateUrls: true,
          updateEmails: true,
          suggestionThreshold: suggestionThreshold ?? 0.5
        };
        
        appliedSuggestions = applySuggestionsToDoc(after, suggestions, applyOptions);
        
        logger.info("Applied suggestions to preview", {
          totalSuggestions: suggestions.length,
          appliedCount: appliedSuggestions.totalReplaced,
          threshold: applyOptions.suggestionThreshold,
          requestId
        });
      } catch (e: any) {
        logger.warn(`Failed to apply suggestions: ${e.message || e}`, requestId);
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
      occurrencesByField,
      occurrencesTotal,
      suggestions,
      ner,
      appliedSuggestions,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
  logger.error(`[Preview] Error processing ${contentTypeUid}/${entryUid}: ${error?.message || error}`, requestId);
    
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
  const requestId = (req as any).requestId;
  const { target, rule, applySuggestions, suggestionThreshold } = req.body as {
    target?: { contentTypeUid?: string; entryUid?: string };
    rule?: ReplacementRule;
    applySuggestions?: boolean;
    suggestionThreshold?: number;
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
  logger.info(`[Apply] Starting update for ${contentTypeUid}/${entryUid}`, requestId);
    
    // 1. Fetch the latest draft with deep content coverage
  logger.info(`[Apply] Fetching draft for ${contentTypeUid}/${entryUid}`, requestId);
  const before = await fetchEntryDraft(contentTypeUid, entryUid, {
    include: 10, // Deep include for components
    include_global: true, // Include global fields
    include_unpublished: true // Include unpublished content
  });
    
    // 2. Build regex from rule
    const rx = buildRegex(rule.find, rule.mode ?? "literal", {
      caseSensitive: rule.caseSensitive ?? false,
      wholeWord: rule.wholeWord ?? true,
    });

  // 3. Apply replacements
  const { result: after, replacedCount } = processEntry(cloneDeep(before), rx, rule.replace, entryUid, undefined, requestId);
    
    // 4. Calculate changes for logging
    const changes = changeCount(before, after);
    const totalChanges = changes.reduce((sum, { count }) => sum + count, 0);
    
  if (totalChanges === 0) {
  logger.info(`[Apply] No changes detected for ${contentTypeUid}/${entryUid}`, requestId);
      return res.json({ 
        ok: true, 
        entryUid,
        contentTypeUid,
        changes: [],
        totalChanges: 0,
        message: "No changes were made - content already matches the target state"
      });
    }
    
  logger.info(`[Apply] Found ${totalChanges} changes in ${contentTypeUid}/${entryUid}`, requestId);

    // 5. Apply suggestions if requested
    let appliedSuggestions: any = null;
    let finalAfter = after;
    if (applySuggestions) {
      try {
        // Generate suggestions for the current state
        const text = JSON.stringify(after);
        const context = {
          contentTypeUid,
          entryUid,
          replacementRule: rule
        };
        const suggestions = await suggestReplacementsForText(text, context, requestId);
        
        if (suggestions.length > 0) {
          const applyOptions: ApplyOptions = {
            updateUrls: true,
            updateEmails: true,
            suggestionThreshold: suggestionThreshold ?? 0.5
          };
          
          appliedSuggestions = applySuggestionsToDoc(after, suggestions, applyOptions);
          finalAfter = appliedSuggestions.after;
          
          logger.info("Applied suggestions during apply", {
            totalSuggestions: suggestions.length,
            appliedCount: appliedSuggestions.totalReplaced,
            threshold: applyOptions.suggestionThreshold,
            requestId
          });
        }
      } catch (e: any) {
        logger.warn(`Failed to apply suggestions during apply: ${e.message || e}`, requestId);
      }
    }
    
    // 6. Update the entry
  logger.info(`[Apply] Updating entry ${contentTypeUid}/${entryUid}`, requestId);
    const updated = await updateEntry(contentTypeUid, entryUid, finalAfter);
    
  logger.info(`[Apply] Successfully updated ${contentTypeUid}/${entryUid}`, requestId);
    
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
      appliedSuggestions,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
  logger.error(`[Apply] Error updating ${contentTypeUid}/${entryUid}: ${error?.message || error}`, requestId);
    
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
  const requestId = (req as any).requestId;
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
  logger.info(`Bulk preview: Processing ${entryUids.length} entries in ${contentTypeUid}`, requestId);
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
        const { result: after, replacedCount } = processEntry(cloneDeep(before), rx, rule.replace, entryUid, {
          updateUrls: rule.updateUrls ?? true,
          updateEmails: rule.updateEmails ?? true
        }, requestId);
        
        const changes = changeCount(before, after);
        const entryChanges = changes.reduce((sum, { count }) => sum + count, 0);

        // compute occurrences for this entry's changed fields
        const occurrencesByField: Array<{ field: string; occurrences: number }> = [];
        let occurrencesForEntry = 0;
        try {
          for (const { field } of changes) {
            const beforeVal = JSON.stringify(before?.[field] ?? "");
            const flags = rx.flags.includes("g") ? rx.flags : rx.flags + "g";
            const clone = new RegExp(rx.source, flags);
            const matches = [...beforeVal.matchAll(clone)];
            const occ = matches.length;
            occurrencesByField.push({ field, occurrences: occ });
            occurrencesForEntry += occ;
          }
        } catch (e) {
          logger.debug(`Failed to compute per-entry occurrences: ${String(e)}`);
        }
        
        results.push({
          entryUid,
          changes,
          totalChanges: entryChanges,
          replacedCount,
          occurrencesByField,
          occurrencesTotal: occurrencesForEntry,
          before,
          after,
          success: true
        });

        totalChanges += entryChanges;
        processedCount++;
        
        if (entryChanges > 0) {
          logger.debug(`Changes found in ${entryUid}: ${entryChanges} fields updated`, requestId);
        }
        
      } catch (error: any) {
        logger.error(`Error in ${entryUid}: ${error.message || 'Unknown error'}`, requestId);
        results.push({
          entryUid,
          error: error.message || 'Failed to process entry',
          success: false
        });
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`Bulk preview completed: ${processedCount} entries processed in ${duration}s, ${totalChanges} total changes`, requestId);
    
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
  const requestId = (req as any).requestId;
  const { contentTypeUid, entryUids, rule, dryRun = false } = req.body;
  if (!contentTypeUid || !entryUids || !Array.isArray(entryUids) || entryUids.length === 0) {
    return res.status(400).json({ ok: false, error: "contentTypeUid and non-empty entryUids are required" });
  }
  if (!rule?.find || typeof rule.replace === "undefined") {
    return res.status(400).json({ ok: false, error: "Rule object with find and replace required" });
  }
  if (entryUids.length > 500) { // increased limit but still protective
    return res.status(400).json({ ok: false, error: "Max entries per batch is 500" });
  }

  try {
  const job = await createBatchJob({ contentTypeUid, entryUids, rule, dryRun });
  logger.info(`Enqueued job ${job.id} for ${contentTypeUid} (${entryUids.length} entries)`, requestId);
  return res.json({ ok: true, jobId: job.id, message: "Job queued. Poll /replace/job/:jobId for status", requestId });
  } catch (err: any) {
  logger.error("Failed to enqueue job", requestId, { err: err?.message || err });
  return res.status(500).json({ ok: false, error: "Failed to enqueue job", requestId });
  }
});

// Job status
router.get("/job/:jobId", async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const jobId = req.params.jobId;
  if (!jobId) return res.status(400).json({ ok: false, error: "jobId param is required" });
  try {
    const job = (await loadJobFromDisk(jobId)) || getJobStatus(jobId);
    if (!job) return res.status(404).json({ ok: false, error: "Job not found" });
    return res.json({ ok: true, job, requestId });
  } catch (err: any) {
    logger.error(`Failed to fetch job ${jobId} status: ${err?.message || err}`, requestId);
    return res.status(500).json({ ok: false, error: "Failed to fetch job status", requestId });
  }
});

// Rollback a job by restoring snapshots (simple file-backed rollback)
router.post("/rollback", async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { snapshotId, dryRun = false } = req.body;
  if (!snapshotId) return res.status(400).json({ ok: false, error: "snapshotId is required" });
  try {
    const snapshot = await loadSnapshot(snapshotId);
    if (!snapshot) return res.status(404).json({ ok: false, error: "Snapshot not found" });
    // Snapshot structure: { id, contentTypeUid, entryUid, data }
    const { contentTypeUid, entryUid, data: before } = snapshot as any;
    if (dryRun) {
      logger.info(`Dry-run rollback for snapshot ${snapshotId} on ${contentTypeUid}/${entryUid}`, requestId);
      return res.json({ ok: true, message: "Dry run - would restore", before, requestId });
    }
    const restored = await updateEntry(contentTypeUid, entryUid, before);
    logger.info(`Restored ${contentTypeUid}/${entryUid} from snapshot ${snapshotId}`, requestId);
    return res.json({ ok: true, message: "Restored", restored: { uid: restored.uid, _version: restored._version }, requestId });
  } catch (err: any) {
    logger.error(`Rollback failed for snapshot ${snapshotId}: ${err?.message || err}`, requestId);
    return res.status(500).json({ ok: false, error: "Rollback failed", details: err?.message, requestId });
  }
});

 

export default router;

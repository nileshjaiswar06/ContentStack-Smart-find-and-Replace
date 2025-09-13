import { fetchEntryDraft, updateEntry } from "../services/contentstackService.js";
import { deepReplace } from "../utils/deepReplace.js";
import { buildRegex } from "../utils/text.js";
import { storeSnapshot, loadSnapshot } from "../services/snapshotService.js";
import { logger } from "../utils/logger.js";

export async function processBatchJob(payload: any, progressCallback: (p: number) => void) {
  const { contentTypeUid, entryUids, rule, dryRun = false } = payload;
  const total = entryUids.length;
  const resultSummary: any[] = [];
  const entryErrors: any[] = [];
  let processed = 0;

  for (const uid of entryUids) {
    try {
      const before = await fetchEntryDraft(contentTypeUid, uid);
      // store snapshot for rollback
      await storeSnapshot({ contentTypeUid, entryUid: uid, before, rule, createdAt: new Date().toISOString() });

      // perform replacements using proper regex building
      const rx = buildRegex(rule.find, rule.mode ?? "literal", {
        caseSensitive: rule.caseSensitive ?? false,
        wholeWord: rule.wholeWord ?? true
      });
      
      const { result: after, replacedCount } = deepReplace(JSON.parse(JSON.stringify(before)), rx, rule.replace, {
        updateUrls: rule.updateUrls ?? true,
        updateEmails: rule.updateEmails ?? true
      });

      if (replacedCount > 0 && !dryRun) {
        // include _version if present to help CMA optimistic lock
        const maybeVersion = before._version ? { _version: before._version } : {};
        const toUpdate = { ...after, ...maybeVersion };
        const updated = await updateEntry(contentTypeUid, uid, toUpdate);
        resultSummary.push({ entryUid: uid, replacedCount, updated: { uid: updated.uid, _version: updated._version }});
      } else {
        resultSummary.push({ entryUid: uid, replacedCount, message: dryRun ? "Dry run - not applied" : "No changes" });
      }
    } catch (err: any) {
      // Extract axios response body if available (Contentstack validation errors live here)
      const axiosData = err?.response?.data;
      const errorMsg = axiosData?.error || axiosData?.message || err?.message || String(err);

      // Log full details in non-production for debugging
      if (process.env.NODE_ENV !== 'production') {
        logger.error({
          msg: `Worker error on ${uid}: ${errorMsg}`,
          entryUid: uid,
          axiosData,
          stack: err?.stack,
        });
      } else {
        logger.error(`Worker error on ${uid}: ${errorMsg}`);
      }

      // Include details in the job result when not in production to aid debugging
      resultSummary.push({ entryUid: uid, error: errorMsg });
      const errorPayload: any = { entryUid: uid, error: errorMsg, timestamp: new Date().toISOString() };
      if (process.env.NODE_ENV !== 'production') {
        errorPayload.axiosData = axiosData;
        errorPayload.stack = err?.stack;
      }
      entryErrors.push(errorPayload);
    }

    processed++;
    progressCallback(Math.round((processed / total) * 100));
  }

  // Return both results and errors for better error surfacing
  return { 
    processed, 
    total, 
    results: resultSummary,
    entryErrors,
    hasErrors: entryErrors.length > 0
  };
}

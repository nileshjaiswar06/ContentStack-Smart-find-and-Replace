import { Router, type Request, type Response } from "express";
import { fetchEntriesOfContentType } from "../services/contentstackService.js";
import { changeCount } from "../utils/diffPreview.js";

const router = Router();

// Test endpoint to fetch entries of a content type
router.get("/", (req: Request, res: Response) => {
  return res.status(400).json({ 
    ok: false, 
    error: "Content Type UID is required" 
  });
});

// Preview changes before applying them
router.post("/preview", async (req: Request, res: Response) => {
  try {
    const { before, after } = req.body;

    if (!before || !after) {
      return res.status(400).json({
        ok: false,
        error: "Both 'before' and 'after' objects are required"
      });
    }

    const summary = changeCount(before, after);
    const totalChanges = summary.reduce((sum, { count }) => sum + count, 0);

    return res.json({
      ok: true,
      before,
      after,
      changes: summary,
      totalChanges
    });
  } catch (e: any) {
    console.error("Error in preview endpoint:", e);
    return res.status(500).json({ 
      ok: false, 
      error: e.message || "Failed to generate preview" 
    });
  }
});

router.get("/:contentTypeUid", async (req: Request, res: Response) => {
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
      data 
    });
  } catch (error: any) {
    console.error(`Error fetching entries for content type ${contentTypeUid}:`, error);
    return res.status(500).json({ 
      ok: false, 
      error: error.message || "Failed to fetch entries" 
    });
  }
});

export default router;

import { Router, type Request, type Response } from "express";
import { fetchEntriesOfContentType } from "../services/contentstackService.js";

const router = Router();

// Test endpoint to fetch entries of a content type
router.get("/", (req: Request, res: Response) => {
  return res.status(400).json({ 
    ok: false, 
    error: "Content Type UID is required" 
  });
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

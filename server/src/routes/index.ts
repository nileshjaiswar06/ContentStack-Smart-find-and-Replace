import { Router } from "express";
import replaceRoutes from "./replace.js";
import brandkitRoutes from "./brandkit.js";
import launchRoutes from "./launch.js";
import webhookRoutes from "./webhooks.js";
import automateRoutes from "./automate.js";

const router = Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    service: "smart-find-replace-server"
  });
});

router.use("/replace", replaceRoutes);
router.use("/brandkit", brandkitRoutes);
router.use("/launch", launchRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/automate", automateRoutes);

export default router;

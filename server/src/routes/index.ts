import { Router } from "express";
import replaceRoutes from "./replace.js";
import brandkitRoutes from "./brandkit.js";

const router = Router();

router.use("/replace", replaceRoutes);
router.use("/brandkit", brandkitRoutes);

export default router;

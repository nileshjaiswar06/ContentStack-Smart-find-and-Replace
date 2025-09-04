import { Router } from "express";
import replaceRoutes from "./replace.js";

const router = Router();

router.use("/replace", replaceRoutes);

export default router;

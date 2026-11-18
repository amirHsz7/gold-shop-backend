import { Router } from "express";
import { getPublicPricingSettings } from "../controllers/pricing-settings.controller.js";

const router = Router();

router.get("/", getPublicPricingSettings);

export default router;
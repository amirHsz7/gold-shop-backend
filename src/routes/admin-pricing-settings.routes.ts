import { Router } from "express";
import { validate } from "../middlewares/validate.middleware.js";
import { pricingSettingsSchema } from "../schemas/pricing-settings.schema.js";
import {
  getAdminPricingSettings,
  updateAdminPricingSettings,
} from "../controllers/pricing-settings.controller.js";

const router = Router();

router.get("/", getAdminPricingSettings);
router.put("/", validate(pricingSettingsSchema), updateAdminPricingSettings);

export default router;
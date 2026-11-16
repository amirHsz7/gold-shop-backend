import { Router } from "express";
import { validate } from "../middlewares/validate.middleware.js";
import { shopInfoSchema } from "../schemas/shop-info.schema.js";
import {
  getAdminShopInfo,
  updateAdminShopInfo,
} from "../controllers/shop-info.controller.js";

const router = Router();

router.get("/", getAdminShopInfo);
router.put("/", validate(shopInfoSchema), updateAdminShopInfo);

export default router;
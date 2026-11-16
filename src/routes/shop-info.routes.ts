import { Router } from "express";
import { getPublicShopInfo } from "../controllers/shop-info.controller.js";

const router = Router();

router.get("/", getPublicShopInfo);

export default router;
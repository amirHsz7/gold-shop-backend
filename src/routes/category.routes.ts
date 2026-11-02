import { Router } from "express";
import { getCategories } from "../controllers/product.controller.js";

const router = Router();

router.get("/", getCategories);

export default router;
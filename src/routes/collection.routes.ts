import { Router } from "express";
import { getCollections } from "../controllers/product.controller.js";

const router = Router();

router.get("/", getCollections);

export default router;
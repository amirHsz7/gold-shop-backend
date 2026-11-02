import { Router } from "express";
import { validateQuery } from "../middlewares/validate-query.middleware.js";
import { listProductsQuerySchema } from "../schemas/product.schema.js";
import { getProduct, getProducts } from "../controllers/product.controller.js";

const router = Router();

router.get("/", validateQuery(listProductsQuerySchema), getProducts);
router.get("/:slug", getProduct);

export default router;
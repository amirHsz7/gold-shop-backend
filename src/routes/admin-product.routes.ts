import { Router } from "express";
import { validate } from "../middlewares/validate.middleware.js";
import { uploadSingleImage } from "../middlewares/upload.middleware.js";
import { validateQuery } from "../middlewares/validate-query.middleware.js";
import {
  createProductSchema,
  listAdminProductsQuerySchema,
  updateProductSchema,
} from "../schemas/admin-product.schema.js";
import {
  addAdminProductImage,
  createAdminProduct,
  deleteAdminProduct,
  deleteAdminProductImage,
  getAdminProduct,
  listAdminProducts,
  updateAdminProduct,
} from "../controllers/admin-product.controller.js";
const router = Router();

// محصول
router.post("/", validate(createProductSchema), createAdminProduct);
router.get("/:id", getAdminProduct);
router.put("/:id", validate(updateProductSchema), updateAdminProduct);
router.delete("/:id", deleteAdminProduct);

router.get("/", validateQuery(listAdminProductsQuerySchema), listAdminProducts);
// عکس‌ها
router.post("/:id/images", uploadSingleImage("image"), addAdminProductImage);
router.delete("/:id/images/:imageId", deleteAdminProductImage);

export default router;
import { Router } from "express";
import { validate } from "../middlewares/validate.middleware.js";
import { uploadSingleImage } from "../middlewares/upload.middleware.js";
import { categorySchema } from "../schemas/admin-category.schema.js";
import {
  createAdminCategory,
  deleteAdminCategory,
  deleteAdminCategoryImage,
  getAdminCategory,
  listAdminCategories,
  setAdminCategoryImage,
  updateAdminCategory,
} from "../controllers/admin-category.controller.js";

const router = Router();

router.get("/", listAdminCategories);
router.post("/", validate(categorySchema), createAdminCategory);
router.get("/:id", getAdminCategory);
router.put("/:id", validate(categorySchema), updateAdminCategory);
router.delete("/:id", deleteAdminCategory);

// عکس دسته‌بندی (فقط یک عکس؛ آپلود جدید جایگزین قبلی می‌شود)
router.put("/:id/image", uploadSingleImage("image"), setAdminCategoryImage);
router.delete("/:id/image", deleteAdminCategoryImage);

export default router;
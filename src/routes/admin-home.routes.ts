import { Router } from "express";
import { validate } from "../middlewares/validate.middleware.js";
import { uploadImageFields } from "../middlewares/upload.middleware.js";
import {
  createSectionSchema,
  homeItemSchema,
  orderSchema,
  toggleSectionSchema,
  updateSectionSchema,
} from "../schemas/admin-home.schema.js";
import {
  createAdminItem,
  createAdminSection,
  deleteAdminItem,
  deleteAdminSection,
  listAdminSections,
  reorderAdminItems,
  reorderAdminSections,
  toggleAdminSection,
  updateAdminItem,
  updateAdminSection,
} from "../controllers/admin-home.controller.js";

const router = Router();

const itemImages = uploadImageFields(["image", "mobileImage"]);

// بخش‌ها (مسیر order باید قبل از :id بیاید)
router.get("/sections", listAdminSections);
router.put("/sections/order", validate(orderSchema), reorderAdminSections);
router.post("/sections", validate(createSectionSchema), createAdminSection);
router.patch("/sections/:id", validate(toggleSectionSchema), toggleAdminSection);
router.put("/sections/:id", validate(updateSectionSchema), updateAdminSection);
router.delete("/sections/:id", deleteAdminSection);

// آیتم‌ها (اسلاید و بنر)؛ multer قبل از validate تا فیلدهای متنی فرم خوانده شوند
router.put("/sections/:id/items/order", validate(orderSchema), reorderAdminItems);
router.post("/sections/:id/items", itemImages, validate(homeItemSchema), createAdminItem);
router.put(
  "/sections/:id/items/:itemId",
  itemImages,
  validate(homeItemSchema),
  updateAdminItem,
);
router.delete("/sections/:id/items/:itemId", deleteAdminItem);

export default router;
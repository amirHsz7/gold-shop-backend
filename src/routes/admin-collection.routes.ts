import { Router } from "express";
import { validate } from "../middlewares/validate.middleware.js";
import { uploadSingleImage } from "../middlewares/upload.middleware.js";
import { collectionSchema } from "../schemas/admin-collection.schema.js";
import {
  createAdminCollection,
  deleteAdminCollection,
  deleteAdminCollectionImage,
  getAdminCollection,
  listAdminCollections,
  setAdminCollectionImage,
  updateAdminCollection,
} from "../controllers/admin-collection.controller.js";

const router = Router();

router.get("/", listAdminCollections);
router.post("/", validate(collectionSchema), createAdminCollection);
router.get("/:id", getAdminCollection);
router.put("/:id", validate(collectionSchema), updateAdminCollection);
router.delete("/:id", deleteAdminCollection);

// عکس کالکشن (فقط یک عکس؛ آپلود جدید جایگزین قبلی می‌شود)
router.put("/:id/image", uploadSingleImage("image"), setAdminCollectionImage);
router.delete("/:id/image", deleteAdminCollectionImage);

export default router;
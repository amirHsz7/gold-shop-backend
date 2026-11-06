import type { RequestHandler, Response } from "express";
import {
  addProductImage,
  createProduct,
  deleteProductImage,
  getProductForAdmin,
  softDeleteProduct,
  updateProduct,
} from "../services/admin-product.service.js";

const errors = {
  PRODUCT_NOT_FOUND: { code: 404, message: "محصول پیدا نشد" },
  IMAGE_NOT_FOUND: { code: 404, message: "تصویر پیدا نشد" },
  VARIANT_NOT_FOUND: {
    code: 400,
    message: "یکی از وزن‌های ارسالی متعلق به این محصول نیست",
  },
  CATEGORY_NOT_FOUND: { code: 400, message: "دسته‌بندی معتبر نیست" },
  COLLECTION_NOT_FOUND: { code: 400, message: "کالکشن معتبر نیست" },
  SLUG_TAKEN: { code: 409, message: "این اسلاگ قبلاً استفاده شده است" },
  SKU_TAKEN: {
    code: 409,
    message: "این کد کالا (SKU) قبلاً استفاده شده است",
  },
  CONFLICT: {
    code: 409,
    message: "مقدار تکراری ثبت شد؛ لطفاً دوباره تلاش کنید",
  },
  TOO_MANY_IMAGES: {
    code: 400,
    message: "حداکثر ۱۰ تصویر برای هر محصول مجاز است",
  },
  INVALID_IMAGE: { code: 400, message: "فایل ارسالی یک تصویر معتبر نیست" },
} as const;

const sendError = (res: Response, reason: keyof typeof errors) => {
  const error = errors[reason];

  res.status(error.code).json({ status: "error", message: error.message });
};

export const getAdminProduct: RequestHandler = async (req, res, next) => {
  try {
    const product = await getProductForAdmin(String(req.params.id));

    if (!product) return sendError(res, "PRODUCT_NOT_FOUND");

    res.status(200).json({ status: "success", data: product });
  } catch (error) {
    next(error);
  }
};

export const createAdminProduct: RequestHandler = async (req, res, next) => {
  try {
    const result = await createProduct(req.body);

    if (!result.ok) return sendError(res, result.reason);

    res.status(201).json({
      status: "success",
      message: "محصول با موفقیت ساخته شد",
      data: result.product,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminProduct: RequestHandler = async (req, res, next) => {
  try {
    const result = await updateProduct(String(req.params.id), req.body);

    if (!result.ok) return sendError(res, result.reason);

    res.status(200).json({
      status: "success",
      message: "محصول با موفقیت ویرایش شد",
      data: result.product,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminProduct: RequestHandler = async (req, res, next) => {
  try {
    const deleted = await softDeleteProduct(String(req.params.id));

    if (!deleted) return sendError(res, "PRODUCT_NOT_FOUND");

    res.status(200).json({ status: "success", message: "محصول حذف شد" });
  } catch (error) {
    next(error);
  }
};

export const addAdminProductImage: RequestHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      res
        .status(400)
        .json({ status: "error", message: "تصویری ارسال نشده است" });
      return;
    }

    // فیلد متنی اختیاری که کنار فایل در فرم ارسال می‌شود
    const alt =
      typeof req.body?.alt === "string"
        ? req.body.alt.trim().slice(0, 200) || undefined
        : undefined;

    const result = await addProductImage(
      String(req.params.id),
      req.file.buffer,
      alt,
    );

    if (!result.ok) return sendError(res, result.reason);

    res.status(201).json({
      status: "success",
      message: "تصویر اضافه شد",
      data: result.image,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminProductImage: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const deleted = await deleteProductImage(
      String(req.params.id),
      String(req.params.imageId),
    );

    if (!deleted) return sendError(res, "IMAGE_NOT_FOUND");

    res.status(200).json({ status: "success", message: "تصویر حذف شد" });
  } catch (error) {
    next(error);
  }
};


// example


// POST http://localhost:5000/admin/products
// Authorization: Bearer <accessToken>
// Content-Type: application/json

// {
//   "name": "انگشتر کارتیه جدید",
//   "slug": "new-cartier-ring",
//   "description": "انگشتر طلای ۱۸ عیار",
//   "categoryId": "<id دسته>",
//   "discountPercent": 0,
//   "isFeatured": true,
//   "variants": [
//     { "weight": 2.56, "fee": 7, "feeAmount": 0, "stock": 4 },
//     { "weight": 2.54, "fee": 7, "feeAmount": 0, "stock": 1 },
//     { "weight": 2.63, "fee": 7, "feeAmount": 0, "stock": 1 },
//     { "weight": 2.5,  "fee": 7, "feeAmount": 0, "stock": 4 }
//   ]
// }
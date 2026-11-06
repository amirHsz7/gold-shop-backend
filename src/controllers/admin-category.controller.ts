import type { RequestHandler, Response } from "express";
import {
  createCategory,
  deleteCategory,
  deleteCategoryImage,
  getCategoryForAdmin,
  listCategoriesForAdmin,
  setCategoryImage,
  updateCategory,
} from "../services/admin-category.service.js";

const errors = {
  NOT_FOUND: { code: 404, message: "دسته‌بندی پیدا نشد" },
  SLUG_TAKEN: { code: 409, message: "این اسلاگ قبلاً استفاده شده است" },
  PARENT_NOT_FOUND: { code: 400, message: "دسته‌ی والد معتبر نیست" },
  PARENT_IS_SELF: {
    code: 400,
    message: "یک دسته‌بندی نمی‌تواند والد خودش باشد",
  },
  PARENT_IS_CHILD: {
    code: 400,
    message: "فقط تا دو سطح دسته‌بندی مجاز است؛ والد نمی‌تواند زیردسته باشد",
  },
  PARENT_INACTIVE: {
    code: 400,
    message: "دسته‌ی والد غیرفعال است؛ ابتدا والد را فعال کنید",
  },
  HAS_CHILDREN_CANNOT_NEST: {
    code: 409,
    message:
      "این دسته زیردسته دارد و نمی‌تواند خودش زیردسته‌ی دسته‌ی دیگری شود",
  },
  HAS_CHILDREN: {
    code: 409,
    message: "این دسته زیردسته دارد؛ ابتدا زیردسته‌ها را حذف یا منتقل کنید",
  },
  HAS_PRODUCTS: {
    code: 409,
    message:
      "این دسته محصول دارد؛ ابتدا محصولات را به دسته‌ی دیگری منتقل کنید",
  },
  INVALID_IMAGE: { code: 400, message: "فایل ارسالی یک تصویر معتبر نیست" },
} as const;

const sendError = (res: Response, reason: keyof typeof errors) => {
  const error = errors[reason];

  res.status(error.code).json({ status: "error", message: error.message });
};

export const listAdminCategories: RequestHandler = async (
  _req,
  res,
  next,
) => {
  try {
    const categories = await listCategoriesForAdmin();

    res.status(200).json({ status: "success", data: categories });
  } catch (error) {
    next(error);
  }
};

export const getAdminCategory: RequestHandler = async (req, res, next) => {
  try {
    const category = await getCategoryForAdmin(String(req.params.id));

    if (!category) return sendError(res, "NOT_FOUND");

    res.status(200).json({ status: "success", data: category });
  } catch (error) {
    next(error);
  }
};

export const createAdminCategory: RequestHandler = async (req, res, next) => {
  try {
    const result = await createCategory(req.body);

    if (!result.ok) return sendError(res, result.reason);

    res.status(201).json({
      status: "success",
      message: "دسته‌بندی با موفقیت ساخته شد",
      data: result.category,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminCategory: RequestHandler = async (req, res, next) => {
  try {
    const result = await updateCategory(String(req.params.id), req.body);

    if (!result.ok) return sendError(res, result.reason);

    res.status(200).json({
      status: "success",
      message: "دسته‌بندی با موفقیت ویرایش شد",
      data: result.category,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminCategory: RequestHandler = async (req, res, next) => {
  try {
    const result = await deleteCategory(String(req.params.id));

    if (!result.ok) return sendError(res, result.reason);

    res.status(200).json({ status: "success", message: "دسته‌بندی حذف شد" });
  } catch (error) {
    next(error);
  }
};

export const setAdminCategoryImage: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    if (!req.file) {
      res
        .status(400)
        .json({ status: "error", message: "تصویری ارسال نشده است" });
      return;
    }

    const result = await setCategoryImage(
      String(req.params.id),
      req.file.buffer,
    );

    if (!result.ok) return sendError(res, result.reason);

    res.status(200).json({
      status: "success",
      message: "تصویر دسته‌بندی ثبت شد",
      data: result.image,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminCategoryImage: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const found = await deleteCategoryImage(String(req.params.id));

    if (!found) return sendError(res, "NOT_FOUND");

    res.status(200).json({ status: "success", message: "تصویر حذف شد" });
  } catch (error) {
    next(error);
  }
};
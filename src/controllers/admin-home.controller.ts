import type { Request, RequestHandler, Response } from "express";
import {
  MAX_BANNER_ITEMS,
  MAX_BANNER_SECTIONS,
  MAX_PRODUCT_SECTIONS,
  MAX_SLIDER_ITEMS,
} from "../lib/home-singletons.js";
import {
  createItem,
  createSection,
  deleteItem,
  deleteSection,
  listSectionsForAdmin,
  reorderItems,
  reorderSections,
  setSectionActive,
  updateItem,
  updateSection,
} from "../services/admin-home.service.js";

const errors = {
  NOT_FOUND: { code: 404, message: "بخش پیدا نشد" },
  ITEM_NOT_FOUND: { code: 404, message: "آیتم پیدا نشد" },
  SECTION_LIMIT_REACHED: {
    code: 409,
    message: `حداکثر ${MAX_PRODUCT_SECTIONS} بخش محصولات و ${MAX_BANNER_SECTIONS} بخش بنر مجاز است`,
  },
  ITEM_LIMIT_REACHED: {
    code: 409,
    message: `هر بخش اسلایدر حداکثر ${MAX_SLIDER_ITEMS} اسلاید و هر بخش بنر حداکثر ${MAX_BANNER_ITEMS} بنر دارد`,
  },
  NOT_IMAGE_SECTION: {
    code: 400,
    message: "فقط بخش اسلایدر و بنر آیتم تصویری دارند",
  },
  CATEGORY_NOT_FOUND: {
    code: 400,
    message: "دسته‌بندی‌ای با این اسلاگ وجود ندارد",
  },
  COLLECTION_NOT_FOUND: {
    code: 400,
    message: "کالکشنی با این اسلاگ وجود ندارد",
  },
  SINGLETON_CANNOT_DELETE: {
    code: 400,
    message: "این بخش ثابت است و حذف نمی‌شود؛ می‌توانید آن را خاموش کنید",
  },
  IMAGE_REQUIRED: { code: 400, message: "تصویر اصلی الزامی است" },
  INVALID_IMAGE: { code: 400, message: "فایل ارسالی یک تصویر معتبر نیست" },
  ORDER_MISMATCH: {
    code: 409,
    message: "فهرست تغییر کرده است؛ صفحه را تازه کنید و دوباره تلاش کنید",
  },
} as const;

type ErrorKey = keyof typeof errors;

const sendError = (res: Response, key: ErrorKey) => {
  const error = errors[key];

  res.status(error.code).json({ status: "error", message: error.message });
};

const sendInvalidConfig = (
  res: Response,
  fieldErrors: { field: string; message: string }[],
) => {
  res.status(400).json({
    status: "error",
    message: "تنظیمات بخش معتبر نیست",
    errors: fieldErrors,
  });
};

// فایل‌های آپلودشده‌ی فرم (فیلدهای image و mobileImage)
const getFiles = (req: Request) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;

  return {
    image: files?.image?.[0]?.buffer,
    mobileImage: files?.mobileImage?.[0]?.buffer,
  };
};

// ───────── بخش‌ها ─────────

export const listAdminSections: RequestHandler = async (_req, res, next) => {
  try {
    const result = await listSectionsForAdmin();

    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};

export const createAdminSection: RequestHandler = async (req, res, next) => {
  try {
    const result = await createSection(req.body);

    if (!result.ok) {
      if (result.reason === "INVALID_CONFIG") {
        return sendInvalidConfig(res, result.errors);
      }

      return sendError(res, result.reason);
    }

    res.status(201).json({
      status: "success",
      message: "بخش ساخته شد",
      data: result.section,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminSection: RequestHandler = async (req, res, next) => {
  try {
    const result = await updateSection(String(req.params.id), req.body);

    if (!result.ok) {
      if (result.reason === "INVALID_CONFIG") {
        return sendInvalidConfig(res, result.errors);
      }

      return sendError(res, result.reason);
    }

    res.status(200).json({
      status: "success",
      message: "بخش ویرایش شد",
      data: result.section,
    });
  } catch (error) {
    next(error);
  }
};

export const toggleAdminSection: RequestHandler = async (req, res, next) => {
  try {
    const found = await setSectionActive(
      String(req.params.id),
      req.body.isActive,
    );

    if (!found) return sendError(res, "NOT_FOUND");

    res.status(200).json({
      status: "success",
      message: req.body.isActive ? "بخش روشن شد" : "بخش خاموش شد",
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminSection: RequestHandler = async (req, res, next) => {
  try {
    const result = await deleteSection(String(req.params.id));

    if (result === "NOT_FOUND") return sendError(res, "NOT_FOUND");
    if (result === "SINGLETON") return sendError(res, "SINGLETON_CANNOT_DELETE");

    res.status(200).json({ status: "success", message: "بخش حذف شد" });
  } catch (error) {
    next(error);
  }
};

export const reorderAdminSections: RequestHandler = async (req, res, next) => {
  try {
    const ok = await reorderSections(req.body.ids);

    if (!ok) return sendError(res, "ORDER_MISMATCH");

    res.status(200).json({ status: "success", message: "ترتیب ذخیره شد" });
  } catch (error) {
    next(error);
  }
};

// ───────── آیتم‌ها ─────────

export const createAdminItem: RequestHandler = async (req, res, next) => {
  try {
    const { image, mobileImage } = getFiles(req);

    if (!image) return sendError(res, "IMAGE_REQUIRED");

    const result = await createItem(String(req.params.id), req.body, {
      image,
      mobileImage,
    });

    if (!result.ok) return sendError(res, result.reason);

    res.status(201).json({
      status: "success",
      message: "آیتم اضافه شد",
      data: result.item,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminItem: RequestHandler = async (req, res, next) => {
  try {
    const result = await updateItem(
      String(req.params.id),
      String(req.params.itemId),
      req.body,
      getFiles(req),
    );

    if (!result.ok) return sendError(res, result.reason);

    res.status(200).json({
      status: "success",
      message: "آیتم ویرایش شد",
      data: result.item,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminItem: RequestHandler = async (req, res, next) => {
  try {
    const deleted = await deleteItem(
      String(req.params.id),
      String(req.params.itemId),
    );

    if (!deleted) return sendError(res, "ITEM_NOT_FOUND");

    res.status(200).json({ status: "success", message: "آیتم حذف شد" });
  } catch (error) {
    next(error);
  }
};

export const reorderAdminItems: RequestHandler = async (req, res, next) => {
  try {
    const result = await reorderItems(String(req.params.id), req.body.ids);

    if (result === "NOT_FOUND") return sendError(res, "NOT_FOUND");
    if (result === "MISMATCH") return sendError(res, "ORDER_MISMATCH");

    res.status(200).json({ status: "success", message: "ترتیب ذخیره شد" });
  } catch (error) {
    next(error);
  }
};
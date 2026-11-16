import type { RequestHandler } from "express";
import multer from "multer";

const MAX_SIZE = 5 * 1024 * 1024; // ۵ مگابایت
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 2 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("INVALID_FILE_TYPE"));
    }
  },
});

const withErrorHandling = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    handler(req, res, (error: unknown) => {
      if (!error) return next();

      let message = "آپلود فایل با خطا مواجه شد";

      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          message = "حجم تصویر نباید بیشتر از ۵ مگابایت باشد";
        } else if (error.code === "LIMIT_UNEXPECTED_FILE") {
          message = "فایل ارسالی با فیلدهای فرم هم‌خوانی ندارد";
        }
      } else if ((error as Error).message === "INVALID_FILE_TYPE") {
        message = "فقط تصاویر JPG، PNG و WebP مجاز هستند";
      }

      res.status(400).json({ status: "error", message });
    });
  };
};

export const uploadSingleImage = (field: string): RequestHandler =>
  withErrorHandling(upload.single(field));

// چند فیلد فایل، هرکدام حداکثر یک تصویر
export const uploadImageFields = (fields: string[]): RequestHandler =>
  withErrorHandling(
    upload.fields(fields.map((name) => ({ name, maxCount: 1 }))),
  );
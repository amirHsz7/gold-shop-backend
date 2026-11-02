import type { RequestHandler } from "express";
import multer from "multer";

const MAX_SIZE = 5 * 1024 * 1024; // ۵ مگابایت
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("INVALID_FILE_TYPE"));
    }
  },
});

export const uploadSingleImage = (field: string): RequestHandler => {
  const handler = upload.single(field);

  return (req, res, next) => {
    handler(req, res, (error) => {
      if (!error) return next();

      let message = "آپلود فایل با خطا مواجه شد";

      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        message = "حجم تصویر نباید بیشتر از ۵ مگابایت باشد";
      } else if (error.message === "INVALID_FILE_TYPE") {
        message = "فقط تصاویر JPG، PNG و WebP مجاز هستند";
      }

      res.status(400).json({ status: "error", message });
    });
  };
};
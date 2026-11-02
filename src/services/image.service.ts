import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { storage } from "../lib/storage.js";

type SaveImageOptions = {
  folder: string;      // مثلاً "about"
  maxWidth?: number;   // پیش‌فرض ۱۶۰۰
};

export const saveImage = async (
  file: Buffer,
  { folder, maxWidth = 1600 }: SaveImageOptions,
) => {
  let processed: Buffer;

  try {
    processed = await sharp(file)
      .rotate() // اصلاح جهت عکس بر اساس EXIF
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    // TODO: وقتی error.middleware رو دیدم، به کلاس خطای پروژه تغییرش می‌دم
    throw new Error("فایل ارسالی یک تصویر معتبر نیست");
  }

  const key = `${folder}/${randomUUID()}.webp`;
  await storage.save(key, processed);

  return { key, url: storage.getUrl(key) };
};

export const deleteImage = async (key: string) => {
  await storage.remove(key);
};
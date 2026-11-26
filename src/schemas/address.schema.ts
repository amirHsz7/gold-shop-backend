import { z } from "zod";
import { isValidCity, isValidProvince } from "../lib/iran-geo.js";

const toEnglishDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

export const shippingAddressSchema = z
  .object({
    province: z.string().trim().min(1, "استان را انتخاب کنید"),

    city: z.string().trim().min(1, "شهر را انتخاب کنید"),

    address: z
      .string()
      .trim()
      .min(10, "آدرس کامل باید حداقل ۱۰ کاراکتر باشد")
      .max(500, "آدرس کامل نمی‌تواند بیشتر از ۵۰۰ کاراکتر باشد"),

    postalCode: z
      .string()
      .trim()
      .transform(toEnglishDigits)
      .pipe(z.string().regex(/^[1-9]\d{9}$/, "کد پستی باید ۱۰ رقم باشد")),
  })
  .superRefine((value, ctx) => {
    if (!isValidProvince(value.province)) {
      ctx.addIssue({
        code: "custom",
        path: ["province"],
        message: "استان معتبر نیست",
      });
      return;
    }

    if (!isValidCity(value.province, value.city)) {
      ctx.addIssue({
        code: "custom",
        path: ["city"],
        message: "شهر انتخاب‌شده متعلق به این استان نیست",
      });
    }
  });

export const addressSchema = shippingAddressSchema.safeExtend({
  title: z
    .string()
    .trim()
    .min(1, "عنوان آدرس را وارد کنید")
    .max(50, "عنوان آدرس نمی‌تواند بیشتر از ۵۰ کاراکتر باشد"),
});

export type AddressInput = z.infer<typeof addressSchema>;
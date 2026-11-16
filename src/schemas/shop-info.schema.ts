import { z } from "zod";

// رشته‌ی خالی یعنی «ثبت نشده» و به null تبدیل می‌شود
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} نمی‌تواند بیشتر از ${max} کاراکتر باشد`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const emailSchema = z
  .string()
  .trim()
  .max(120, "ایمیل نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد")
  .refine(
    (value) => value === "" || z.string().email().safeParse(value).success,
    "ایمیل معتبر نیست",
  )
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

const phoneSchema = z
  .string()
  .trim()
  .min(5, "شماره تلفن خیلی کوتاه است")
  .max(20, "شماره تلفن خیلی بلند است")
  .regex(/^[0-9+\-()\s]+$/, "شماره تلفن فقط می‌تواند شامل ارقام و + - ( ) باشد");

export const shopInfoSchema = z
  .object({
    address: optionalText(500, "آدرس"),

    latitude: z
      .number()
      .min(-90, "عرض جغرافیایی باید بین ۹۰- تا ۹۰ باشد")
      .max(90, "عرض جغرافیایی باید بین ۹۰- تا ۹۰ باشد")
      .nullable()
      .optional(),

    longitude: z
      .number()
      .min(-180, "طول جغرافیایی باید بین ۱۸۰- تا ۱۸۰ باشد")
      .max(180, "طول جغرافیایی باید بین ۱۸۰- تا ۱۸۰ باشد")
      .nullable()
      .optional(),

    phones: z
      .array(phoneSchema)
      .max(5, "حداکثر ۵ شماره تلفن مجاز است")
      .optional(),

    email: emailSchema,
    workingHours: optionalText(500, "ساعت کاری"),
    instagram: optionalText(200, "آدرس اینستاگرام"),
    telegram: optionalText(200, "آدرس تلگرام"),
    whatsapp: optionalText(200, "شماره یا آدرس واتساپ"),
  })
  .refine(
    (value) => (value.latitude == null) === (value.longitude == null),
    {
      message: "عرض و طول جغرافیایی باید با هم وارد شوند",
      path: ["longitude"],
    },
  );

export type ShopInfoInput = z.infer<typeof shopInfoSchema>;
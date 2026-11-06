import { z } from "zod";

// بررسی اینکه عدد بیشتر از تعداد مجاز رقم اعشار ندارد
const hasMaxDecimals = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
};

// ───────── فیلدهای مشترک ─────────

// حروف فارسی و انگلیسی، عدد و خط تیره
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "اسلاگ باید حداقل ۲ کاراکتر باشد")
  .max(120, "اسلاگ نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد")
  .regex(
    /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u,
    "اسلاگ فقط می‌تواند شامل حروف، عدد و خط تیره باشد",
  );

const nameSchema = z
  .string()
  .trim()
  .min(2, "نام محصول باید حداقل ۲ کاراکتر باشد")
  .max(150, "نام محصول نمی‌تواند بیشتر از ۱۵۰ کاراکتر باشد");

const descriptionSchema = z
  .string()
  .trim()
  .max(5000, "توضیحات نمی‌تواند بیشتر از ۵۰۰۰ کاراکتر باشد");

export const idSchema = z.string().trim().min(1, "شناسه نامعتبر است");

const discountSchema = z
  .number()
  .min(0, "تخفیف نمی‌تواند منفی باشد")
  .max(100, "تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد")
  .refine((value) => hasMaxDecimals(value, 2), "تخفیف حداکثر ۲ رقم اعشار دارد");

// ───────── فیلدهای وزن (variant) ─────────

const labelSchema = z.string().trim().min(1).max(50);
const skuSchema = z.string().trim().min(1).max(50);

// وزن به گرم، حداکثر ۳ رقم اعشار
const weightSchema = z
  .number()
  .positive("وزن باید بیشتر از صفر باشد")
  .max(100000, "وزن نامعتبر است")
  .refine((value) => hasMaxDecimals(value, 3), "وزن حداکثر ۳ رقم اعشار دارد");

// درصد اجرت از وزن
const feeSchema = z
  .number()
  .min(0, "درصد اجرت نمی‌تواند منفی باشد")
  .max(100, "درصد اجرت نمی‌تواند بیشتر از ۱۰۰ باشد")
  .refine(
    (value) => hasMaxDecimals(value, 3),
    "درصد اجرت حداکثر ۳ رقم اعشار دارد",
  );

// اجرت ریالی (عدد صحیح)
const feeAmountSchema = z
  .number()
  .int("اجرت ریالی باید عدد صحیح باشد")
  .min(0, "اجرت ریالی نمی‌تواند منفی باشد")
  .max(999_999_999_999, "اجرت ریالی نامعتبر است");

const stockSchema = z
  .number()
  .int("موجودی باید عدد صحیح باشد")
  .min(0, "موجودی نمی‌تواند منفی باشد")
  .max(100000, "موجودی نامعتبر است");

// null برای label و sku لازم است، چون GET ادمین برای مقدار خالی null برمی‌گرداند
const variantFields = {
  label: labelSchema.nullable().optional(),
  sku: skuSchema.nullable().optional(),
  weight: weightSchema,
  fee: feeSchema.default(0),
  feeAmount: feeAmountSchema.default(0),
  stock: stockSchema.default(1),
  isActive: z.boolean().default(true),
};

const createVariantSchema = z.object(variantFields);

// در ویرایش: وزن دارای id یعنی ویرایش وزن موجود، بدون id یعنی وزن جدید
const updateVariantSchema = z.object({
  id: idSchema.optional(),
  ...variantFields,
});

// ───────── بررسی‌های لیست وزن‌ها ─────────

const hasUniqueWeights = (variants: { weight: number }[]) =>
  new Set(variants.map((variant) => variant.weight.toFixed(3))).size ===
  variants.length;

const hasUniqueSkus = (variants: { sku?: string | null }[]) => {
  const skus = variants
    .map((variant) => variant.sku)
    .filter((sku): sku is string => Boolean(sku));

  return new Set(skus).size === skus.length;
};

const hasUniqueIds = (variants: { id?: string }[]) => {
  const ids = variants
    .map((variant) => variant.id)
    .filter((id): id is string => Boolean(id));

  return new Set(ids).size === ids.length;
};

const WEIGHTS_MESSAGE =
  "وزن‌های تکراری مجاز نیست؛ برای افزایش تعداد، موجودی همان وزن را زیاد کنید";
const SKUS_MESSAGE = "کد کالا (SKU) تکراری در وزن‌ها مجاز نیست";
const IDS_MESSAGE = "شناسه‌ی وزن‌ها نباید تکراری باشد";

// ───────── محصول ─────────

const productFields = {
  name: nameSchema,
  slug: slugSchema,
  description: descriptionSchema.nullable().optional(),

  categoryId: idSchema,
  collectionId: idSchema.nullable().optional(), // null یعنی بدون کالکشن

  discountPercent: discountSchema.default(0),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
};

export const createProductSchema = z.object({
  ...productFields,
  variants: z
    .array(createVariantSchema)
    .min(1, "حداقل یک وزن برای محصول لازم است")
    .max(50, "حداکثر ۵۰ وزن برای هر محصول مجاز است")
    .refine(hasUniqueWeights, WEIGHTS_MESSAGE)
    .refine(hasUniqueSkus, SKUS_MESSAGE),
});

// ویرایش کامل: کل محصول جایگزین می‌شود (مثل PUT)
export const updateProductSchema = z.object({
  ...productFields,
  variants: z
    .array(updateVariantSchema)
    .min(1, "حداقل یک وزن برای محصول لازم است")
    .max(50, "حداکثر ۵۰ وزن برای هر محصول مجاز است")
    .refine(hasUniqueWeights, WEIGHTS_MESSAGE)
    .refine(hasUniqueSkus, SKUS_MESSAGE)
    .refine(hasUniqueIds, IDS_MESSAGE),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
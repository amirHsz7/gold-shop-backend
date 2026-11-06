import { prisma } from "../lib/prisma.js";

// بعد از هر تغییر در variantها (ساخت، ویرایش، حذف) باید صدا زده شود
export const syncProductWeightRange = async (productId: string) => {
  const range = await prisma.productVariant.aggregate({
    where: { productId, isActive: true },
    _min: { weight: true },
    _max: { weight: true },
  });

  await prisma.product.update({
    where: { id: productId },
    data: {
      minWeight: range._min.weight ?? 0,
      maxWeight: range._max.weight ?? 0,
    },
  });
};
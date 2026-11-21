import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import type { AddressInput } from "../schemas/address.schema.js";

const MAX_ADDRESSES = 10;

const addressSelect = {
  id: true,
  title: true,
  province: true,
  city: true,
  address: true,
  postalCode: true,
} as const;

export const listAddresses = (userId: string) =>
  prisma.address.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: addressSelect,
  });

export const createAddress = async (userId: string, input: AddressInput) => {
  const count = await prisma.address.count({ where: { userId } });

  if (count >= MAX_ADDRESSES) {
    throw new AppError("حداکثر ۱۰ آدرس می‌توانید ذخیره کنید.", 409);
  }

  return prisma.address.create({
    data: { ...input, userId },
    select: addressSelect,
  });
};

export const updateAddress = async (
  userId: string,
  id: string,
  input: AddressInput,
) => {
  // userId در شرط است تا کسی آدرس دیگری را تغییر ندهد
  const result = await prisma.address.updateMany({
    where: { id, userId },
    data: input,
  });

  if (result.count === 0) {
    throw new AppError("آدرس پیدا نشد.", 404);
  }

  return prisma.address.findUniqueOrThrow({
    where: { id },
    select: addressSelect,
  });
};

export const deleteAddress = async (userId: string, id: string) => {
  const result = await prisma.address.deleteMany({ where: { id, userId } });

  if (result.count === 0) {
    throw new AppError("آدرس پیدا نشد.", 404);
  }
};
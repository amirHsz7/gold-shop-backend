import { prisma } from "../lib/prisma.js";
import type { ShopInfoInput } from "../schemas/shop-info.schema.js";

const SHOP_INFO_ID = "main";

const publicSelect = {
  address: true,
  latitude: true,
  longitude: true,
  phones: true,
  email: true,
  workingHours: true,
  instagram: true,
  telegram: true,
  whatsapp: true,
} as const;

// وقتی هنوز چیزی ثبت نشده است
const emptyShopInfo = {
  address: null,
  latitude: null,
  longitude: null,
  phones: [] as string[],
  email: null,
  workingHours: null,
  instagram: null,
  telegram: null,
  whatsapp: null,
}

export const getShopInfo = async () => {
  const info = await prisma.shopInfo.findUnique({
    where: { id: SHOP_INFO_ID },
    select: publicSelect,
  });

  return info ?? emptyShopInfo;
};

export const getShopInfoForAdmin = async () => {
  const info = await prisma.shopInfo.findUnique({
    where: { id: SHOP_INFO_ID },
    select: { ...publicSelect, updatedAt: true },
  });

  return info ?? { ...emptyShopInfo, updatedAt: null };
};

export const saveShopInfo = async (input: ShopInfoInput) => {
  const data = {
    address: input.address ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    phones: input.phones ?? [],
    email: input.email ?? null,
    workingHours: input.workingHours ?? null,
    instagram: input.instagram ?? null,
    telegram: input.telegram ?? null,
    whatsapp: input.whatsapp ?? null,
  };

  await prisma.shopInfo.upsert({
    where: { id: SHOP_INFO_ID },
    create: { id: SHOP_INFO_ID, ...data },
    update: { ...data, phones: { set: data.phones } },
  });
};
import { prisma } from "../lib/prisma.js";
import type { CreateContactInput } from "../schemas/contact.schema.js";

export const createContactMessage = async (data: CreateContactInput) => {
  return prisma.contactMessage.create({
    data,
    select: { id: true, createdAt: true },
  });
};
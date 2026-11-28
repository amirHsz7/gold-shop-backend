import type { Prisma } from "../generated/prisma/client.js";
import { ADMIN_ROLES } from "../utils/roles.js";

export async function preparePaidOrder(
  tx: Prisma.TransactionClient,
  order: { id: string; orderNumber: number },
  paidAt: Date,
  committedAt: Date,
) {
  const paidOrder = await tx.order.update({
    where: { id: order.id },
    data: {
      status: "PREPARING",
      stockCommittedAt: committedAt,
      paidAt,
      refundPending: false,
    },
    select: {
      user: { select: { mobile: true } },
      items: {
        select: { productName: true, weight: true, quantity: true },
      },
    },
  });

  const managers = await tx.user.findMany({
    where: {
      role: { in: ADMIN_ROLES },
      receivesOrderSms: true,
    },
    select: { mobile: true },
  });

  const lines = paidOrder.items.map(
    item => `${item.productName}، ${item.weight.toString()} گرم × ${item.quantity}`,
  );
  const adminText = `سفارش ${order.orderNumber} پرداخت شد.\n${lines.join("\n")}`;

  await tx.smsLog.createMany({
    data: [
      {
        orderId: order.id,
        type: "ORDER_PAID_CUSTOMER",
        recipient: paidOrder.user.mobile,
        text: `خرید شما با شماره سفارش ${order.orderNumber} ثبت شد و در حال آماده‌سازی است.`,
      },
      ...managers.map(({ mobile }) => ({
        orderId: order.id,
        type: "ORDER_NEW_ADMIN" as const,
        recipient: mobile,
        text: adminText,
      })),
    ],
    skipDuplicates: true,
  });
}
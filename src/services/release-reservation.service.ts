import type { Prisma } from "../generated/prisma/client.js";

// فراخواننده باید ردیف Order را قفل کرده و آزاد یا قطعی‌نشدن موجودی را بررسی کرده باشد.
export async function releaseOrderReservation(
  tx: Prisma.TransactionClient,
  orderId: string,
  now: Date,
): Promise<boolean> {
  const rows = await tx.stockReservation.findMany({
    where: { orderId },
    select: {
      variantId: true,
      quantity: true,
      status: true,
    },
    orderBy: { variantId: "asc" },
  });

  if (
    rows.length === 0 ||
    rows.some(row => row.status !== "ACTIVE" || row.quantity <= 0)
  ) {
    return false;
  }

  // در schema ترکیب orderId و variantId یکتاست.
  // قبل از اولین تغییر، تمام Variantها را به ترتیب ثابت قفل و بررسی می‌کنیم.
  for (const row of rows) {
    const [variant] = await tx.$queryRaw<{ reservedStock: number }[]>`
      SELECT "reservedStock"
      FROM "ProductVariant"
      WHERE "id" = ${row.variantId}
      FOR UPDATE
    `;

    if (!variant || variant.reservedStock < row.quantity) {
      return false;
    }
  }

  for (const row of rows) {
    await tx.productVariant.update({
      where: { id: row.variantId },
      data: {
        reservedStock: { decrement: row.quantity },
      },
    });
  }

  const released = await tx.stockReservation.updateMany({
    where: { orderId, status: "ACTIVE" },
    data: { status: "RELEASED" },
  });

  if (released.count !== rows.length) {
    throw new Error("Reservation count mismatch");
  }

  await tx.payment.updateMany({
    where: { orderId, status: "PENDING" },
    data: {
      status: "EXPIRED",
      failureReason: "RESERVATION_EXPIRED",
    },
  });

  await tx.order.update({
    where: { id: orderId },
    data: { stockReleasedAt: now },
  });

  return true;
}
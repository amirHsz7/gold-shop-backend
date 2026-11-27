import { disconnectDatabase, prisma } from "../src/lib/prisma.js";

async function main() {
  const [raw, ...extra] = process.argv.slice(2);
  const orderNumber = Number(raw);

  if (
    !raw ||
    !/^\d+$/.test(raw) ||
    !Number.isInteger(orderNumber) ||
    orderNumber < 1 ||
    orderNumber > 2147483647 ||
    extra.length > 0
  ) {
    throw new Error("Usage: npm run sms:preview -- <orderNumber>");
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      status: true,
      smsLogs: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          type: true,
          recipient: true,
          text: true,
          status: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error(`سفارش شماره ${orderNumber} پیدا نشد.`);
  }

  console.log(
    `سفارش ${orderNumber} | وضعیت ${order.status} | تعداد پیامک ${order.smsLogs.length}`,
  );

  for (const sms of order.smsLogs) {
    const maskedMobile = `****${sms.recipient.slice(-4)}`;
    console.log(`[${sms.status}] ${sms.type} → ${maskedMobile}`);
    console.log(sms.text);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
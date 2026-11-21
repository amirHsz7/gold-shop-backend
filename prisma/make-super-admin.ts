import "dotenv/config";
import { prisma, disconnectDatabase } from "../src/lib/prisma.js";

const mobile = process.argv[2];

if (!mobile || !/^09\d{9}$/.test(mobile)) {
  console.error("استفاده: npm run admin:make-super -- 09123456789");
  process.exit(1);
}

try {
  const user = await prisma.user.findUnique({ where: { mobile } });

  if (!user) {
    console.error("کاربری با این شماره پیدا نشد. اول باید در سایت ثبت‌نام کند.");
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "SUPER_ADMIN" },
  });

  console.log(`${user.fullName} (${mobile}) حالا SUPER_ADMIN است`);
} finally {
  await disconnectDatabase();
}
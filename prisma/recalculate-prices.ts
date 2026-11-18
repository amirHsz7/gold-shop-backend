import "dotenv/config";
import { disconnectDatabase } from "../src/lib/prisma.js";
import { recalculateAllPrices } from "../src/services/price.service.js";

try {
  await recalculateAllPrices();
  console.log("قیمت همه‌ی محصولات دوباره محاسبه شد");
} finally {
  await disconnectDatabase();
}
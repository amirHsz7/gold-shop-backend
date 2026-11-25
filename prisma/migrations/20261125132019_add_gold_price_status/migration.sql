-- CreateEnum
CREATE TYPE "GoldPriceStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- AlterTable
ALTER TABLE "PricingSetting" ADD COLUMN     "goldPriceStatus" "GoldPriceStatus" NOT NULL DEFAULT 'UNAVAILABLE';

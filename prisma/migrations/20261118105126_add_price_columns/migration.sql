-- CreateEnum
CREATE TYPE "DiscountBase" AS ENUM ('TOTAL', 'FEE');

-- AlterTable
ALTER TABLE "PricingSetting" ADD COLUMN     "discountBase" "DiscountBase" NOT NULL DEFAULT 'TOTAL',
ADD COLUMN     "feeAmountInRial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "goldPricePerGram" INTEGER,
ADD COLUMN     "goldPriceSource" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "goldPriceUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "roundTo" INTEGER NOT NULL DEFAULT 1000;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "maxPrice" DECIMAL(15,0),
ADD COLUMN     "minPrice" DECIMAL(15,0);

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "originalPrice" DECIMAL(15,0),
ADD COLUMN     "price" DECIMAL(15,0);

-- CreateIndex
CREATE INDEX "Product_isActive_minPrice_idx" ON "Product"("isActive", "minPrice");

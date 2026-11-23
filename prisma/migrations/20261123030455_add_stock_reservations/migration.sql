-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'COMMITTED', 'RELEASED');

-- AlterEnum
ALTER TYPE "SmsType" ADD VALUE 'ORDER_PAID_CUSTOMER';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "reservationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "stockCommittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "reservedStock" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockReservation_variantId_status_idx" ON "StockReservation"("variantId", "status");

-- CreateIndex
CREATE INDEX "StockReservation_orderId_status_idx" ON "StockReservation"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StockReservation_orderId_variantId_key" ON "StockReservation"("orderId", "variantId");

-- CreateIndex
CREATE INDEX "Order_status_reservationExpiresAt_idx" ON "Order"("status", "reservationExpiresAt");

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add stock integrity constraints
ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_stock_non_negative_check"
CHECK ("stock" >= 0);

ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_reservedStock_non_negative_check"
CHECK ("reservedStock" >= 0);

ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_reservedStock_lte_stock_check"
CHECK ("reservedStock" <= "stock");

-- Add stock reservation integrity constraint
ALTER TABLE "StockReservation"
ADD CONSTRAINT "StockReservation_quantity_positive_check"
CHECK ("quantity" > 0);

-- Prevent an order from being both released and committed
ALTER TABLE "Order"
ADD CONSTRAINT "Order_stock_release_commit_exclusive_check"
CHECK (
    NOT (
        "stockReleasedAt" IS NOT NULL
        AND "stockCommittedAt" IS NOT NULL
    )
);
/*
  Warnings:

  - A unique constraint covering the columns `[mobile]` on the table `Otp` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Otp` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Otp_mobile_idx";

-- AlterTable
ALTER TABLE "Otp" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Otp_mobile_key" ON "Otp"("mobile");

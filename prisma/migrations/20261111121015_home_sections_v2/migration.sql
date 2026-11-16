/*
  Warnings:

  - You are about to drop the column `address` on the `AboutPage` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `AboutPage` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `AboutPage` table. All the data in the column will be lost.
  - You are about to drop the column `mapUrl` on the `AboutPage` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `AboutPage` table. All the data in the column will be lost.
  - You are about to drop the column `workingHours` on the `AboutPage` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[singletonKey]` on the table `HomeSection` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "HomeSectionType" ADD VALUE 'TESTIMONIALS';
ALTER TYPE "HomeSectionType" ADD VALUE 'MAP';

-- AlterTable
ALTER TABLE "AboutPage" DROP COLUMN "address",
DROP COLUMN "email",
DROP COLUMN "imageUrl",
DROP COLUMN "mapUrl",
DROP COLUMN "phone",
DROP COLUMN "workingHours",
ADD COLUMN     "imageKey" TEXT;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "showOnHome" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "HomeSection" ADD COLUMN     "singletonKey" TEXT;

-- CreateTable
CREATE TABLE "ShopInfo" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "email" TEXT,
    "workingHours" TEXT,
    "instagram" TEXT,
    "telegram" TEXT,
    "whatsapp" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_showOnHome_status_idx" ON "Comment"("showOnHome", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HomeSection_singletonKey_key" ON "HomeSection"("singletonKey");

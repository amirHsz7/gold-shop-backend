-- CreateEnum
CREATE TYPE "HomeSectionType" AS ENUM ('SLIDER', 'BANNERS', 'PRODUCTS', 'CATEGORIES', 'COLLECTIONS');

-- CreateTable
CREATE TABLE "HomeSection" (
    "id" TEXT NOT NULL,
    "type" "HomeSectionType" NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "config" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeSectionItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "mobileImageKey" TEXT,
    "alt" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "buttonText" TEXT,
    "linkUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeSectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeSection_isActive_sortOrder_idx" ON "HomeSection"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "HomeSectionItem_sectionId_isActive_sortOrder_idx" ON "HomeSectionItem"("sectionId", "isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "HomeSectionItem" ADD CONSTRAINT "HomeSectionItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "HomeSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

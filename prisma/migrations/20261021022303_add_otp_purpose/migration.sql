/*
  Warnings:

  - Added the required column `purpose` to the `Otp` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'LOGIN');

-- AlterTable
ALTER TABLE "Otp" ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "purpose" "OtpPurpose" NOT NULL;

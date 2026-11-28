-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "refundRefId" VARCHAR(100),
ADD COLUMN     "refundRequestedAt" TIMESTAMP(3);

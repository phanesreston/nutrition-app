-- AlterTable
ALTER TABLE "Food" ADD COLUMN     "amountUnit" TEXT NOT NULL DEFAULT 'g',
ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "brand" TEXT,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "fetchedAt" TIMESTAMP(3),
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "ingredients" TEXT;

-- CreateIndex
CREATE INDEX "Food_barcode_idx" ON "Food"("barcode");

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

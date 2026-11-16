-- AlterTable
ALTER TABLE "DiaryEntry" ADD COLUMN     "per100g" JSONB;

-- AlterTable
ALTER TABLE "Food" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "sourceData" JSONB;

-- AlterTable
ALTER TABLE "FoodNutrient" ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'reference';

-- CreateTable
CREATE TABLE "FoodOverride" (
    "foodId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT,
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodOverride_pkey" PRIMARY KEY ("foodId","field")
);

-- CreateTable
CREATE TABLE "FoodImage" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodAudit" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "action" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FoodImage_filename_key" ON "FoodImage"("filename");

-- CreateIndex
CREATE INDEX "FoodImage_foodId_idx" ON "FoodImage"("foodId");

-- CreateIndex
CREATE INDEX "FoodAudit_foodId_createdAt_idx" ON "FoodAudit"("foodId", "createdAt");

-- AddForeignKey
ALTER TABLE "FoodOverride" ADD CONSTRAINT "FoodOverride_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodImage" ADD CONSTRAINT "FoodImage_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodAudit" ADD CONSTRAINT "FoodAudit_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing nutrient values: record where they came from.
UPDATE "FoodNutrient" n SET "origin" = CASE f."sourceId"
    WHEN 'open-food-facts' THEN 'label'
    WHEN 'custom' THEN 'user'
    ELSE 'reference' END
FROM "Food" f WHERE f."id" = n."foodId";

-- Existing diary entries: snapshot the food's current values so that later
-- corrections do not rewrite days that are already logged.
UPDATE "DiaryEntry" d SET "per100g" = COALESCE(
    (SELECT jsonb_object_agg(n."nutrientKey", n."amount"::text) FROM "FoodNutrient" n WHERE n."foodId" = d."foodId"),
    '{}'::jsonb);

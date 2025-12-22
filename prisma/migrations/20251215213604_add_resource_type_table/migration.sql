/*
  Warnings:

  - You are about to drop the column `type` on the `Resource` table. All the data in the column will be lost.
  - Added the required column `resourceTypeId` to the `Resource` table without a default value. This is not possible if the table is not empty.

*/

-- CreateTable
CREATE TABLE "ResourceType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "metaSchema" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResourceType_name_key" ON "ResourceType"("name");

-- Insert resource types from existing Resource.type values
INSERT INTO "ResourceType" (name, label, description, "updatedAt")
SELECT DISTINCT 
    type as name,
    INITCAP(type) as label,
    'Migrated from existing resources' as description,
    CURRENT_TIMESTAMP as "updatedAt"
FROM "Resource"
WHERE type IS NOT NULL;

-- AlterTable - Add column with nullable first
ALTER TABLE "Resource" ADD COLUMN "resourceTypeId" INTEGER;

-- Update existing resources to link to their resource types
UPDATE "Resource" r
SET "resourceTypeId" = rt.id
FROM "ResourceType" rt
WHERE r.type = rt.name;

-- Make the column NOT NULL after data migration
ALTER TABLE "Resource" ALTER COLUMN "resourceTypeId" SET NOT NULL;

-- Drop the old type column
ALTER TABLE "Resource" DROP COLUMN "type";

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_resourceTypeId_fkey" FOREIGN KEY ("resourceTypeId") REFERENCES "ResourceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `metaSchema` on the `ResourceType` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ResourceType" DROP COLUMN "metaSchema";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "image" TEXT;

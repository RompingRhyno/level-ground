/*
  Warnings:

  - A unique constraint covering the columns `[folder,orderIndex]` on the table `Asset` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "orderIndex" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Asset_folder_orderIndex_key" ON "Asset"("folder", "orderIndex");

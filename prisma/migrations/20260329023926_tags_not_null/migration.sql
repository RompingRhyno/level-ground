-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "folder" TEXT,
ADD COLUMN     "size" INTEGER,
ADD COLUMN     "tags" TEXT[];

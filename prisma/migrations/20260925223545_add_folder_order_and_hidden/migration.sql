-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Folder_order_hidden_idx" ON "Folder"("order", "hidden");

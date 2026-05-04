-- CreateTable
CREATE TABLE "MediaUsage" (
    "id" SERIAL NOT NULL,
    "assetId" TEXT NOT NULL,
    "pageSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaUsage_assetId_idx" ON "MediaUsage"("assetId");

-- CreateIndex
CREATE INDEX "MediaUsage_pageSlug_idx" ON "MediaUsage"("pageSlug");

-- CreateIndex
CREATE UNIQUE INDEX "MediaUsage_assetId_pageSlug_key" ON "MediaUsage"("assetId", "pageSlug");

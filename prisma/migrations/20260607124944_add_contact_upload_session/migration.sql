-- CreateTable
CREATE TABLE "ContactUploadSession" (
    "id" TEXT NOT NULL,
    "pageSlug" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactUploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactUpload" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cleanupAttempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContactUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactUpload_key_key" ON "ContactUpload"("key");

-- CreateIndex
CREATE INDEX "ContactUpload_sessionId_idx" ON "ContactUpload"("sessionId");

-- AddForeignKey
ALTER TABLE "ContactUpload" ADD CONSTRAINT "ContactUpload_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ContactUploadSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

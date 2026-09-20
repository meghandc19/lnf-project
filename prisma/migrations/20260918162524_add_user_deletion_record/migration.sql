-- CreateTable
CREATE TABLE "UserDeletionRecord" (
    "id" TEXT NOT NULL,
    "originalUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "deletedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDeletionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDeletionRecord_originalUserId_idx" ON "UserDeletionRecord"("originalUserId");

-- CreateIndex
CREATE INDEX "UserDeletionRecord_deletedBy_idx" ON "UserDeletionRecord"("deletedBy");

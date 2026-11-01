-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ReportMessageKind" AS ENUM ('COMMENT', 'HINT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_REPORT';
ALTER TYPE "NotificationType" ADD VALUE 'REPORT_COMMENT';
ALTER TYPE "NotificationType" ADD VALUE 'REPORT_HINT';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "friendshipId" TEXT,
ADD COLUMN     "lostItemId" TEXT,
ADD COLUMN     "reportMessageId" TEXT;

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportMessage" (
    "id" TEXT NOT NULL,
    "lostItemId" TEXT,
    "foundItemId" TEXT,
    "reportOwnerId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "parentMessageId" TEXT,
    "clientRequestId" TEXT NOT NULL,
    "kind" "ReportMessageKind" NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "location" VARCHAR(180),
    "sightingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_pairKey_key" ON "Friendship"("pairKey");

-- CreateIndex
CREATE INDEX "Friendship_requesterId_status_updatedAt_idx" ON "Friendship"("requesterId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Friendship_recipientId_status_updatedAt_idx" ON "Friendship"("recipientId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportMessage_clientRequestId_key" ON "ReportMessage"("clientRequestId");

-- CreateIndex
CREATE INDEX "ReportMessage_lostItemId_createdAt_idx" ON "ReportMessage"("lostItemId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportMessage_foundItemId_createdAt_idx" ON "ReportMessage"("foundItemId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportMessage_reportOwnerId_createdAt_idx" ON "ReportMessage"("reportOwnerId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportMessage_senderId_createdAt_idx" ON "ReportMessage"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportMessage_parentMessageId_createdAt_idx" ON "ReportMessage"("parentMessageId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_reportMessageId_key" ON "Notification"("reportMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_lostItemId_fkey" FOREIGN KEY ("lostItemId") REFERENCES "LostItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_friendshipId_fkey" FOREIGN KEY ("friendshipId") REFERENCES "Friendship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_reportMessageId_fkey" FOREIGN KEY ("reportMessageId") REFERENCES "ReportMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportMessage" ADD CONSTRAINT "ReportMessage_lostItemId_fkey" FOREIGN KEY ("lostItemId") REFERENCES "LostItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportMessage" ADD CONSTRAINT "ReportMessage_foundItemId_fkey" FOREIGN KEY ("foundItemId") REFERENCES "FoundItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportMessage" ADD CONSTRAINT "ReportMessage_reportOwnerId_fkey" FOREIGN KEY ("reportOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportMessage" ADD CONSTRAINT "ReportMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportMessage" ADD CONSTRAINT "ReportMessage_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "ReportMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;


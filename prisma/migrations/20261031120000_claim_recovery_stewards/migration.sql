-- Extend the existing claim and conversation records without deleting any data.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'REVOK_STEWARD';
ALTER TYPE "ClaimStatus" ADD VALUE IF NOT EXISTS 'RECOVERED';

ALTER TABLE "FoundItem" ADD COLUMN "custodianId" TEXT;
ALTER TABLE "FoundItem" ADD CONSTRAINT "FoundItem_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "FoundItem_custodianId_idx" ON "FoundItem"("custodianId");

ALTER TABLE "Claim"
  ADD COLUMN "conversationId" TEXT,
  ADD COLUMN "recoveryCodeHash" TEXT,
  ADD COLUMN "recoveryCodeCiphertext" TEXT,
  ADD COLUMN "recoveryCodeIv" TEXT,
  ADD COLUMN "recoveryCodeTag" TEXT,
  ADD COLUMN "recoveryCodeExpiresAt" TIMESTAMP(3),
  ADD COLUMN "recoveryCodeAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recoveryCodeUsedAt" TIMESTAMP(3),
  ADD COLUMN "recoveryCodeIssuedAt" TIMESTAMP(3),
  ADD COLUMN "recoveredAt" TIMESTAMP(3);
ALTER TABLE "ConversationParticipant" ADD COLUMN "lastReadAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Claim_conversationId_key" ON "Claim"("conversationId");
CREATE INDEX "Claim_foundItemId_status_idx" ON "Claim"("foundItemId", "status");
CREATE INDEX "Claim_userId_status_idx" ON "Claim"("userId", "status");
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "HandoverStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED');
CREATE TABLE "HandoverRequest" (
  "id" TEXT NOT NULL,
  "foundItemId" TEXT NOT NULL,
  "finderId" TEXT NOT NULL,
  "stewardId" TEXT NOT NULL,
  "previousCustodyStatus" TEXT,
  "status" "HandoverStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HandoverRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HandoverRequest_foundItemId_fkey" FOREIGN KEY ("foundItemId") REFERENCES "FoundItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HandoverRequest_finderId_fkey" FOREIGN KEY ("finderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HandoverRequest_stewardId_fkey" FOREIGN KEY ("stewardId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "HandoverRequest_stewardId_status_idx" ON "HandoverRequest"("stewardId", "status");
CREATE INDEX "HandoverRequest_foundItemId_status_idx" ON "HandoverRequest"("foundItemId", "status");

CREATE TABLE "UserReport" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reportedUserId" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "foundItemId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "description" VARCHAR(3000) NOT NULL,
  "adminDecision" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "UserReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "UserReport_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "UserReport_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "UserReport_foundItemId_fkey" FOREIGN KEY ("foundItemId") REFERENCES "FoundItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserReport_reporterId_claimId_key" ON "UserReport"("reporterId", "claimId");
CREATE INDEX "UserReport_createdAt_idx" ON "UserReport"("createdAt");

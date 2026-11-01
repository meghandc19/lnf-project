-- Add private per-user inventory, notification references, and participant-scoped chat hiding.
CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "normalizedName" VARCHAR(100) NOT NULL,
  "brand" VARCHAR(100),
  "color" VARCHAR(80),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InventoryItem_userId_normalizedName_key" ON "InventoryItem"("userId", "normalizedName");
CREATE INDEX "InventoryItem_userId_createdAt_idx" ON "InventoryItem"("userId", "createdAt");

ALTER TABLE "Notification"
  ADD COLUMN "foundItemId" TEXT,
  ADD COLUMN "inventoryItemId" TEXT,
  ADD COLUMN "claimId" TEXT;
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_foundItemId_fkey" FOREIGN KEY ("foundItemId") REFERENCES "FoundItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Notification_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Notification_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Notification_userId_type_foundItemId_inventoryItemId_key" ON "Notification"("userId", "type", "foundItemId", "inventoryItemId");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

ALTER TABLE "ConversationParticipant" ADD COLUMN "deletedAt" TIMESTAMP(3);

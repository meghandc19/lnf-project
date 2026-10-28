ALTER TABLE "LostItem"
  ADD COLUMN "subcategory" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "material" TEXT,
  ADD COLUMN "identifyingMarks" TEXT,
  ADD COLUMN "approximateTime" TEXT,
  ADD COLUMN "locationDetails" TEXT,
  ADD COLUMN "contactedAbout" TEXT;

ALTER TABLE "FoundItem"
  ADD COLUMN "subcategory" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "material" TEXT,
  ADD COLUMN "identifyingMarks" TEXT,
  ADD COLUMN "approximateTime" TEXT,
  ADD COLUMN "locationDetails" TEXT,
  ADD COLUMN "custodyStatus" TEXT;

CREATE INDEX "LostItem_userId_status_createdAt_idx" ON "LostItem"("userId", "status", "createdAt");
CREATE INDEX "FoundItem_userId_status_createdAt_idx" ON "FoundItem"("userId", "status", "createdAt");
CREATE INDEX "LostItem_moderation_status_createdAt_idx" ON "LostItem"("moderation", "status", "createdAt");
CREATE INDEX "FoundItem_moderation_status_createdAt_idx" ON "FoundItem"("moderation", "status", "createdAt");

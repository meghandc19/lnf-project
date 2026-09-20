-- AlterTable
ALTER TABLE "FoundItem" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "privateDetails" TEXT;

-- AlterTable
ALTER TABLE "LostItem" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "privateDetails" TEXT;

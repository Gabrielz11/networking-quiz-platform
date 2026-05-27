-- AlterTable
ALTER TABLE "ModuleSourceChunk" ADD COLUMN     "embeddingModel" TEXT,
ADD COLUMN     "page" INTEGER,
ADD COLUMN     "parentChunkId" TEXT,
ADD COLUMN     "sectionTitle" TEXT,
ADD COLUMN     "sourceType" TEXT;

-- AddForeignKey
ALTER TABLE "ModuleSourceChunk" ADD CONSTRAINT "ModuleSourceChunk_parentChunkId_fkey" FOREIGN KEY ("parentChunkId") REFERENCES "ModuleSourceChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('LOGIN', 'MODULE_ACCESS', 'QUIZ_START', 'QUIZ_COMPLETE', 'SCORE_RECORDED');

-- DropForeignKey
ALTER TABLE "ModuleSourceChunk" DROP CONSTRAINT IF EXISTS "ModuleSourceChunk_parentChunkId_fkey";

-- AlterTable - drop columns that exist in DB but were removed from schema
ALTER TABLE "ModuleSourceChunk"
  DROP COLUMN IF EXISTS "embeddingModel",
  DROP COLUMN IF EXISTS "page",
  DROP COLUMN IF EXISTS "parentChunkId",
  DROP COLUMN IF EXISTS "sectionTitle",
  DROP COLUMN IF EXISTS "sourceType";

-- CreateTable
CREATE TABLE "StudentModuleScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentModuleScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "ActivityEventType" NOT NULL,
    "moduleId" TEXT,
    "sessionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentModuleScore_userId_moduleId_idx" ON "StudentModuleScore"("userId", "moduleId");

-- CreateIndex
CREATE INDEX "StudentModuleScore_moduleId_completedAt_idx" ON "StudentModuleScore"("moduleId", "completedAt");

-- CreateIndex
CREATE INDEX "StudentModuleScore_userId_completedAt_idx" ON "StudentModuleScore"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_eventType_idx" ON "ActivityLog"("eventType");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_moduleId_eventType_idx" ON "ActivityLog"("moduleId", "eventType");

-- AddForeignKey
ALTER TABLE "StudentModuleScore" ADD CONSTRAINT "StudentModuleScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentModuleScore" ADD CONSTRAINT "StudentModuleScore_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

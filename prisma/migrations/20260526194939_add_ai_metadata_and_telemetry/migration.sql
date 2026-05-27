-- CreateTable
CREATE TABLE "AiGenerationMetadata" (
    "id" TEXT NOT NULL,
    "pipeline" TEXT NOT NULL,
    "promptUsed" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "generationTimeMs" INTEGER NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "criticScore" DOUBLE PRECISION NOT NULL,
    "criticMetrics" JSONB NOT NULL,
    "retrievedChunks" JSONB NOT NULL,
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moduleId" TEXT,
    "sessionId" TEXT,

    CONSTRAINT "AiGenerationMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentQuizTelemetry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "chosenOptionIndex" INTEGER NOT NULL,
    "difficultyLevel" "Difficulty" NOT NULL,
    "perceivedDifficulty" DOUBLE PRECISION,
    "retentionScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentQuizTelemetry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentQuizTelemetry_userId_moduleId_idx" ON "StudentQuizTelemetry"("userId", "moduleId");

-- CreateIndex
CREATE INDEX "StudentQuizTelemetry_questionId_idx" ON "StudentQuizTelemetry"("questionId");

-- AddForeignKey
ALTER TABLE "AiGenerationMetadata" ADD CONSTRAINT "AiGenerationMetadata_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGenerationMetadata" ADD CONSTRAINT "AiGenerationMetadata_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QuizSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuizTelemetry" ADD CONSTRAINT "StudentQuizTelemetry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuizTelemetry" ADD CONSTRAINT "StudentQuizTelemetry_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuizTelemetry" ADD CONSTRAINT "StudentQuizTelemetry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QuizSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

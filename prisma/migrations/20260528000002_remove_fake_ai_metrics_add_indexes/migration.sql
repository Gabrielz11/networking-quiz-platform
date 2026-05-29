-- P2.3 — Remove campos de telemetria placeholder do modelo AiGenerationMetadata.
-- criticScore era sempre 1.0, criticMetrics era sempre {}, retrievedChunks era sempre [].
-- Esses campos poluíam os dashboards de AI metrics com dados falsos.
ALTER TABLE "AiGenerationMetadata" DROP COLUMN IF EXISTS "criticScore";
ALTER TABLE "AiGenerationMetadata" DROP COLUMN IF EXISTS "criticMetrics";
ALTER TABLE "AiGenerationMetadata" DROP COLUMN IF EXISTS "retrievedChunks";

-- P3.2 — Índice em QuestionInstance.sessionId.
-- O Postgres não indexa FKs automaticamente; esta query é executada em todo fluxo de quiz.
CREATE INDEX IF NOT EXISTS "QuestionInstance_sessionId_idx" ON "QuestionInstance" ("sessionId");

-- P3.2 — Índice composto em QuizSession para a query de sessão ativa (userId + moduleId + status).
CREATE INDEX IF NOT EXISTS "QuizSession_userId_moduleId_status_idx" ON "QuizSession" ("userId", "moduleId", "status");

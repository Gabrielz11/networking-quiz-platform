-- P1.3 — Garante idempotência no registro de notas: uma sessão completada nunca
-- gera mais de uma nota, mesmo se registerCompletedSession for chamado múltiplas vezes.
ALTER TABLE "StudentModuleScore"
  ADD CONSTRAINT "StudentModuleScore_sessionId_key" UNIQUE ("sessionId");

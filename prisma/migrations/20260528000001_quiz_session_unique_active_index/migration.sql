-- P1.3 — Índice único parcial: garante que um usuário só pode ter uma QuizSession
-- IN_PROGRESS por módulo no banco de dados. O Prisma não suporta índices parciais
-- com cláusula WHERE, por isso este índice é gerenciado via migration SQL crua.
-- Em session/start o código trata a violação (P2002) retornando a sessão existente.
CREATE UNIQUE INDEX "QuizSession_active_unique"
  ON "QuizSession" ("userId", "moduleId")
  WHERE status = 'IN_PROGRESS';

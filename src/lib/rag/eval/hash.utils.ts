// src/lib/rag/eval/hash.utils.ts
//
// Utilitário para cálculo de hash SHA-256 do conteúdo de módulos.
// Utilizado para identificar mudanças no conteúdo e garantir idempotência
// na avaliação RAGAS (Faithfulness).

import { createHash } from "crypto";

/**
 * Calcula o SHA-256 do conteúdo do módulo após normalização mínima.
 *
 * A normalização garante que diferenças triviais (line endings, espaços
 * em branco no início/fim) não produzam hashes diferentes.
 */
export function computeContentHash(content: string): string {
    const normalized = content.trim().replace(/\r\n/g, "\n");
    return createHash("sha256").update(normalized, "utf8").digest("hex");
}

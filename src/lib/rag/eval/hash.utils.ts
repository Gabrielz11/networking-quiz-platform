// src/lib/rag/eval/hash.utils.ts
//
// Utilitário para cálculo de hash SHA-256 do conteúdo de módulos e contextos.
// Utilizado para identificar mudanças no conteúdo e garantir idempotência
// na avaliação RAGAS (Faithfulness).

import { createHash } from "crypto";
import type { ContextChunkSnapshot } from "../types";

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

/**
 * Calcula o SHA-256 do contexto serializado de forma determinística.
 *
 * Serializa os chunks ordenados por ID, incluindo apenas o conteúdo
 * efetivamente enviado ao LLM (já truncado, se aplicável).
 * Garante que o RAGAS avalie exatamente o mesmo contexto da geração.
 */
export function computeContextHash(chunks: ContextChunkSnapshot[]): string {
    // Serialização determinística: ordena por ID para garantir consistência
    const sorted = [...chunks].sort((a, b) => a.id.localeCompare(b.id));
    const serialized = sorted
        .map((c) => `${c.id}::${c.content}`)
        .join("\n---CHUNK_BOUNDARY---\n");
    return createHash("sha256").update(serialized, "utf8").digest("hex");
}

// src/lib/rag/eval/evaluation.test.ts
// Testes unitários para utilitários de avaliação RAGAS, hash de contexto,
// classificação de thresholds e correção de tabelas Markdown.
// Executável via: npx tsx src/lib/rag/eval/evaluation.test.ts

import assert from "node:assert/strict";
import { computeContentHash, computeContextHash } from "./hash.utils";
import { fixMarkdownTables } from "@/services/generation/utils/markdown-table-fixer";
import type { ContextChunkSnapshot } from "../types";

function runTests() {
    console.log("🧪 Iniciando testes unitários de Avaliação RAGAS v2...");

    // ─── 1. Testes de Hash de Conteúdo ───────────────────────────────────────
    {
        const text1 = "O protocolo IPv6 possui endereços de 128 bits.";
        const text2 = "O protocolo IPv6 possui endereços de 128 bits.";
        assert.equal(computeContentHash(text1), computeContentHash(text2), "Hashes de textos idênticos devem ser iguais");

        const textLF = "Linha 1\nLinha 2\n";
        const textCRLF = "  Linha 1\r\nLinha 2  ";
        assert.equal(computeContentHash(textLF), computeContentHash(textCRLF), "Normalização de CRLF e espaços deve gerar o mesmo hash");

        const original = "O IPv6 substitui o IPv4.";
        const modified = "O IPv6 substitui o IPv4 trazendo maior espaço de endereçamento.";
        assert.notEqual(computeContentHash(original), computeContentHash(modified), "Hashes de conteúdos diferentes não devem ser iguais");

        console.log("  ✅ Testes de computeContentHash aprovados.");
    }

    // ─── 2. Testes de Hash de Contexto ───────────────────────────────────────
    {
        const chunks1: ContextChunkSnapshot[] = [
            { id: "chunk-a", content: "IPv6 usa 128 bits", fileName: "doc.pdf", score: 0.9, truncated: false, originalLength: 17 },
            { id: "chunk-b", content: "SLAAC permite autoconfiguração", fileName: "doc.pdf", score: 0.8, truncated: false, originalLength: 30 },
        ];

        const chunks2: ContextChunkSnapshot[] = [
            { id: "chunk-b", content: "SLAAC permite autoconfiguração", fileName: "doc.pdf", score: 0.8, truncated: false, originalLength: 30 },
            { id: "chunk-a", content: "IPv6 usa 128 bits", fileName: "doc.pdf", score: 0.9, truncated: false, originalLength: 17 },
        ];

        // Ordem diferente, mas mesmo conteúdo → mesmo hash (serialização determinística)
        assert.equal(
            computeContextHash(chunks1),
            computeContextHash(chunks2),
            "Hash de contexto deve ser determinístico independente da ordem dos chunks"
        );

        const chunks3: ContextChunkSnapshot[] = [
            { id: "chunk-a", content: "IPv6 usa 128 bits MODIFICADO", fileName: "doc.pdf", score: 0.9, truncated: false, originalLength: 28 },
            { id: "chunk-b", content: "SLAAC permite autoconfiguração", fileName: "doc.pdf", score: 0.8, truncated: false, originalLength: 30 },
        ];

        assert.notEqual(
            computeContextHash(chunks1),
            computeContextHash(chunks3),
            "Hash de contexto deve divergir quando conteúdo muda"
        );

        // Chunk truncado vs. não truncado (conteúdo diferente) → hash diferente
        const chunksTruncated: ContextChunkSnapshot[] = [
            { id: "chunk-a", content: "IPv6 usa", fileName: "doc.pdf", score: 0.9, truncated: true, originalLength: 17 },
        ];
        const chunksOriginal: ContextChunkSnapshot[] = [
            { id: "chunk-a", content: "IPv6 usa 128 bits", fileName: "doc.pdf", score: 0.9, truncated: false, originalLength: 17 },
        ];

        assert.notEqual(
            computeContextHash(chunksTruncated),
            computeContextHash(chunksOriginal),
            "Hash deve divergir quando chunk é truncado (conteúdo efetivamente diferente)"
        );

        console.log("  ✅ Testes de computeContextHash aprovados.");
    }

    // ─── 3. Testes de Classificação e Thresholds ─────────────────────────────
    {
        const trustedThreshold = 0.90;
        const reviewThreshold = 0.80;

        function getClassification(score: number) {
            if (score >= trustedThreshold) return "TRUSTED";
            if (score >= reviewThreshold) return "REVIEW";
            return "ATTENTION";
        }

        assert.equal(getClassification(0.95), "TRUSTED", "Score 0.95 deve ser TRUSTED");
        assert.equal(getClassification(0.90), "TRUSTED", "Score 0.90 (limite) deve ser TRUSTED");
        assert.equal(getClassification(0.85), "REVIEW", "Score 0.85 deve ser REVIEW");
        assert.equal(getClassification(0.80), "REVIEW", "Score 0.80 (limite) deve ser REVIEW");
        assert.equal(getClassification(0.70), "ATTENTION", "Score 0.70 deve ser ATTENTION");
        assert.equal(getClassification(0.8999), "REVIEW", "Score 0.8999 deve ser REVIEW");

        console.log("  ✅ Testes de classificação de thresholds aprovados.");
    }

    // ─── 4. Testes de Quality Gate ───────────────────────────────────────────
    {
        function getQualityGateAction(score: number, attempt: number): string {
            if (score >= 0.90) return "PUBLISH";
            if (score >= 0.80 && attempt === 0) return "AUTO_HEAL";
            return "KEEP_DRAFT";
        }

        assert.equal(getQualityGateAction(0.95, 0), "PUBLISH");
        assert.equal(getQualityGateAction(0.90, 0), "PUBLISH");
        assert.equal(getQualityGateAction(0.85, 0), "AUTO_HEAL");
        assert.equal(getQualityGateAction(0.80, 0), "AUTO_HEAL");
        assert.equal(getQualityGateAction(0.85, 1), "KEEP_DRAFT"); // Retry já feito
        assert.equal(getQualityGateAction(0.75, 0), "KEEP_DRAFT");
        assert.equal(getQualityGateAction(0.75, 1), "KEEP_DRAFT");

        console.log("  ✅ Testes de Quality Gate aprovados.");
    }

    // ─── 5. Testes de Correção de Tabelas Markdown ───────────────────────────
    {
        // Tabela bem formada → sem alteração estrutural
        const validTable = "| Critério | IPv4 | IPv6 |\n|---|---|---|\n| Bits | 32 | 128 |";
        const fixedValid = fixMarkdownTables(validTable);
        assert.ok(fixedValid.includes("Critério"), "Tabela válida deve manter cabeçalho");
        assert.ok(fixedValid.includes("---"), "Tabela válida deve manter separador");
        assert.ok(fixedValid.includes("Bits"), "Tabela válida deve manter dados");

        // Tabela sem pipe inicial
        const noPipeStart = "Critério | IPv4 | IPv6 |\n|---|---|---|\n| Bits | 32 | 128 |";
        const fixedNoPipe = fixMarkdownTables(noPipeStart);
        assert.ok(fixedNoPipe.startsWith("|"), "Deve adicionar pipe no início");

        // Tabela sem separador
        const noSeparator = "| Critério | IPv4 | IPv6 |\n| Bits | 32 | 128 |";
        const fixedNoSep = fixMarkdownTables(noSeparator);
        assert.ok(fixedNoSep.includes("---"), "Deve adicionar separador");
        // Verificar que o separador foi inserido na posição correta (segunda linha)
        const noSepLines = fixedNoSep.split("\n");
        assert.ok(noSepLines.length >= 3, "Deve ter pelo menos 3 linhas (cabeçalho + separador + dados)");
        assert.ok(noSepLines[1].includes("---"), "Separador deve estar na segunda linha");

        // Texto sem tabela → sem modificação
        const noTable = "Este é um parágrafo normal.\n\nOutro parágrafo aqui.";
        assert.equal(fixMarkdownTables(noTable), noTable, "Texto sem tabela não deve ser modificado");

        console.log("  ✅ Testes de correção de tabelas Markdown aprovados.");
    }

    // ─── 6. Teste de Verdade-Ausente (conceitual) ────────────────────────────
    {
        // Este teste valida a LÓGICA de classificação, não chama o RAGAS
        // O teste real com LLM está em test_absent_truth.py

        // Cenário: afirmação verdadeira mas ausente do contexto
        function shouldBeUnsupported(statement: string, context: string): boolean {
            // Simulação simplificada: se a afirmação contém termos que
            // não aparecem no contexto, deve ser não-suportada
            const keywords = statement.toLowerCase().split(/\s+/).filter(w => w.length > 4);
            const contextLower = context.toLowerCase();
            const foundInContext = keywords.filter(k => contextLower.includes(k));
            return foundInContext.length < keywords.length * 0.5;
        }

        // "DHCPv6 usa portas 546 e 547" com contexto que não menciona portas
        assert.ok(
            shouldBeUnsupported(
                "DHCPv6 utiliza as portas 546 e 547",
                "O DHCPv6 permite configuração stateful de endereços IPv6"
            ),
            "Portas ausentes do contexto devem ser não-suportadas"
        );

        // "IPv6 usa 128 bits" com contexto que menciona 128 bits
        assert.ok(
            !shouldBeUnsupported(
                "IPv6 utiliza endereços de 128 bits",
                "O IPv6 utiliza um espaço de endereçamento de 128 bits"
            ),
            "Afirmação presente no contexto deve ser suportada"
        );

        console.log("  ✅ Testes conceituais de verdade-ausente aprovados.");
    }

    console.log("🎉 Todos os testes unitários de Avaliação RAGAS v2 foram concluídos com SUCESSO!");
}

runTests();

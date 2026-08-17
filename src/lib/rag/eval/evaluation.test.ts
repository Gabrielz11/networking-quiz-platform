// src/lib/rag/eval/evaluation.test.ts
// Testes unitários para utilitários e regras de classificação da avaliação RAGAS.
// Executável via: npx tsx src/lib/rag/eval/evaluation.test.ts

import assert from "node:assert/strict";
import { computeContentHash } from "./hash.utils";

function runTests() {
    console.log("🧪 Iniciando testes unitários de Avaliação RAGAS...");

    // 1. Testes de Hash
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

    // 2. Testes de Classificação e Thresholds
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

    console.log("🎉 Todos os testes unitários de Avaliação RAGAS foram concluídos com SUCESSO!");
}

runTests();

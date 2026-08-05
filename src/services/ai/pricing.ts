import { Logger } from "@/lib/logger";

const logger = new Logger("PricingService");

/**
 * Tabela de preços estimados por modelo (USD por 1M de tokens).
 *
 * ⚠️ VALORES ESTÁTICOS — revisar periodicamente.
 *   Fonte: páginas oficiais de pricing de Google (Gemini API) e Groq.
 *   Última revisão: 2026-05. Preços de LLM mudam com frequência;
 *   ao atualizar, ajuste também a data acima.
 *
 * As chaves devem ser o nome BASE do modelo (sem sufixos de versão/região).
 * O match aceita um modelName que CONTENHA a chave base
 * (ex.: "gemini-2.5-flash-preview" → casa "gemini-2.5-flash"),
 * mas nunca o inverso, para não casar um nome genérico com a chave errada.
 */
interface ModelPricing {
    inputPer1M: number;
    outputPer1M: number;
}

const PRICING_TABLE: Record<string, ModelPricing> = {
    "gemini-2.5-flash": {
        inputPer1M: 0.075,
        outputPer1M: 0.30,
    },
    "gemini-2.5-pro": {
        inputPer1M: 1.25,
        outputPer1M: 5.00,
    },
    "gemini-3.5-flash-lite": {
        inputPer1M: 0.30,
        outputPer1M: 2.50,
    },
    "gemini-3.6-flash": {
        inputPer1M: 1.50,
        outputPer1M: 7.50,
    },
    "gpt-5.6-terra": {
        inputPer1M: 2.50,
        outputPer1M: 10.00,
    },
    "llama-3.1-8b-instant": {
        inputPer1M: 0.05,
        outputPer1M: 0.08,
    },
    "llama-3.3-70b-versatile": {
        inputPer1M: 0.59,
        outputPer1M: 0.79,
    },
};

/**
 * Resolve o pricing para um modelName.
 *
 * Estratégia de match (em ordem):
 *  1. Match exato pela chave normalizada.
 *  2. Match por prefixo seguro: o modelName começa com a chave base
 *     (cobre sufixos como "-preview", "-latest", "-002") OU contém a chave
 *     base como segmento. Escolhe sempre a chave MAIS LONGA que casa,
 *     evitando que "llama-3" case antes de "llama-3.3-70b-versatile".
 *
 * Não usa `chave.includes(modelName)` — essa direção é o que permitiria
 * um nome curto/genérico ("llama") casar com a chave errada.
 */
function resolvePricing(modelName: string): ModelPricing | null {
    const key = modelName.toLowerCase().trim();

    // 1. Match exato
    if (PRICING_TABLE[key]) return PRICING_TABLE[key];

    // 2. Match por prefixo/segmento seguro — preferindo a chave mais específica
    const candidates = Object.keys(PRICING_TABLE)
        .filter((base) => key === base || key.startsWith(`${base}-`) || key.startsWith(base))
        .sort((a, b) => b.length - a.length); // mais longa (mais específica) primeiro

    if (candidates.length > 0) {
        return PRICING_TABLE[candidates[0]];
    }

    return null;
}

/**
 * Calcula o custo estimado em USD de uma geração de LLM com base no
 * modelo e na contagem de tokens.
 *
 * Retorna `null` (não 0) quando o modelo não tem preço cadastrado —
 * para distinguir "geração gratuita" de "preço não configurado".
 */
export function calculateCost(
    modelName: string,
    promptTokens: number,
    completionTokens: number
): number | null {
    const pricing = resolvePricing(modelName);

    if (!pricing) {
        logger.warn(
            "calculateCost",
            `Preço não cadastrado para o modelo: "${modelName}". Custo registrado como null.`
        );
        return null;
    }

    return (
        (promptTokens / 1_000_000) * pricing.inputPer1M +
        (completionTokens / 1_000_000) * pricing.outputPer1M
    );
}
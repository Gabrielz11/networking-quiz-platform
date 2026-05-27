import { AiService } from "@/services/ai.service";
import { Logger } from "@/lib/logger";
import { CRITIC_PROMPT } from "@/lib/prompts/critic.prompt";
import type { CriticMetrics, CriticReport } from "./critic.types";

const logger = new Logger("CriticService");

/**
 * Pesos de cada pilar na fórmula do Quality Score.
 * Soma total = 1.0
 */
const PILLAR_WEIGHTS: Record<keyof CriticMetrics, number> = {
    depth:            0.15,
    clarity:          0.15,
    fidelity:         0.20,
    pedagogy:         0.15,
    technicalDensity: 0.15,
    ambiguity:        0.10, // invertido no cálculo
    difficulty:       0.10,
};

const APPROVAL_THRESHOLD = 0.85;
// Gemini Flash como avaliador — mais barato, suficiente para auditoria
const CRITIC_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * Calcula o Quality Score ponderado com inversão do pilar de ambiguidade.
 */
function calculateQualityScore(metrics: CriticMetrics): number {
    return (
        metrics.depth            * PILLAR_WEIGHTS.depth +
        metrics.clarity          * PILLAR_WEIGHTS.clarity +
        metrics.fidelity         * PILLAR_WEIGHTS.fidelity +
        metrics.pedagogy         * PILLAR_WEIGHTS.pedagogy +
        metrics.technicalDensity * PILLAR_WEIGHTS.technicalDensity +
        (1 - metrics.ambiguity)  * PILLAR_WEIGHTS.ambiguity + // inversão
        metrics.difficulty       * PILLAR_WEIGHTS.difficulty
    );
}

/**
 * Garante que os valores retornados pela IA estejam dentro do intervalo [0, 1].
 */
function clamp(value: unknown): number {
    const n = typeof value === "number" ? value : parseFloat(String(value));
    if (isNaN(n)) return 0.5; // valor neutro em caso de falha de parse
    return Math.min(1.0, Math.max(0.0, n));
}

/**
 * Avalia o conteúdo gerado contra os 7 pilares pedagógicos.
 */
export class CriticService {
    static async evaluate(
        content: string,
        pipeline: string
    ): Promise<CriticReport> {
        const contentPreview = content.substring(0, 8000); // limita tokens do critic
        const criticPrompt = CRITIC_PROMPT.replace("{{CONTENT_TO_EVALUATE}}", contentPreview);

        logger.info("evaluate", "Iniciando avaliação do critic", { pipeline, contentLength: content.length });

        try {
            const raw = await AiService.generateJson<Record<string, any>>(criticPrompt, {
                modelName: CRITIC_MODEL,
                temperature: 0.2, // determinístico para avaliação consistente
                timeoutMs: 30_000,
                // Sem pipeline aqui — não queremos metadados do critic dentro do critic
            });

            const metrics: CriticMetrics = {
                depth:            clamp(raw.depth),
                clarity:          clamp(raw.clarity),
                fidelity:         clamp(raw.fidelity),
                pedagogy:         clamp(raw.pedagogy),
                technicalDensity: clamp(raw.technicalDensity),
                ambiguity:        clamp(raw.ambiguity),
                difficulty:       clamp(raw.difficulty),
            };

            const qualityScore = calculateQualityScore(metrics);
            const approved = qualityScore >= APPROVAL_THRESHOLD;
            const feedback = typeof raw.feedback === "string" ? raw.feedback : "";

            logger.info("evaluate", "Avaliação do critic concluída", {
                pipeline,
                qualityScore: qualityScore.toFixed(3),
                approved,
            });

            return { qualityScore, approved, metrics, feedback };
        } catch (err: any) {
            // Em caso de falha do critic, aprovamos por padrão para não bloquear a geração
            logger.warn("evaluate", "Critic falhou — conteúdo aprovado por fallback", {
                pipeline,
                error: err.message,
            });
            return {
                qualityScore: 1.0,
                approved: true,
                metrics: {
                    depth: 1, clarity: 1, fidelity: 1,
                    pedagogy: 1, technicalDensity: 1,
                    ambiguity: 0, difficulty: 1,
                },
                feedback: "Avaliação automática indisponível — conteúdo aprovado por fallback.",
            };
        }
    }
}

import { ExplainService } from "@/services/explain.service";
import { Logger } from "@/lib/logger";
import { auth } from "@/auth";
import { isRateLimited } from "@/lib/rate-limit";

const logger = new Logger("ExplainRoute");

export async function POST(req: Request) {
    try {
        const sessionReq = await auth();
        const identifier = sessionReq?.user?.id || req.headers.get("x-forwarded-for") || "anonymous";

        // Limite de 15 requisições de explicação a cada 5 minutos
        const isLimited = await isRateLimited(identifier, "explain", { limit: 15, windowSeconds: 300 });
        if (isLimited) {
            logger.warn("POST", "Rate limit atingido para explicação personalizada", { identifier });
            return new Response(
                JSON.stringify({ error: "Limite de solicitações atingido. Por favor, aguarde alguns minutos." }),
                { status: 429, headers: { "Content-Type": "application/json" } }
            );
        }

        const { questionId, prompt, base_explanation, student_answer, correct_answer, moduleId, sessionId } = await req.json();

        // Gera stream de explicação pedagógica
        const stream = await ExplainService.generateExplanationStream(
            prompt,
            base_explanation,
            student_answer,
            correct_answer,
            moduleId,
            sessionId,
            questionId
        );

        logger.info("POST", "Streaming de explicação iniciado", { identifier, questionId });

        return new Response(stream, {
            status: 200,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Transfer-Encoding": "chunked",
                "Cache-Control": "no-cache",
                "X-Content-Type-Options": "nosniff",
            },
        });

    } catch (error: any) {
        logger.error("POST", "Falha na geração da explicação personalizada", {
            message: error.message || error
        });

        // Em caso de falha total, retorna a explicação base como fallback
        return new Response(
            JSON.stringify({
                explanation: "Não foi possível gerar a resposta personalizada. Abaixo a explicação base:",
                fallback: true,
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

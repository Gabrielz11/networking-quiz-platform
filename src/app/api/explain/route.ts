import { Logger } from "@/lib/logger";
import { requireUser, handleAuthError, AuthError } from "@/lib/auth-guard";
import { isRateLimited } from "@/lib/rate-limit";
import { ExplainStudentQuestionService, QuestionNotFoundError, AccessDeniedError } from "@/services/learning/explain-student-question.service";
import { z } from "zod";

const logger = new Logger("ExplainRoute");

const BodySchema = z.object({
    sessionId: z.string().min(1, "sessionId é obrigatório"),
    questionId: z.string().min(1, "questionId é obrigatório"),
    studentAnswerIndex: z.number().int().min(0).max(3),
});

export async function POST(req: Request) {
    try {
        // P0.3 — Exige login. Sem sessão válida → 401.
        const user = await requireUser();

        // P0.3 — Rate limit chaveado pelo user.id (nunca por IP anônimo)
        const isLimited = await isRateLimited(user.id!, "explain", { limit: 15, windowSeconds: 300 });
        if (isLimited) {
            logger.warn("POST", "Rate limit atingido para explicação personalizada", { userId: user.id });
            return Response.json(
                { error: "Limite de solicitações atingido. Por favor, aguarde alguns minutos." },
                { status: 429 }
            );
        }

        // P0.3 — Validação Zod: o cliente envia apenas dados não-sensíveis
        const rawBody = await req.json();
        const parsed = BodySchema.safeParse(rawBody);
        if (!parsed.success) {
            return Response.json(
                { error: "Parâmetros inválidos.", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { sessionId, questionId, studentAnswerIndex } = parsed.data;

        // Delega lógica de domínio, banco de dados e auditoria ao Use Case/Service
        const stream = await ExplainStudentQuestionService.execute({
            userId: user.id!,
            sessionId,
            questionId,
            studentAnswerIndex,
        });

        logger.info("POST", "Streaming de explicação iniciado", { userId: user.id, questionId });

        return new Response(stream, {
            status: 200,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Transfer-Encoding": "chunked",
                "Cache-Control": "no-cache",
                "X-Content-Type-Options": "nosniff",
            },
        });

    } catch (error: unknown) {
        if (error instanceof AuthError) {
            return handleAuthError(error);
        }

        if (error instanceof QuestionNotFoundError) {
            return Response.json({ error: error.message }, { status: 404 });
        }

        if (error instanceof AccessDeniedError) {
            return Response.json({ error: error.message }, { status: 403 });
        }

        logger.error("POST", "Falha na geração da explicação personalizada", {
            message: error instanceof Error ? error.message : String(error),
        });

        return Response.json(
            {
                explanation: "Não foi possível gerar a resposta personalizada. Abaixo a explicação base:",
                fallback: true,
            },
            { status: 500 }
        );
    }
}

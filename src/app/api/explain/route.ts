import { ExplainService } from "@/services/generation/explanation-generation.service";
import { Logger } from "@/lib/logger";
import { requireUser, handleAuthError, AuthError } from "@/lib/auth-guard";
import { isRateLimited } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
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
            return new Response(
                JSON.stringify({ error: "Limite de solicitações atingido. Por favor, aguarde alguns minutos." }),
                { status: 429, headers: { "Content-Type": "application/json" } }
            );
        }

        // P0.3 — Validação Zod: o cliente envia apenas dados não-sensíveis
        const rawBody = await req.json();
        const parsed = BodySchema.safeParse(rawBody);
        if (!parsed.success) {
            return new Response(
                JSON.stringify({ error: "Parâmetros inválidos.", details: parsed.error.flatten().fieldErrors }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const { sessionId, questionId, studentAnswerIndex } = parsed.data;

        // P0.3 — Buscar QuestionInstance do banco e validar que pertence ao usuário autenticado
        const questionInstance = await prisma.questionInstance.findUnique({
            where: { id: questionId },
            include: {
                session: {
                    select: { userId: true, moduleId: true },
                },
            },
        });

        if (!questionInstance || questionInstance.sessionId !== sessionId) {
            return new Response(
                JSON.stringify({ error: "Questão não encontrada." }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        if (questionInstance.session.userId !== user.id) {
            return new Response(
                JSON.stringify({ error: "Acesso negado." }),
                { status: 403, headers: { "Content-Type": "application/json" } }
            );
        }

        // P0.3 — Derivar todos os dados do banco; nenhum dado de gabarito vem do cliente
        const prompt = questionInstance.prompt;
        const baseExplanation = questionInstance.explanation ?? "";
        const correctAnswer = questionInstance.options[questionInstance.correctOptionIndex] ?? "";
        // studentAnswerIndex do cliente é não-sensível (o aluno sabe o que escolheu),
        // mas priorizamos o valor já armazenado no banco quando disponível.
        const resolvedStudentAnswerIndex = questionInstance.studentAnswer ?? studentAnswerIndex;
        const studentAnswer = questionInstance.options[resolvedStudentAnswerIndex] ?? "";

        // Gera stream de explicação pedagógica com dados 100% do banco
        const stream = await ExplainService.generateExplanationStream(
            prompt,
            baseExplanation,
            studentAnswer,
            correctAnswer,
            questionInstance.session.moduleId,
            sessionId,
            questionId
        );

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

        logger.error("POST", "Falha na geração da explicação personalizada", {
            message: error instanceof Error ? error.message : String(error),
        });

        return new Response(
            JSON.stringify({
                explanation: "Não foi possível gerar a resposta personalizada. Abaixo a explicação base:",
                fallback: true,
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

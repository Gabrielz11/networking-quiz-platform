import { Logger } from "@/lib/logger";
import { requireUser } from "@/lib/auth-guard";
import { withIdempotency } from "@/lib/idempotency/with-idempotency";
import { SubmitQuizAnswerService } from "@/services/learning/submit-quiz-answer.service";
import { handleSubmitQuizAnswerError } from "./handle-submit-quiz-answer-error";
import { z } from "zod";

const logger = new Logger("QuizAnswerRoute");

const AnswerSchema = z.object({
    sessionId: z.string().min(1, "ID da sessão é obrigatório"),
    questionId: z.string().min(1, "ID da questão é obrigatório"),
    studentAnswerIndex: z.number().int().min(0).max(3, "Índice de resposta deve ser entre 0 e 3"),
});

export async function POST(req: Request) {
    const start = Date.now();

    try {
        const user = await requireUser();

        return await withIdempotency({
            key: req.headers.get("Idempotency-Key"),
            logger,
            handler: async () => {
                const body = await req.json();
                const parsed = AnswerSchema.safeParse(body);

                if (!parsed.success) {
                    return {
                        status: 400,
                        body: {
                            error: "Parâmetros inválidos.",
                            details: parsed.error.flatten().fieldErrors,
                        },
                    };
                }

                const result = await SubmitQuizAnswerService.execute({
                    userId: user.id!,
                    ...parsed.data,
                });

                const responseJson = {
                    success: true,
                    isCorrect: result.isCorrect,
                    correctOptionIndex: result.correctOptionIndex,
                    explanation: result.explanation,
                    nextLevel: result.nextLevel,
                    completed: result.completed,
                    newScore: result.newScore,
                };

                logger.info("POST", "Resposta processada com sucesso", {
                    userId: user.id,
                    sessionId: parsed.data.sessionId,
                    isCorrect: result.isCorrect,
                    updatedScore: result.newScore,
                    isCompleted: result.completed,
                    durationMs: Date.now() - start,
                });

                return {
                    status: 200,
                    body: responseJson,
                };
            },
        });
    } catch (error: unknown) {
        return handleSubmitQuizAnswerError(error, logger);
    }
}

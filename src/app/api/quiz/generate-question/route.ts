import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { QuizQuestionGenerationService } from "@/services/generation/quiz-question-generation.service";
import { Logger } from "@/lib/logger";
import { isRateLimited } from "@/lib/rate-limit";

const logger = new Logger("QuizGenerateQuestionRoute");

export async function POST(req: Request) {
    const start = Date.now();
    try {
        const sessionReq = await auth();
        if (!sessionReq?.user) {
            return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
        }

        // Limite de 10 requisições de geração de questão a cada 5 minutos por usuário
        const isLimited = await isRateLimited(sessionReq.user.id!, "generate-question", { limit: 10, windowSeconds: 300 });
        if (isLimited) {
            logger.warn("POST", "Rate limit atingido para geração de questão", { userId: sessionReq.user.id });
            return NextResponse.json(
                { error: "Limite de solicitações atingido. Por favor, aguarde alguns minutos antes de solicitar outra questão." },
                { status: 429 }
            );
        }

        const body = await req.json();
        const { sessionId } = body;

        if (typeof sessionId !== "string" || sessionId.trim() === "") {
            return NextResponse.json(
                { error: "Parâmetro sessionId é obrigatório e deve ser uma string válida." },
                { status: 400 }
            );
        }

        logger.info("POST", "Gerando próxima questão adaptativa", {
            userId: sessionReq.user.id,
            sessionId,
        });

        // Fetch session with questions to check if we need to generate one
        const session = await prisma.quizSession.findUnique({
            where: { id: sessionId },
            include: {
                module: true,
                questions: true
            }
        });

        if (!session) {
            return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
        }

        if (session.userId !== sessionReq.user.id) {
            return NextResponse.json({ error: "Acesso negado à sessão." }, { status: 403 });
        }

        if (session.status === "COMPLETED") {
            return NextResponse.json({ error: "O quiz já foi finalizado." }, { status: 400 });
        }

        // Ele verifica se já existe uma pergunta criada naquela sessão que ainda não foi respondida.
        const pendingQuestions = session.questions.filter(q => q.studentAnswer === null);
        if (pendingQuestions.length > 0) {
            const existingQuestion = pendingQuestions[pendingQuestions.length - 1];
            // Omit sensitive data like correct option before sending to frontend
            const { correctOptionIndex, explanation, ...safeQuestion } = existingQuestion;
            return NextResponse.json({ success: true, question: safeQuestion });
        }

        const difficulty = session.currentLevel;
        const moduleContent = session.module.content;

        //Aqui eu pego todas as perguntas que já foram feitas naquela sessão e passo para a IA para que ela não repita as perguntas.
        //Ajuda porém não é 100% eficaz, pois a IA pode gerar perguntas similares mesmo com essa instrução.
        //Mas é melhor do que nada.
        const previousPrompts = session.questions.map(q => q.prompt);
        const qData = await QuizQuestionGenerationService.generate(
            difficulty,
            moduleContent,
            previousPrompts,
            session.moduleId,
            session.id
        );

        // Save the QuestionInstance
        const newQuestion = await prisma.questionInstance.create({
            data: {
                sessionId: session.id,
                difficulty: session.currentLevel,
                prompt: qData.prompt,
                options: qData.options,
                correctOptionIndex: qData.correct_option_index,
                explanation: qData.explanation
            }
        });

        // Omit sensitive data to prevent cheating
        const { correctOptionIndex, explanation, ...safeQuestion } = newQuestion;

        logger.info("POST", "Questão gerada pela IA e salva", {
            userId: sessionReq.user.id,
            sessionId,
            questionId: newQuestion.id,
            difficulty: session.currentLevel,
            durationMs: Date.now() - start,
        });

        return NextResponse.json({ success: true, question: safeQuestion });

    } catch (error: any) {
        logger.error("POST", "Falha na geração dinâmica da questão", {
            message: error.message || error
        });
        return NextResponse.json(
            { error: "Falha na geração da questão." },
            { status: 500 }
        );
    }
}

import { prisma } from "@/lib/prisma";
import { StudentActivityLogService } from "@/services/student-activity-log.service";
import { ExplainService } from "@/services/generation/explanation-generation.service";

export class QuestionNotFoundError extends Error {
    constructor(message: string = "Questão não encontrada.") {
        super(message);
        this.name = "QuestionNotFoundError";
    }
}

export class AccessDeniedError extends Error {
    constructor(message: string = "Acesso negado.") {
        super(message);
        this.name = "AccessDeniedError";
    }
}

export class ExplainStudentQuestionService {
    static async execute(params: {
        userId: string;
        sessionId: string;
        questionId: string;
        studentAnswerIndex: number;
    }): Promise<ReadableStream<Uint8Array>> {
        const questionInstance = await prisma.questionInstance.findUnique({
            where: { id: params.questionId },
            include: {
                session: {
                    select: {
                        userId: true,
                        moduleId: true,
                    },
                },
            },
        });

        if (!questionInstance || questionInstance.sessionId !== params.sessionId) {
            throw new QuestionNotFoundError();
        }

        if (questionInstance.session.userId !== params.userId) {
            throw new AccessDeniedError();
        }

        const prompt = questionInstance.prompt;
        const baseExplanation = questionInstance.explanation ?? "";
        const correctAnswer = questionInstance.options[questionInstance.correctOptionIndex] ?? "";

        // Prioriza a resposta salva no banco, mas usa o payload se não houver resposta salva
        const resolvedStudentAnswerIndex = questionInstance.studentAnswer ?? params.studentAnswerIndex;
        const studentAnswer = questionInstance.options[resolvedStudentAnswerIndex] ?? "";
        
        // Calcula se a resposta fornecida/salva está correta
        const isCorrect = questionInstance.correctOptionIndex === resolvedStudentAnswerIndex;

        // Registra o evento de solicitação no log de auditoria
        StudentActivityLogService.logAiExplanationRequested({
            studentId: params.userId,
            sessionId: params.sessionId,
            questionId: params.questionId,
            moduleId: questionInstance.session.moduleId,
            studentAnswer,
            questionPrompt: prompt,
            isCorrect,
        });

        // Gera e retorna o stream da explicação gerada por IA
        return ExplainService.generateExplanationStream(
            prompt,
            baseExplanation,
            studentAnswer,
            correctAnswer,
            questionInstance.session.moduleId,
            params.sessionId,
            params.questionId
        );
    }
}

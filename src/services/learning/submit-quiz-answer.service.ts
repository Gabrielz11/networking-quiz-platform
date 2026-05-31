import { quizRepository } from "@/repositories/quiz.repository";
import { QuizProgressionService } from "@/services/quiz-progression.service";
import { ScoreService } from "@/services/score.service";
import { ActivityService } from "@/services/activity.service";
import { StudentActivityLogService } from "@/services/student-activity-log.service";
import { QUIZ_QUESTION_LIMIT } from "@/lib/quiz-config";
import { Difficulty } from "@prisma/client";

export class SessionNotFoundError extends Error {
    constructor(message: string = "Sessão não encontrada.") {
        super(message);
        this.name = "SessionNotFoundError";
    }
}

export class SessionAccessDeniedError extends Error {
    constructor(message: string = "Acesso negado à sessão.") {
        super(message);
        this.name = "SessionAccessDeniedError";
    }
}

export class QuizAlreadyCompletedError extends Error {
    constructor(message: string = "O quiz já foi finalizado.") {
        super(message);
        this.name = "QuizAlreadyCompletedError";
    }
}

export class QuizQuestionNotFoundError extends Error {
    constructor(message: string = "Questão não encontrada nesta sessão.") {
        super(message);
        this.name = "QuizQuestionNotFoundError";
    }
}

export interface SubmitQuizAnswerResult {
    isCorrect: boolean;
    correctOptionIndex: number;
    explanation: string | null;
    nextLevel: Difficulty;
    completed: boolean;
    newScore: number;
}

export class SubmitQuizAnswerService {
    static async execute(params: {
        userId: string;
        sessionId: string;
        questionId: string;
        studentAnswerIndex: number;
    }): Promise<SubmitQuizAnswerResult> {
        const { userId, sessionId, questionId, studentAnswerIndex } = params;

        // 1. Busca a sessão do quiz
        const session = await quizRepository.findSessionById(sessionId);
        if (!session) {
            throw new SessionNotFoundError();
        }

        // 2. Valida ownership
        if (session.userId !== userId) {
            throw new SessionAccessDeniedError();
        }

        // 3. Valida se o quiz já está concluído
        if (session.status === "COMPLETED") {
            throw new QuizAlreadyCompletedError();
        }

        // 4. Valida se a questão pertence a esta sessão
        const question = session.questions.find((q) => q.id === questionId);
        if (!question) {
            throw new QuizQuestionNotFoundError();
        }

        // 5. Executa lógica pedagógica (se está correto e progressão adaptativa)
        const isCorrect = studentAnswerIndex === question.correctOptionIndex;

        const { nextLevel, nextErrors } = QuizProgressionService.calculateAdaptiveProgression(
            session.currentLevel,
            session.errorsInCurrentLevel,
            isCorrect
        );

        const updatedScore = isCorrect ? session.score + 1 : session.score;
        const nextIndex = session.currentQuestionIndex + 1;
        const isCompleted = nextIndex >= QUIZ_QUESTION_LIMIT;
        const responseTimeMs = Date.now() - question.createdAt.getTime();

        // 6. Grava no banco usando a transação atômica condicional do repositório
        await quizRepository.saveAnswerAndProgress({
            sessionId: session.id,
            questionId: question.id,
            studentAnswer: studentAnswerIndex,
            isCorrect,
            nextLevel,
            nextErrors,
            newScore: updatedScore,
            nextIndex,
            status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
            userId: userId,
            moduleId: session.moduleId,
            responseTimeMs,
            difficultyLevel: question.difficulty,
        });

        // 7. Dispara log de auditoria encapsulado
        StudentActivityLogService.logQuizAnswered({
            studentId: userId,
            moduleId: session.moduleId,
            questionId: question.id,
            isCorrect,
            difficulty: question.difficulty,
            responseTimeMs,
        });

        // 8. Registra finalização em Score e Activity se o quiz acabou
        if (isCompleted) {
            ScoreService.registerCompletedSession(userId, session.moduleId, sessionId, updatedScore);
            ActivityService.logQuizComplete(userId, session.moduleId, sessionId, updatedScore);
            ActivityService.logScoreRecorded(userId, session.moduleId, sessionId, updatedScore);
        }

        return {
            isCorrect,
            correctOptionIndex: question.correctOptionIndex,
            explanation: question.explanation,
            nextLevel,
            completed: isCompleted,
            newScore: updatedScore,
        };
    }
}

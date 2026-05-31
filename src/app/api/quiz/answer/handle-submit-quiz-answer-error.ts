import { NextResponse } from "next/server";
import { Logger } from "@/lib/logger";
import { AuthError, handleAuthError } from "@/lib/auth-guard";
import { AlreadyAnsweredError } from "@/repositories/quiz.repository";
import {
    SessionNotFoundError,
    SessionAccessDeniedError,
    QuizAlreadyCompletedError,
    QuizQuestionNotFoundError,
} from "@/services/learning/submit-quiz-answer.service";

export function handleSubmitQuizAnswerError(error: unknown, logger: Logger): NextResponse {
    if (error instanceof AuthError) {
        return handleAuthError(error);
    }

    if (error instanceof SessionNotFoundError) {
        return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof SessionAccessDeniedError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof QuizAlreadyCompletedError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof QuizQuestionNotFoundError) {
        return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof AlreadyAnsweredError) {
        return NextResponse.json({ error: "A questão já foi respondida." }, { status: 409 });
    }

    logger.error("POST", "Falha ao processar resposta do estudante", {
        message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
        { error: "Falha ao analisar resposta da questão." },
        { status: 500 }
    );
}

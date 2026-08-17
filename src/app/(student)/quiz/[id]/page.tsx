"use client";

import { useEffect, useState, use, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QuizLoadingState } from "./_components/QuizLoadingState";
import { QuizResultsCard } from "./_components/QuizResultsCard";
import { QuizProgressBar } from "./_components/QuizProgressBar";
import { QuizQuestionCard, QuizFeedbackPanel } from "./_components/QuizQuestionCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useStreamingExplanation } from "@/hooks/useStreamingExplanation";

interface Question {
    id: string;
    prompt: string;
    options: string[];
    difficulty: "EASY" | "MEDIUM" | "HARD";
}

interface AttemptResult {
    questionId: string;
    prompt: string;
    chosenIndex: number;
    correctIndex: number;
    isCorrect: boolean;
    explanationAi: string | null;
    options: string[];
    difficulty: string;
}

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: moduleId } = use(params);
    const router = useRouter();

    const [sessionId, setSessionId] = useState<string | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [currentDifficulty, setCurrentDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("EASY");
    const [questionsAnswered, setQuestionsAnswered] = useState(0);
    const [score, setScore] = useState(0);

    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [generatingQuestion, setGeneratingQuestion] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [correctIndex, setCorrectIndex] = useState<number | null>(null);
    const [showingFeedback, setShowingFeedback] = useState(false);

    const [results, setResults] = useState<AttemptResult[]>([]);
    const [finished, setFinished] = useState(false);
    const [idempotencyKey, setIdempotencyKey] = useState<string>("");

    // Hook customizado com suporte a AbortController, cancelamento e controle de estado
    const { streamedText, streamingState, startStream, reset } = useStreamingExplanation();
    const isStreaming = streamingState === "streaming";

    const initQuizRef = useRef(false);
    const isFetchingRef = useRef(false);

    // Cancelamento automático do stream ao desmontar o componente da página
    useEffect(() => {
        return () => {
            reset();
        };
    }, [reset]);

    // ── 1. Inicia ou retoma sessão ──────────────────────────────────────────

    useEffect(() => {
        if (initQuizRef.current) return;
        initQuizRef.current = true;

        const initQuiz = async () => {
            reset();
            try {
                const res = await fetch("/api/quiz/session/start", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ moduleId }),
                });
                const data = await res.json();

                if (data.success) {
                    const session = data.quizSession;
                    setSessionId(session.id);
                    setScore(session.score);
                    setCurrentDifficulty(session.currentLevel);

                    // Preenche os resultados anteriores
                    const previousResults = (session.questions as any[])
                        .filter((q) => q.studentAnswer !== null)
                        .map((q) => ({
                            questionId: q.id,
                            prompt: q.prompt,
                            chosenIndex: q.studentAnswer,
                            correctIndex: q.correctOptionIndex,
                            isCorrect: q.isCorrect ?? false,
                            explanationAi: q.explanation ?? null,
                            options: q.options,
                            difficulty: q.difficulty,
                        }));
                    setResults(previousResults);

                    if (session.status === "COMPLETED") {
                        setFinished(true);
                    } else {
                        const questionsList = session.questions as any[];
                        if (questionsList.length > 0) {
                            const lastQuestion = questionsList[questionsList.length - 1];
                            if (lastQuestion.studentAnswer !== null) {
                                // A última questão foi respondida, mas o usuário não avançou ainda
                                setCurrentQuestion({
                                    id: lastQuestion.id,
                                    prompt: lastQuestion.prompt,
                                    options: lastQuestion.options,
                                    difficulty: lastQuestion.difficulty,
                                });
                                setSelectedOption(lastQuestion.studentAnswer);
                                setCorrectIndex(lastQuestion.correctOptionIndex);
                                setShowingFeedback(true);
                                setQuestionsAnswered(Math.max(0, session.currentQuestionIndex - 1));
                            } else {
                                // A última questão ainda não foi respondida
                                setCurrentQuestion({
                                    id: lastQuestion.id,
                                    prompt: lastQuestion.prompt,
                                    options: lastQuestion.options,
                                    difficulty: lastQuestion.difficulty,
                                });
                                setSelectedOption(null);
                                setCorrectIndex(null);
                                setShowingFeedback(false);
                                setQuestionsAnswered(session.currentQuestionIndex);
                            }
                        } else {
                            // Nenhuma questão gerada ainda
                            setQuestionsAnswered(0);
                            fetchNextQuestion(session.id);
                        }
                    }
                } else {
                    toast.error("Erro ao iniciar quiz.");
                }
            } catch {
                toast.error("Erro de conexão.");
            } finally {
                setLoading(false);
            }
        };

        initQuiz();
    }, [moduleId]);

    // ── 2. Busca próxima questão da IA ──────────────────────────────────────

    const fetchNextQuestion = async (sid: string) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setGeneratingQuestion(true);
        reset();

        try {
            const res = await fetch("/api/quiz/generate-question", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: sid }),
            });
            const data = await res.json();

            if (data.success) {
                setCurrentQuestion(data.question);
                setIdempotencyKey(crypto.randomUUID());
                setSelectedOption(null);
                setShowingFeedback(false);
                setCorrectIndex(null);
                setError(null);
            } else {
                const msg = data.error || "Erro ao gerar questão.";
                toast.error(msg);
                setError(msg);
            }
        } catch {
            const msg = "Falha na comunicação com a IA.";
            toast.error(msg);
            setError(msg);
        } finally {
            setGeneratingQuestion(false);
            isFetchingRef.current = false;
        }
    };

    // ── 3. Processa resultado da resposta (useCallback evita closure stale) ─

    const processAnswerResult = useCallback(
        (data: any, question: Question, chosen: number, difficulty: "EASY" | "MEDIUM" | "HARD") => {
            const result: AttemptResult = {
                questionId: question.id,
                prompt: question.prompt,
                chosenIndex: chosen,
                correctIndex: data.correctOptionIndex,
                isCorrect: data.isCorrect,
                explanationAi: data.explanation ?? null,
                options: question.options,
                difficulty,
            };
            setResults((prev) => [...prev, result]);
            setCorrectIndex(data.correctOptionIndex);
            setScore(data.newScore);
            setCurrentDifficulty(data.nextLevel);
            setShowingFeedback(true);
        },
        []
    );

    // ── 4. Envia resposta do aluno ──────────────────────────────────────────

    const handleAnswer = async () => {
        if (selectedOption === null || !currentQuestion || !sessionId) return;

        setLoading(true);
        try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

            const res = await fetch("/api/quiz/answer", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    sessionId,
                    questionId: currentQuestion.id,
                    studentAnswerIndex: selectedOption,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                toast.error(data.error || "Erro ao processar resposta.");
                return;
            }

            // Captura valores antes de qualquer setState para evitar closure stale
            const snapshot = { question: currentQuestion, chosen: selectedOption, difficulty: currentDifficulty };
            processAnswerResult(data, snapshot.question, snapshot.chosen, snapshot.difficulty);

            // Se errou, dispara SSE de explicação personalizada via hook com AbortController
            if (!data.isCorrect) {
                startStream({
                    sessionId,
                    questionId: currentQuestion.id,
                    studentAnswerIndex: selectedOption,
                });
            }
        } catch {
            toast.error("Erro ao enviar resposta.");
        } finally {
            setLoading(false);
        }
    };

    const handleProceedAfterFeedback = () => {
        if (isStreaming) return;
        reset();
        const isCompleted = questionsAnswered + 1 >= 10;

        if (isCompleted) {
            setFinished(true);
        } else {
            setShowingFeedback(false);
            setSelectedOption(null);
            setCorrectIndex(null);
            setQuestionsAnswered((prev) => prev + 1);
            if (sessionId) fetchNextQuestion(sessionId);
        }
    };

    const handleFinish = async () => {
        router.push("/student");
    };

    // ── Render ───────────────────────────────────────────────────────────────

    if (loading && !sessionId) return <QuizLoadingState />;

    if (finished) {
        return <QuizResultsCard results={results} onFinish={handleFinish} />;
    }

    const isAnswerCorrect = correctIndex !== null && selectedOption !== null && correctIndex === selectedOption;

    return (
        <div className="container mx-auto py-4 px-4 h-[calc(100vh-120px)] max-w-6xl overflow-hidden flex flex-col">
            <div className={`grid gap-8 h-full ${(showingFeedback && !isAnswerCorrect) ? "md:grid-cols-2" : "max-w-xl mx-auto w-full"}`}>

                {/* Lado Esquerdo — Pergunta */}
                <div className="flex flex-col h-full overflow-y-auto scrollbar-thin pr-2 pb-4">
                    <div className="mb-3 shrink-0">
                        <Button
                            variant="ghost"
                            onClick={() => router.push(`/module/${moduleId}`)}
                            className="text-blue-600 hover:bg-blue-50 hover:underline p-2 h-auto -ml-2 mb-1 w-fit text-sm"
                        >
                            &larr; Voltar para o Módulo
                        </Button>
                    </div>

                    <div className="shrink-0">
                        <QuizProgressBar
                            questionsAnswered={questionsAnswered}
                            totalQuestions={10}
                            currentDifficulty={currentDifficulty.toLowerCase() as any}
                        />
                    </div>

                    {error ? (
                        <div className="py-12 flex flex-col items-center justify-center space-y-4">
                            <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-center">
                                <h3 className="text-base font-semibold text-red-700">Ops! Algo deu errado</h3>
                                <p className="text-red-500 mt-1 text-sm">{error}</p>
                            </div>
                            <Button onClick={() => sessionId && fetchNextQuestion(sessionId)} className="bg-blue-600 hover:bg-blue-700">
                                Tentar Novamente
                            </Button>
                        </div>
                    ) : generatingQuestion || !currentQuestion ? (
                        <div className="py-12 flex flex-col items-center justify-center space-y-4">
                            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            <div className="text-center">
                                <h3 className="text-base font-semibold text-slate-700">IA gerando questão adaptativa...</h3>
                                <p className="text-slate-400 mt-1 text-sm">Personalizando o nível para você.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-4 flex-1">
                            <QuizQuestionCard
                                currentQuestion={currentQuestion as any}
                                selectedOption={selectedOption}
                                showingFeedback={showingFeedback}
                                fetchingAi={loading}
                                aiFeedback={correctIndex !== null ? { explanationAi: null, correctIndex } : null}
                                onSelectOption={setSelectedOption}
                                onAnswer={handleAnswer}
                                onProceed={handleProceedAfterFeedback}
                                correctOptionIndexFromServer={correctIndex ?? undefined}
                                isLastQuestion={questionsAnswered + 1 >= 10}
                            />
                        </div>
                    )}
                </div>

                {/* Lado Direito — Feedback (desktop) */}
                {showingFeedback && !isAnswerCorrect && currentQuestion && (
                    <div className="h-full overflow-hidden border-l border-slate-100 pl-4 hidden md:block">
                        <QuizFeedbackPanel
                            showingFeedback={showingFeedback}
                            fetchingAi={loading}
                            isCorrect={correctIndex === selectedOption}
                            hasContent={streamedText.length > 0}
                            isStreaming={isStreaming}
                            displayText={streamedText}
                            onProceed={handleProceedAfterFeedback}
                            isLastQuestion={questionsAnswered + 1 >= 10}
                        />
                    </div>
                )}

                {/* Lado Direito — Feedback (mobile) */}
                {showingFeedback && !isAnswerCorrect && currentQuestion && (
                    <div className="md:hidden mt-4 pb-4">
                        <QuizFeedbackPanel
                            showingFeedback={showingFeedback}
                            fetchingAi={loading}
                            isCorrect={correctIndex === selectedOption}
                            hasContent={streamedText.length > 0}
                            isStreaming={isStreaming}
                            displayText={streamedText}
                            onProceed={handleProceedAfterFeedback}
                            isLastQuestion={questionsAnswered + 1 >= 10}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

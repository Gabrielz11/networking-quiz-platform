"use client";

import { useEffect, useState, use, useRef } from "react";
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
    const isFetchingRef = useRef(false);

    // AI feedback state (correctIndex vem do servidor após a resposta)
    const [correctIndex, setCorrectIndex] = useState<number | null>(null);
    const [showingFeedback, setShowingFeedback] = useState(false);

    // Dados para a tela de resultados finais
    const [results, setResults] = useState<AttemptResult[]>([]);
    const [finished, setFinished] = useState(false);
    const [idempotencyKey, setIdempotencyKey] = useState<string>("");

    // Hook de streaming de explicação
    const { streamedText, streamingState, startStream, reset: resetStream } = useStreamingExplanation();
    const isStreaming = streamingState === "streaming";

    const initQuizRef = useRef(false);

    // 1. Initial Load: Start or Resume Session
    useEffect(() => {
        let isMounted = true;
        if (initQuizRef.current) return;
        initQuizRef.current = true;

        const initQuiz = async () => {
            try {
                const res = await fetch("/api/quiz/session/start", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ moduleId })
                });
                const data = await res.json();

                if (!isMounted) return;

                if (data.success) {
                    setSessionId(data.quizSession.id);
                    setQuestionsAnswered(data.quizSession.currentQuestionIndex);
                    setScore(data.quizSession.score);
                    setCurrentDifficulty(data.quizSession.currentLevel);

                    if (data.quizSession.status === "COMPLETED") {
                        setFinished(true);
                    } else {
                        fetchNextQuestion(data.quizSession.id);
                    }
                } else {
                    toast.error("Erro ao iniciar quiz.");
                }
            } catch (err) {
                console.error(err);
                toast.error("Erro de conexão.");
            } finally {
                setLoading(false);
            }
        };

        initQuiz();

        return () => {
            isMounted = false;
        };
    }, [moduleId]);

    // 2. Fetch Question from IA
    const fetchNextQuestion = async (sid: string) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setGeneratingQuestion(true);
        resetStream();
        try {
            const res = await fetch("/api/quiz/generate-question", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: sid })
            });
            const data = await res.json();

            if (data.success) {
                setCurrentQuestion(data.question);
                const newKey = typeof window !== "undefined" && window.crypto?.randomUUID
                    ? window.crypto.randomUUID()
                    : (Math.random().toString(36).substring(2) + Date.now().toString(36));
                setIdempotencyKey(newKey);
                setSelectedOption(null);
                setShowingFeedback(false);
                setCorrectIndex(null);
                setError(null);
            } else {
                const errMsg = data.error || "Erro ao gerar questão.";
                toast.error(errMsg);
                setError(errMsg);
            }
        } catch (err) {
            const errMsg = "Falha na comunicação com a IA.";
            toast.error(errMsg);
            setError(errMsg);
        } finally {
            setGeneratingQuestion(false);
            isFetchingRef.current = false;
        }
    };

    // 3. Handle Answer Submission
    const handleAnswer = async () => {
        if (selectedOption === null || !currentQuestion || !sessionId) return;

        setLoading(true);
        try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (idempotencyKey) {
                headers["Idempotency-Key"] = idempotencyKey;
            }

            const res = await fetch("/api/quiz/answer", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    sessionId,
                    questionId: currentQuestion.id,
                    studentAnswerIndex: selectedOption
                })
            });
            const data = await res.json();

            if (data.success) {
                const newRes: AttemptResult = {
                    questionId: currentQuestion.id,
                    prompt: currentQuestion.prompt,
                    chosenIndex: selectedOption,
                    correctIndex: data.correctOptionIndex,
                    isCorrect: data.isCorrect,
                    explanationAi: data.explanation,
                    options: currentQuestion.options,
                    difficulty: currentDifficulty
                };
                setResults(prev => [...prev, newRes]);
                setCorrectIndex(data.correctOptionIndex);
                setScore(data.newScore);
                setCurrentDifficulty(data.nextLevel);
                setShowingFeedback(true);

                // Iniciar stream de explicação apenas se o aluno errou
                // (acerto recebe uma mensagem curta; erro merece explicação pedagógica completa)
                if (!data.isCorrect && currentQuestion) {
                    startStream({
                        prompt: currentQuestion.prompt,
                        base_explanation: data.explanation || "",
                        student_answer: currentQuestion.options[selectedOption] ?? "",
                        correct_answer: currentQuestion.options[data.correctOptionIndex] ?? "",
                        moduleId,
                        sessionId,
                    });
                }
            } else {
                toast.error("Erro ao processar resposta.");
            }
        } catch (err) {
            toast.error("Erro ao enviar resposta.");
        } finally {
            setLoading(false);
        }
    };

    const handleProceedAfterFeedback = async () => {
        if (isStreaming) return; // aguarda o stream terminar
        const isCompleted = (questionsAnswered + 1) >= 10;

        if (isCompleted) {
            setFinished(true);
        } else {
            setQuestionsAnswered(prev => prev + 1);
            if (sessionId) fetchNextQuestion(sessionId);
        }
    };

    const handleFinish = async () => {
        if (sessionId) {
            try {
                await fetch("/api/quiz/session/cleanup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId })
                });
            } catch (err) {
                console.error("Erro ao limpar sessão:", err);
            }
        }
        router.push("/student");
    };

    if (loading && !sessionId) return <QuizLoadingState />;

    if (finished) {
        return (
            <QuizResultsCard
                results={results}
                onFinish={handleFinish}
            />
        );
    }

    return (
        <div className="container mx-auto py-4 px-4 h-[calc(100vh-120px)] max-w-6xl overflow-hidden flex flex-col">
            <div className={`grid gap-8 h-full ${showingFeedback ? "md:grid-cols-2" : "max-w-xl mx-auto w-full"}`}>
                
                {/* Lado Esquerdo - Pergunta e Opções */}
                <div className="flex flex-col h-full overflow-y-auto scrollbar-thin pr-2 pb-4">
                    <div className="mb-3 shrink-0">
                        <Button variant="ghost" onClick={() => router.push(`/module/${moduleId}`)} className="text-blue-600 hover:bg-blue-50 hover:underline p-2 h-auto -ml-2 mb-1 w-fit text-sm">
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
                            <Button
                                onClick={() => sessionId && fetchNextQuestion(sessionId)}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                Tentar Novamente
                            </Button>
                        </div>
                    ) : (generatingQuestion || !currentQuestion) ? (
                        <div className="py-12 flex flex-col items-center justify-center space-y-4">
                            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
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
                                streamedText={showingFeedback ? streamedText : undefined}
                                isStreaming={isStreaming}
                                onSelectOption={setSelectedOption}
                                onAnswer={handleAnswer}
                                onProceed={handleProceedAfterFeedback}
                                correctOptionIndexFromServer={correctIndex ?? undefined}
                                isLastQuestion={questionsAnswered + 1 >= 10}
                            />
                        </div>
                    )}
                </div>

                {/* Lado Direito - Feedback da IA (Só aparece quando houver resposta) */}
                {showingFeedback && currentQuestion && (
                    <div className="h-full overflow-hidden border-l border-slate-100 pl-4 hidden md:block">
                        <QuizFeedbackPanel
                            showingFeedback={showingFeedback}
                            fetchingAi={loading}
                            isCorrect={correctIndex === selectedOption}
                            hasContent={(streamedText !== undefined ? streamedText : "").length > 0}
                            isStreaming={isStreaming}
                            displayText={streamedText !== undefined ? streamedText : ""}
                            onProceed={handleProceedAfterFeedback}
                            isLastQuestion={questionsAnswered + 1 >= 10}
                        />
                    </div>
                )}
                
                {/* Mobile version for feedback */}
                {showingFeedback && currentQuestion && (
                    <div className="md:hidden mt-4 pb-4">
                        <QuizFeedbackPanel
                            showingFeedback={showingFeedback}
                            fetchingAi={loading}
                            isCorrect={correctIndex === selectedOption}
                            hasContent={(streamedText !== undefined ? streamedText : "").length > 0}
                            isStreaming={isStreaming}
                            displayText={streamedText !== undefined ? streamedText : ""}
                            onProceed={handleProceedAfterFeedback}
                            isLastQuestion={questionsAnswered + 1 >= 10}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

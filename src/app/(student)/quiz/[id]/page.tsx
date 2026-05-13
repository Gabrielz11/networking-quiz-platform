"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { QuizLoadingState } from "./_components/QuizLoadingState";
import { QuizResultsCard } from "./_components/QuizResultsCard";
import { QuizProgressBar } from "./_components/QuizProgressBar";
import { QuizQuestionCard } from "./_components/QuizQuestionCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

    // AI feedback state
    const [aiFeedback, setAiFeedback] = useState<{ explanationAi: string | null, correctIndex: number | null } | null>(null);
    const [showingFeedback, setShowingFeedback] = useState(false);

    // Results
    const [results, setResults] = useState<AttemptResult[]>([]);
    const [finished, setFinished] = useState(false);

    // 1. Initial Load: Start or Resume Session
    useEffect(() => {
        let isMounted = true;

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
                        // Load current question for this session
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
        try {
            const res = await fetch("/api/quiz/generate-question", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: sid })
            });
            const data = await res.json();

            if (data.success) {
                setCurrentQuestion(data.question);
                setSelectedOption(null);
                setShowingFeedback(false);
                setAiFeedback(null);
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

        setLoading(true); // Small overlay for logic
        try {
            const res = await fetch("/api/quiz/answer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId,
                    questionId: currentQuestion.id,
                    studentAnswerIndex: selectedOption
                })
            });
            const data = await res.json();

            if (data.success) {
                // Add to results list for the final screen
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
                setAiFeedback({
                    explanationAi: data.explanation,
                    correctIndex: data.correctOptionIndex
                });
                
                setScore(data.newScore);
                setCurrentDifficulty(data.nextLevel); // SYNC UI BADGE
                setShowingFeedback(true);
                
                if (data.completed) {
                    // We'll show feedback first, then finish
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
        const isCompleted = (questionsAnswered + 1) >= 10;
        
        if (isCompleted) {
            setFinished(true);
        } else {
            setQuestionsAnswered(prev => prev + 1);
            // Refresh session status/difficulty from last result or let next fetch handle it
            // For simplicity, we just fetch the next one which will use the updated session state
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
        <div className="container mx-auto py-4 px-4 max-w-xl">
            <div className="mb-3">
                <Button variant="ghost" onClick={() => router.push(`/module/${moduleId}`)} className="text-blue-600 hover:bg-blue-50 hover:underline p-2 h-auto -ml-2 mb-1 w-fit text-sm">
                    &larr; Voltar para o Módulo
                </Button>
            </div>

            <QuizProgressBar
                questionsAnswered={questionsAnswered}
                totalQuestions={10}
                currentDifficulty={currentDifficulty.toLowerCase() as any}
            />

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
                <QuizQuestionCard
                    currentQuestion={currentQuestion as any}
                    selectedOption={selectedOption}
                    showingFeedback={showingFeedback}
                    fetchingAi={false} 
                    aiFeedback={aiFeedback}
                    onSelectOption={setSelectedOption}
                    onAnswer={handleAnswer}
                    onProceed={handleProceedAfterFeedback}
                    correctOptionIndexFromServer={aiFeedback?.correctIndex ?? undefined}
                    isLastQuestion={questionsAnswered + 1 >= 10}
                />
            )}
        </div>
    );
}

"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getQuizQuestions } from "../actions";
import { Question, AttemptResult } from "./_components/_types";
import { QuizLoadingState } from "./_components/QuizLoadingState";
import { QuizEmptyState } from "./_components/QuizEmptyState";
import { QuizResultsCard } from "./_components/QuizResultsCard";
import { QuizProgressBar } from "./_components/QuizProgressBar";
import { QuizQuestionCard } from "./_components/QuizQuestionCard";
import { Button } from "@/components/ui/button";

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [easyQs, setEasyQs] = useState<Question[]>([]);
    const [mediumQs, setMediumQs] = useState<Question[]>([]);
    const [hardQs, setHardQs] = useState<Question[]>([]);

    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [currentDifficulty, setCurrentDifficulty] = useState<"easy" | "medium" | "hard">("easy");
    const [consecutiveErrors, setConsecutiveErrors] = useState(0);
    const [questionsAnswered, setQuestionsAnswered] = useState(0);

    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // AI feedback state
    const [fetchingAi, setFetchingAi] = useState(false);
    const [aiFeedback, setAiFeedback] = useState<{ explanationAi: string | null, imageUrlAi: string | null, baseStr: string } | null>(null);
    const [showingFeedback, setShowingFeedback] = useState(false);

    // Results
    const [results, setResults] = useState<AttemptResult[]>([]);
    const [finished, setFinished] = useState(false);

    useEffect(() => {
        getQuizQuestions(id).then((data) => {
            if (data && data.length > 0) {
                const parsed: Question[] = data.map((q: any) => {
                    let diff: "easy" | "medium" | "hard" = "easy";
                    let baseTxt = q.explanationBase || "";
                    try {
                        const p = JSON.parse(q.explanationBase as string);
                        if (p.difficulty) diff = p.difficulty;
                        if (p.text) baseTxt = p.text;
                    } catch (e) {
                        // legacy or plain string
                    }
                    return { ...q, difficulty: diff, base_text: baseTxt };
                });

                setAllQuestions(parsed);
                const easy = parsed.filter(q => q.difficulty === "easy");
                const med = parsed.filter(q => q.difficulty === "medium");
                const hards = parsed.filter(q => q.difficulty === "hard");

                setEasyQs(easy);
                setMediumQs(med);
                setHardQs(hards);

                let firstLocal = easy.length > 0 ? easy[0] : (med.length > 0 ? med[0] : hards[0]);
                if (firstLocal) {
                    setCurrentQuestion(firstLocal);
                    setCurrentDifficulty(firstLocal.difficulty);
                    if (firstLocal.difficulty === "easy") setEasyQs(easy.slice(1));
                    else if (firstLocal.difficulty === "medium") setMediumQs(med.slice(1));
                    else setHardQs(hards.slice(1));
                }
            }
            setLoading(false);
        });
    }, [id]);

    const pullNextQuestion = (targetDiff: "easy" | "medium" | "hard") => {
        let e = [...easyQs];
        let m = [...mediumQs];
        let h = [...hardQs];

        let nextQ: Question | undefined;
        let actualDiff = targetDiff;

        if (targetDiff === "easy") {
            if (e.length > 0) { nextQ = e.shift(); }
            else if (m.length > 0) { nextQ = m.shift(); actualDiff = "medium" }
            else if (h.length > 0) { nextQ = h.shift(); actualDiff = "hard" }
        } else if (targetDiff === "medium") {
            if (m.length > 0) { nextQ = m.shift(); }
            else if (h.length > 0) { nextQ = h.shift(); actualDiff = "hard" }
            else if (e.length > 0) { nextQ = e.shift(); actualDiff = "easy" }
        } else if (targetDiff === "hard") {
            if (h.length > 0) { nextQ = h.shift(); }
            else if (m.length > 0) { nextQ = m.shift(); actualDiff = "medium" }
            else if (e.length > 0) { nextQ = e.shift(); actualDiff = "easy" }
        }

        setEasyQs(e);
        setMediumQs(m);
        setHardQs(h);

        if (nextQ) {
            setCurrentQuestion(nextQ);
            setCurrentDifficulty(actualDiff);
            setSelectedOption(null);
            setShowingFeedback(false);
            setAiFeedback(null);
            setQuestionsAnswered(prev => prev + 1);
        } else {
            setFinished(true);
        }
    };

    const handleAnswer = async () => {
        if (selectedOption === null || !currentQuestion) return;

        const isCorrect = selectedOption === currentQuestion.correctOptionIndex;

        if (isCorrect) {
            const newRes: AttemptResult = {
                questionId: currentQuestion.id,
                prompt: currentQuestion.prompt,
                chosenIndex: selectedOption,
                correctIndex: currentQuestion.correctOptionIndex,
                isCorrect: true,
                explanationAi: null,
                baseExplanation: currentQuestion.base_text,
                options: currentQuestion.options,
                difficulty: currentDifficulty
            };
            setResults(prev => [...prev, newRes]);
            setConsecutiveErrors(0);

            let nextDiff = currentDifficulty;
            if (currentDifficulty === "easy") nextDiff = "medium";
            else if (currentDifficulty === "medium") nextDiff = "hard";

            pullNextQuestion(nextDiff);

        } else {
            setFetchingAi(true);
            let explanationAi = null;
            let imageUrlAi = null;
            try {
                const aiReq = await fetch("/api/explain", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt: currentQuestion.prompt,
                        base_explanation: currentQuestion.base_text,
                        student_answer: currentQuestion.options[selectedOption],
                        correct_answer: currentQuestion.options[currentQuestion.correctOptionIndex],
                    }),
                });
                const aiData = await aiReq.json();
                if (aiData.fallback) {
                    explanationAi = `Sem resposta IA. Explicativo: ${currentQuestion.base_text}`;
                } else {
                    explanationAi = aiData.explanation;
                    imageUrlAi = aiData.imageUrl;
                }
            } catch (err) {
                explanationAi = `Erro de rede. Explicativo: ${currentQuestion.base_text}`;
            }
            setFetchingAi(false);

            setAiFeedback({
                explanationAi,
                imageUrlAi: imageUrlAi || null,
                baseStr: currentQuestion.base_text,
            });

            const newRes: AttemptResult = {
                questionId: currentQuestion.id,
                prompt: currentQuestion.prompt,
                chosenIndex: selectedOption,
                correctIndex: currentQuestion.correctOptionIndex,
                isCorrect: false,
                explanationAi,
                imageUrlAi,
                baseExplanation: currentQuestion.base_text,
                options: currentQuestion.options,
                difficulty: currentDifficulty
            };
            setResults(prev => [...prev, newRes]);
            setShowingFeedback(true);
        }
    };

    const handleProceedAfterFeedback = () => {
        let newErrors = consecutiveErrors + 1;

        let nextDiff = currentDifficulty;
        if (newErrors > 1) {
            if (currentDifficulty === "hard") nextDiff = "medium";
            else if (currentDifficulty === "medium") nextDiff = "easy";
            setConsecutiveErrors(0);
        } else {
            setConsecutiveErrors(newErrors);
        }

        pullNextQuestion(nextDiff);
    };

    if (loading) return <QuizLoadingState />;

    if (allQuestions.length === 0) return (
        <QuizEmptyState onBack={() => router.push("/dashboard/modules")} />
    );

    if (finished || !currentQuestion) {
        return (
            <QuizResultsCard
                results={results}
                onFinish={() => router.push("/")}
            />
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 max-w-2xl min-h-screen flex flex-col justify-center">
            <div className="mb-4">
                <Button variant="ghost" onClick={() => router.push(`/module/${id}`)} className="text-blue-600 hover:bg-blue-50 hover:underline p-2 h-auto -ml-2 mb-2 w-fit">
                    &larr; Voltar para o Módulo
                </Button>
            </div>

            <QuizProgressBar
                questionsAnswered={questionsAnswered}
                totalQuestions={allQuestions.length}
                currentDifficulty={currentDifficulty}
            />

            <QuizQuestionCard
                currentQuestion={currentQuestion}
                selectedOption={selectedOption}
                showingFeedback={showingFeedback}
                fetchingAi={fetchingAi}
                aiFeedback={aiFeedback}
                onSelectOption={setSelectedOption}
                onAnswer={handleAnswer}
                onProceed={handleProceedAfterFeedback}
            />
        </div>
    );
}

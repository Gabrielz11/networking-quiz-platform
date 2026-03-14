"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

interface Question {
    id: string;
    prompt: string;
    options: string[];
    correct_option_index: number;
    explanation_base: string; 
    difficulty: "easy" | "medium" | "hard";
    base_text: string;
}

interface AttemptResult {
    questionId: string;
    prompt: string;
    chosenIndex: number;
    correctIndex: number;
    isCorrect: boolean;
    explanationAi: string | null;
    imageUrlAi?: string | null;
    baseExplanation: string;
    options: string[];
    difficulty: string;
}

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
        supabase
            .from("questions")
            .select("*")
            .eq("module_id", id)
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const parsed: Question[] = data.map((q: any) => {
                        let diff: "easy" | "medium" | "hard" = "easy";
                        let baseTxt = q.explanation_base;
                        try {
                            const p = JSON.parse(q.explanation_base);
                            if (p.difficulty) diff = p.difficulty;
                            if (p.text) baseTxt = p.text;
                        } catch (e) {
                            // legacy string format
                        }
                        return { ...q, difficulty: diff, base_text: baseTxt };
                    });

                    setAllQuestions(parsed);
                    const easy = parsed.filter(q => q.difficulty === "easy");
                    const med = parsed.filter(q => q.difficulty === "medium");
                    const hards = parsed.filter(q => q.difficulty === "hard");

                    // Fallback se não vier alguma dificuldade
                    setEasyQs(easy);
                    setMediumQs(med);
                    setHardQs(hards);

                    // Inicializar primeira questão
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

        const isCorrect = selectedOption === currentQuestion.correct_option_index;

        if (isCorrect) {
            // Acertou: Registra e sobe dificuldade (ou mantém hard)
            const newRes: AttemptResult = {
                questionId: currentQuestion.id,
                prompt: currentQuestion.prompt,
                chosenIndex: selectedOption,
                correctIndex: currentQuestion.correct_option_index,
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
            // Errou: Busca explicação IA, exibe erro
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
                        correct_answer: currentQuestion.options[currentQuestion.correct_option_index],
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
                correctIndex: currentQuestion.correct_option_index,
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
            // Cai nível
            if (currentDifficulty === "hard") nextDiff = "medium";
            else if (currentDifficulty === "medium") nextDiff = "easy";
            setConsecutiveErrors(0); // reset
        } else {
            setConsecutiveErrors(newErrors);
        }

        pullNextQuestion(nextDiff);
    };

    if (loading) return <div className="p-8 text-center">Carregando quiz...</div>;

    if (allQuestions.length === 0) return (
        <div className="p-8 text-center">
            Nenhuma questão encontrada para este módulo. Retorne e gere questões com IA.
            <br />
            <Button className="mt-4" onClick={() => router.push("/dashboard/modules")}>Voltar</Button>
        </div>
    );

    if (finished || !currentQuestion) {
        const score = results.filter((r) => r.isCorrect).length;
        const totalAnswers = results.length;
        const progressPerc = totalAnswers > 0 ? Math.round((score / totalAnswers) * 100) : 0;

        return (
            <div className="container mx-auto py-8 max-w-3xl">
                <Card className="border-t-4 border-t-blue-600">
                    <CardHeader>
                        <CardTitle className="text-3xl text-center">Resultados do Quiz</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center mb-8">
                            <span className="text-5xl font-bold text-gray-900">{progressPerc}%</span>
                            <p className="text-xl text-gray-600">Pontuação Total ({score}/{totalAnswers})</p>
                        </div>

                        <Accordion type="single" collapsible className="w-full space-y-2">
                            {results.map((r, i) => (
                                <AccordionItem value={`item-${i}`} key={i}>
                                    <AccordionTrigger className="text-left py-2">
                                        <div className="flex items-center gap-4 w-full">
                                            {r.isCorrect ? (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Correto</Badge>
                                            ) : (
                                                <Badge variant="destructive">Incorreto</Badge>
                                            )}
                                            <span className="font-semibold text-gray-700">Q{i + 1} ({r.difficulty})</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4 bg-gray-50 rounded-lg mt-2">
                                        <p className="font-medium text-gray-800 mb-2">{r.prompt}</p>
                                        <p className="text-sm">Sua resposta: {r.options[r.chosenIndex]}</p>
                                        {!r.isCorrect && (
                                            <p className="text-sm text-green-600 mt-1 font-semibold">
                                                Gabarito: {r.options[r.correctIndex]}
                                            </p>
                                        )}

                                        {!r.isCorrect && r.explanationAi && (
                                            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded text-blue-900">
                                                <strong className="block mb-2">Explicação da IA Pedagógica:</strong>
                                                <div className="whitespace-pre-wrap text-sm leading-relaxed mb-4">
                                                    {r.explanationAi}
                                                </div>
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                    <CardFooter className="flex justify-center mt-6">
                        <Button size="lg" onClick={() => router.push("/")}>Finalizar e Voltar</Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    const progressPerc = ((questionsAnswered) / allQuestions.length) * 100;

    return (
        <div className="container mx-auto py-8 px-4 max-w-2xl min-h-screen flex flex-col justify-center">
            <div className="mb-4">
                <Button variant="ghost" onClick={() => router.push(`/module/${id}`)} className="text-blue-600 hover:bg-blue-50 hover:underline p-2 h-auto -ml-2 mb-2 w-fit">
                    &larr; Voltar para o Módulo
                </Button>
            </div>
            
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-sm rounded text-gray-500 font-medium block">
                        Questão {questionsAnswered + 1} de {allQuestions.length}
                    </label>
                    <Badge variant="outline" className={`
                        ${currentDifficulty === "easy" ? "bg-green-100 text-green-700 border-green-200" : ""}
                        ${currentDifficulty === "medium" ? "bg-yellow-100 text-yellow-700 border-yellow-200" : ""}
                        ${currentDifficulty === "hard" ? "bg-red-100 text-red-700 border-red-200" : ""}
                    `}>
                        {currentDifficulty.toUpperCase()}
                    </Badge>
                </div>
                <Progress value={progressPerc} className="h-2" />
            </div>

            <Card className={`shadow-lg animate-in fade-in-0 duration-500 ${showingFeedback ? "ring-2 ring-red-500" : "border-t"}`}>
                <CardHeader className="bg-gray-50 border-b">
                    <CardTitle className="text-xl font-medium leading-relaxed">
                        {currentQuestion.prompt}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-3">
                        {currentQuestion.options.map((opt, idx) => (
                            <Button
                                key={idx}
                                disabled={showingFeedback}
                                variant={selectedOption === idx ? "default" : "outline"}
                                className={`
                                    justify-start h-auto py-4 px-6 text-left whitespace-normal font-normal text-md
                                    ${selectedOption === idx ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                                    ${showingFeedback && idx === currentQuestion.correct_option_index ? 'bg-green-100 border-green-500 text-green-800' : ''}
                                    ${showingFeedback && selectedOption === idx && idx !== currentQuestion.correct_option_index ? 'bg-red-100 border-red-500 text-red-800' : ''}
                                `}
                                onClick={() => setSelectedOption(idx)}
                            >
                                {opt}
                            </Button>
                        ))}
                    </div>

                    {showingFeedback && aiFeedback && (
                        <div className="mt-8 p-6 bg-blue-50/50 border border-blue-100 rounded-xl">
                            <h3 className="text-blue-800 font-bold mb-3 flex items-center gap-2">
                                <span className="text-xl">💡</span> Tutor IA Pedagógico
                            </h3>
                            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                                {aiFeedback.explanationAi}
                            </p>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="bg-gray-50 border-t flex justify-end p-6">
                    {!showingFeedback ? (
                        <Button
                            size="lg"
                            disabled={selectedOption === null || fetchingAi}
                            onClick={handleAnswer}
                            className="w-full sm:w-auto px-10 text-lg"
                        >
                            {fetchingAi ? "Processando..." : "Responder"}
                        </Button>
                    ) : (
                        <Button
                            size="lg"
                            onClick={handleProceedAfterFeedback}
                            className="w-full sm:w-auto px-10 text-lg bg-gray-900 hover:bg-gray-800 text-white"
                        >
                            Próxima Questão
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}

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
}

interface AttemptResult {
    questionId: string;
    prompt: string;
    chosenIndex: number;
    correctIndex: number;
    isCorrect: boolean;
    explanationAi: string | null;
    baseExplanation: string;
    options: string[];
}

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // Results
    const [results, setResults] = useState<AttemptResult[]>([]);
    const [finished, setFinished] = useState(false);
    const [fetchingAi, setFetchingAi] = useState(false);

    useEffect(() => {
        supabase
            .from("questions")
            .select("*")
            .eq("module_id", id)
            .then(({ data }) => {
                if (data) setQuestions(data);
                setLoading(false);
            });
    }, [id]);

    const handleNext = async () => {
        if (selectedOption === null) return;

        const currentQ = questions[currentIndex];
        const isCorrect = selectedOption === currentQ.correct_option_index;

        let aiExplanation = null;
        const baseExplanation = currentQ.explanation_base;

        // Call AI only when incorrect
        if (!isCorrect) {
            setFetchingAi(true);
            try {
                const aiReq = await fetch("/api/explain", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt: currentQ.prompt,
                        base_explanation: currentQ.explanation_base,
                        student_answer: currentQ.options[selectedOption],
                        correct_answer: currentQ.options[currentQ.correct_option_index],
                    }),
                });

                const aiData = await aiReq.json();

                if (aiData.fallback) {
                    aiExplanation = `Erro ao contatar IA. Explicação Base: ${baseExplanation}`;
                } else {
                    aiExplanation = aiData.explanation;
                }

            } catch (err) {
                aiExplanation = `Erro de rede. Explicação Base: ${baseExplanation}`;
            }
            setFetchingAi(false);
        }

        const newResult = {
            questionId: currentQ.id,
            prompt: currentQ.prompt,
            chosenIndex: selectedOption,
            correctIndex: currentQ.correct_option_index,
            isCorrect,
            explanationAi: aiExplanation,
            baseExplanation,
            options: currentQ.options,
        };

        setResults([...results, newResult]);

        if (currentIndex < questions.length - 1) {
            setSelectedOption(null);
            setCurrentIndex(currentIndex + 1);
        } else {
            setFinished(true);
            // Optional: Save results to Supabase 'attempts' table here.
        }
    };

    if (loading) return <div className="p-8 text-center">Carregando quiz...</div>;

    if (questions.length === 0) return (
        <div className="p-8 text-center">
            Nenhuma questão encontrada para este módulo.
            <br />
            <Button className="mt-4" onClick={() => router.push("/")}>Voltar</Button>
        </div>
    );

    if (finished) {
        const score = results.filter((r) => r.isCorrect).length;
        const progressPerc = Math.round((score / questions.length) * 100);

        return (
            <div className="container mx-auto py-8 max-w-3xl">
                <Card className="border-t-4 border-t-blue-600">
                    <CardHeader>
                        <CardTitle className="text-3xl text-center">Resultados do Quiz</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center mb-8">
                            <span className="text-5xl font-bold text-gray-900">{progressPerc}%</span>
                            <p className="text-xl text-gray-600">Pontuação Total ({score}/{questions.length})</p>
                        </div>

                        <Accordion type="single" collapsible className="w-full">
                            {results.map((r, i) => (
                                <AccordionItem value={`item-${i}`} key={i}>
                                    <AccordionTrigger className="text-left">
                                        <div className="flex items-center gap-4">
                                            {r.isCorrect ? (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Correto</Badge>
                                            ) : (
                                                <Badge variant="destructive">Incorreto</Badge>
                                            )}
                                            <span className="font-semibold text-gray-700">Questão {i + 1}</span>
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
                                                <div className="whitespace-pre-wrap text-sm leading-relaxed">
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

    const currentQ = questions[currentIndex];
    const progressPerc = ((currentIndex) / questions.length) * 100;

    return (
        <div className="container mx-auto py-8 px-4 max-w-2xl min-h-screen flex flex-col justify-center">
            <div className="mb-4">
                <Button variant="ghost" onClick={() => router.push(`/module/${id}`)} className="text-blue-600 hover:bg-blue-50 hover:underline p-2 h-auto -ml-2 mb-2 w-fit">
                    &larr; Voltar para o Módulo
                </Button>
            </div>
            <div className="mb-6">
                <label className="text-sm rounded text-gray-500 font-medium mb-2 block text-right">
                    Progresso: {currentIndex + 1} de {questions.length}
                </label>
                <Progress value={progressPerc} className="h-2" />
            </div>

            <Card className="shadow-lg animate-in fade-in-0 duration-500">
                <CardHeader className="bg-gray-50 border-b">
                    <CardTitle className="text-xl font-medium leading-relaxed">
                        {currentQ.prompt}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-3">
                        {currentQ.options.map((opt, idx) => (
                            <Button
                                key={idx}
                                variant={selectedOption === idx ? "default" : "outline"}
                                className={`justify-start h-auto py-4 px-6 text-left whitespace-normal font-normal text-md ${selectedOption === idx ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                                onClick={() => setSelectedOption(idx)}
                            >
                                {opt}
                            </Button>
                        ))}
                    </div>
                </CardContent>
                <CardFooter className="bg-gray-50 border-t flex justify-end p-6">
                    <Button
                        size="lg"
                        disabled={selectedOption === null || fetchingAi}
                        onClick={handleNext}
                        className="w-full sm:w-auto px-10 text-lg"
                    >
                        {fetchingAi ? "Processando..." : (currentIndex === questions.length - 1 ? "Ver Resultados" : "Próxima")}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

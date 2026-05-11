import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { AttemptResult } from "./_types";

interface QuizResultsCardProps {
    results: AttemptResult[];
    onFinish: () => void;
}

export function QuizResultsCard({ results, onFinish }: QuizResultsCardProps) {
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
                                            <strong className="block mb-2 font-sans">IA Pedagógica:</strong>
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
                    <Button size="lg" onClick={onFinish}>Finalizar e Voltar</Button>
                </CardFooter>
            </Card>
        </div>
    );
}

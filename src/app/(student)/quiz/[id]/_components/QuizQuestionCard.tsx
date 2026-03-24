import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Question } from "./_types";

interface AiFeedback {
    explanationAi: string | null;
    imageUrlAi: string | null;
    baseStr: string;
}

interface QuizQuestionCardProps {
    currentQuestion: Question;
    selectedOption: number | null;
    showingFeedback: boolean;
    fetchingAi: boolean;
    aiFeedback: AiFeedback | null;
    onSelectOption: (idx: number) => void;
    onAnswer: () => void;
    onProceed: () => void;
}

export function QuizQuestionCard({
    currentQuestion,
    selectedOption,
    showingFeedback,
    fetchingAi,
    aiFeedback,
    onSelectOption,
    onAnswer,
    onProceed,
}: QuizQuestionCardProps) {
    return (
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
                                ${showingFeedback && idx === currentQuestion.correctOptionIndex ? 'bg-green-100 border-green-500 text-green-800' : ''}
                                ${showingFeedback && selectedOption === idx && idx !== currentQuestion.correctOptionIndex ? 'bg-red-100 border-red-500 text-red-800' : ''}
                            `}
                            onClick={() => onSelectOption(idx)}
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
                        onClick={onAnswer}
                        className="w-full sm:w-auto px-10 text-lg"
                    >
                        {fetchingAi ? "Processando..." : "Responder"}
                    </Button>
                ) : (
                    <Button
                        size="lg"
                        onClick={onProceed}
                        className="w-full sm:w-auto px-10 text-lg bg-gray-900 hover:bg-gray-800 text-white"
                    >
                        Próxima Questão
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}

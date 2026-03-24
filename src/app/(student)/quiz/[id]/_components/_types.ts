export interface Question {
    id: string;
    prompt: string;
    options: string[];
    correctOptionIndex: number;
    explanationBase: string;
    difficulty: "easy" | "medium" | "hard";
    base_text: string;
}

export interface AttemptResult {
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

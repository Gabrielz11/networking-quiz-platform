export interface ShuffledQuestion {
    options: string[];
    correct_option_index: number;
}

/**
 * Embaralha as opções de uma questão de quiz de forma segura,
 * atualizando o índice da resposta correta correspondente.
 */
export function shuffleQuestionOptions(
    options: string[],
    correctOptionIndex: number
): ShuffledQuestion {
    const optionsAsObjects = options.map((text, index) => ({
        text,
        isCorrect: index === correctOptionIndex
    }));

    for (let i = optionsAsObjects.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [optionsAsObjects[i], optionsAsObjects[j]] = [optionsAsObjects[j], optionsAsObjects[i]];
    }

    const newCorrectIndex = optionsAsObjects.findIndex(opt => opt.isCorrect);
    const shuffledTexts = optionsAsObjects.map(opt => opt.text);

    return {
        options: shuffledTexts,
        correct_option_index: newCorrectIndex,
    };
}

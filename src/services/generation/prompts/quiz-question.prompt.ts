export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";

export function buildQuizPrompt(
    difficulty: QuestionDifficulty,
    moduleContent: string,
    previousPrompts: string[]
): string {
    const avoidSection = previousPrompts.length > 0
        ? `\n A nova questão deve abordar um conceito, cenário ou aplicação diferente. 
        Evite criar uma questão apenas reformulando perguntas anteriores.
        As alternativas incorretas devem ser tecnicamente plausíveis, não absurdas.
        NÃO repita os seguintes temas já abordados nesta sessão:\n- ${previousPrompts.join("\n- ")}\n`
        : "";

    return `Gere EXATAMENTE UMA questão de múltipla escolha sobre o conteúdo abaixo.

Nível: ${difficulty}
- EASY: cobra apenas uma definição, identificação, número, nome ou função direta de um único conceito.
- MEDIUM: exige relacionar dois ou mais conceitos, compreender causa e efeito ou reconhecer etapas de um processo técnico.
- HARD: exige analisar um cenário técnico, diagnosticar um problema ou escolher uma solução com base em várias condições.
${avoidSection}
Retorne SOMENTE um JSON válido nesta estrutura (sem texto extra, sem markdown):
{
  "prompt": "Enunciado claro e objetivo",
  "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
  "correct_option_index": 0,
  "explanation": "Explicação técnica de 2 a 4 frases sobre por que a resposta está correta."
}

Conteúdo do módulo:
${moduleContent.trim()}`;
}

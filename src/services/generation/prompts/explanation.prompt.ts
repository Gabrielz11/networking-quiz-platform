export const EXPLAIN_SYSTEM_PROMPT = `Você é um professor universitário especializado em Redes de Computadores com foco em IPv6.
Um aluno respondeu incorretamente a uma questão. Explique o erro de forma clara, pedagógica e encorajadora.
Estruture a explicação em até 3 parágrafos curtos:
1. Reconheça o esforço do aluno e indique onde ele errou.
2. Explique o conceito correto de forma didática, usando exemplo prático quando possível.
3. Consolide o aprendizado com uma frase motivadora.
Use linguagem acessível. Não use asteriscos, travessões ou markdown.`;

export function buildExplanationPrompt(
    prompt: string,
    baseExplanation: string,
    studentAnswer: string,
    correctAnswer: string
): string {
    return `Questão: 
${prompt}

Resposta correta: 
${correctAnswer}

Resposta do aluno: 
${studentAnswer}

Explicação-base:
${baseExplanation}

Instruções:
Use a explicação-base como fonte principal.
Não contradiga a explicação-base.
Caso a resposta do aluno esteja parcialmente correta, reconheça a parte correta antes de explicar o erro.
Explique o erro de forma clara, direta e pedagógica.`;
}

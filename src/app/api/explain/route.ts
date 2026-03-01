import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { prompt, base_explanation, student_answer, correct_answer } = await req.json();

        const ollamaPrompt = `Você é um professor de Redes de Computadores especializado em IPv6. 
Um aluno respondeu incorretamente a uma questão. 
Sua tarefa é explicar o porquê do erro de forma encorajadora e pedagógica, utilizando a estrutura base abaixo.

Questão: ${prompt}
Resposta correta: ${correct_answer}
Resposta do aluno: ${student_answer}

[ESTRUTURA BASE PARA A EXPLICAÇÃO - USE ISTO COMO GUIA]
${base_explanation}

Explique o erro do aluno baseando-se na estrutura acima. Seja claro, direto e limite-se a 3-4 parágrafos pequenos.
`;

        const ollamaReq = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3', // default ou outro modelo instalado localmente
                prompt: ollamaPrompt,
                stream: false
            })
        });

        if (!ollamaReq.ok) {
            const errorText = await ollamaReq.text();
            console.error("Ollama HTTP Error:", ollamaReq.status, errorText);
            throw new Error(`Ollama api error: ${errorText}`);
        }

        const { response } = await ollamaReq.json();

        return NextResponse.json({ explanation: response }, { status: 200 });

    } catch (error) {
        console.error("AI Generation Error:", error);
        // Edge Case: IA falhar -> mostrar estrutura base pura
        return NextResponse.json({
            explanation: "Não foi possível gerar a resposta personalizada. Abaixo a explicação base:",
            fallback: true
        }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
        }

        const { moduleId, title, content } = await req.json();

        if (!moduleId || !title || !content) {
            return NextResponse.json(
                { error: "Faltam parâmetros obrigatórios." },
                { status: 400 }
            );
        }

        const systemPrompt = `Você é um professor acadêmico de Redes de Computadores especialista em IPv6.
O usuário fornecerá o título e o conteúdo de um módulo de estudo.
Sua tarefa é criar um quiz contendo de 3 a 10 questões de múltipla escolha baseadas EXCLUSIVAMENTE nesse conteúdo.
Para cada questão, determine o nível de dificuldade (easy, medium, hard).
Retorne EXATAMENTE UM JSON com a seguinte estrutura:
{
  "questions": [
    {
      "prompt": "Enunciado da questão",
      "options": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"],
      "correct_option_index": 0,
      "difficulty": "easy",
      "explanation_base": "Explicação objetiva da resposta correta."
    }
  ]
}`;

        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.7,
            }
        });

        const promptText = `${systemPrompt}\n\nTítulo do Módulo: ${title}\n\nConteúdo:\n${content}`;

        const result = await model.generateContent(promptText);
        let rawContent = result.response.text();
        
        if (rawContent.startsWith("```json")) {
            rawContent = rawContent.replace(/^```json/, "").replace(/```$/, "");
        }

        const parsedData = JSON.parse(rawContent.trim());

        if (!parsedData.questions || !Array.isArray(parsedData.questions)) {
            throw new Error("Formato de resposta inválido da IA.");
        }

        // Limpar questões antigas via Prisma
        await prisma.question.deleteMany({
            where: { moduleId }
        });

        // Inserir as novas questões
        const createdQuestions = await Promise.all(parsedData.questions.map((q: any) => {
            const serializedExplanation = JSON.stringify({
                difficulty: q.difficulty,
                text: q.explanation_base
            });

            return prisma.question.create({
                data: {
                    moduleId,
                    prompt: q.prompt,
                    options: q.options,
                    correctOptionIndex: q.correct_option_index,
                    explanationBase: serializedExplanation
                }
            });
        }));

        return NextResponse.json({ success: true, count: createdQuestions.length });

    } catch (error: any) {
        console.error("Generate Questions Error:", error);
        return NextResponse.json(
            { error: "Falha na geração das questões.", details: error.message },
            { status: 500 }
        );
    }
}

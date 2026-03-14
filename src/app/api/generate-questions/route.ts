import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

// Inicializa o Google Generative AI (Gemini Flash)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    try {
        const { moduleId, title, content } = await req.json();

        if (!moduleId || !title || !content) {
            return NextResponse.json(
                { error: "Faltam parâmetros obrigatórios (moduleId, title, content)." },
                { status: 400 }
            );
        }

        // Recupera o token de autenticação enviado pelo Frontend
        const authHeader = req.headers.get("authorization");
        if (!authHeader) {
            return NextResponse.json({ error: "Não autorizado (Token JWT ausente)." }, { status: 401 });
        }

        // Cria o cliente Supabase associado explicitamente ao usuário autenticado atual
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        const supabaseAuthClient = createClient(supabaseUrl, supabaseKey, {
            global: {
                headers: {
                    Authorization: authHeader
                }
            }
        });

        const systemPrompt = `Você é um professor acadêmico de Redes de Computadores especialista em IPv6.
O usuário fornecerá o título e o conteúdo de um módulo de estudo.
Sua tarefa é criar um quiz contendo de 3 a 10 questões de múltipla escolha baseadas EXCLUSIVAMENTE nesse conteúdo.
Para cada questão, determine o nível de dificuldade (easy, medium, hard).
Crie opções de resposta desafiadoras e bem formuladas.
Forneça a explicação base objetiva que será usada posteriormente se o aluno errar.

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

        // Obtendo o modelo Gemini
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
        
        // Garante a extração limpa do JSON (mesmo sem o marcador markdown se a IA colocar)
        if (rawContent.startsWith("```json")) {
            rawContent = rawContent.replace(/^```json/, "").replace(/```$/, "");
        }

        const parsedData = JSON.parse(rawContent.trim());

        if (!parsedData.questions || !Array.isArray(parsedData.questions)) {
            throw new Error("Formato de resposta inválido da IA.");
        }

        // Deletar questões antigas do módulo (já que a IA recria) sob a permissão do usuário
        await supabaseAuthClient.from("questions").delete().eq("module_id", moduleId);

        // Inserir as novas questões
        const questionsToInsert = parsedData.questions.map((q: any) => {
            const serializedExplanation = JSON.stringify({
                difficulty: q.difficulty,
                text: q.explanation_base
            });

            return {
                module_id: moduleId,
                prompt: q.prompt,
                options: q.options,
                correct_option_index: q.correct_option_index,
                explanation_base: serializedExplanation
            };
        });

        const { error: insertError } = await supabaseAuthClient.from("questions").insert(questionsToInsert);

        if (insertError) {
            throw new Error("Erro ao salvar questões: " + insertError.message);
        }

        return NextResponse.json({ success: true, count: questionsToInsert.length });

    } catch (error: any) {
        console.error("Generate Questions Error:", error);
        return NextResponse.json(
            { error: "Falha na geração das questões.", details: error.message },
            { status: 500 }
        );
    }
}

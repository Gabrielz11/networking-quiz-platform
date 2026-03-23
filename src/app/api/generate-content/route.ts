import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    try {
        const { title, description } = await req.json();

        if (!title) {
            return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
        Você é um especialista em educação tecnológica. 
        Crie o conteúdo de um módulo de estudo para uma plataforma LMS sobre o tema: "${title}".
        A descrição base é: "${description}".

        REGRAS DE FORMATAÇÃO (MUITO IMPORTANTE):
        1. O conteúdo deve ser em Markdown estruturado, mas visando uma renderização HTML acadêmica.
        2. Use subtítulos (##) para organizar os tópicos.
        3. Use parágrafos claros e explicativos.
        4. Use listas (bullets) para destacar pontos importantes.
        5. Use negrito para termos técnicos.
        6. O tom deve ser profissional, didático e encorajador.
        7. NÃO use HTML puro, use Markdown padrão que será convertido pelo frontend.
        8. NÃO inclua o título principal (h1) no corpo, foque nos tópicos.
        9. Se o tema for técnico, inclua exemplos práticos.

        Também sugira uma descrição curta (máximo 150 caracteres) se a descrição atual for vazia.

        Retorne no formato JSON:
        {
            "content": "Conteúdo em markdown aqui...",
            "description": "Breve resumo...",
            "imageUrl": "URL de uma foto técnica relevante (use o formato https://images.unsplash.com/photo-[ID]?q=80&w=1600&auto=format&fit=crop para fotos de tecnologia/servidores/globos digitais)"
        }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Limpeza simples para garantir que o JSON seja válido (removendo markdown code blocks se houver)
        const cleanJson = text.replace(/```json|```/g, "").trim();
        const parsedData = JSON.parse(cleanJson);

        return NextResponse.json(parsedData);
    } catch (error: any) {
        console.error("Erro na geração de conteúdo:", error);
        return NextResponse.json({ error: "Falha ao gerar conteúdo via IA" }, { status: 500 });
    }
}

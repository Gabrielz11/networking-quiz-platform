import { LlmRouter } from "../src/services/ai/llm-router";
import { env } from "../src/lib/env";

async function runTest() {
    console.log("Iniciando teste de fallback com diagnóstico de parse de JSON...");
    console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "CONFIGURADA" : "AUSENTE");
    console.log("GROQ_API_KEY:", process.env.GROQ_API_KEY ? "CONFIGURADA" : "AUSENTE");

    const prompt = `Gere uma pergunta de redes de computadores sobre o protocolo BGP e a diferença entre iBGP e eBGP. Retorne no formato JSON exigido pelo schema. Timestamp único: ${Date.now()}`;
    
    try {
        const result = await LlmRouter.generateJson(prompt, {
            modelName: env.QUESTION_GENERATION_MODEL,
            temperature: 0.6,
            pipeline: "QUIZ_GEN",
            fallbackEnabled: true,
            responseSchema: {
                type: "object",
                properties: {
                    prompt: { type: "string" },
                    options: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 4,
                        maxItems: 4
                    },
                    correct_option_index: { type: "number" },
                    explanation: { type: "string" }
                },
                required: ["prompt", "options", "correct_option_index", "explanation"]
            }
        });
        console.log("\nResultado obtido com SUCESSO:");
        console.log(JSON.stringify(result, null, 2));
    } catch (err: any) {
        console.error("\nERRO DETECTADO NO FLUXO:");
        console.error("Mensagem:", err.message);
    }
}

runTest();

import { GroqProvider } from "../src/services/ai/providers/groq.provider";
import { env } from "../src/lib/env";

async function testStream() {
    console.log("--- TESTANDO GERAÇÃO DE EXPLICAÇÃO EM STREAMING (INVESTIGAÇÃO) ---");
    const provider = new GroqProvider();
    try {
        const stream = await provider.generateTextStream(
            "Explique brevemente por que o IPv6 foi criado.",
            {
                modelName: "llama-3.1-8b-instant",
                temperature: 0.7,
                maxTokens: 100
            }
        );

        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let result = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            result += decoder.decode(value);
        }

        console.log("\nExplicação gerada:");
        console.log(result);
        console.log("\nTeste finalizado.");
    } catch (err) {
        console.error("Erro no teste de stream:", err);
    }
}

testStream();

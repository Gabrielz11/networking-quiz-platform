import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { cleanMarkdownCodeFences, safeJsonParse } from "@/lib/utils";
import { Logger } from "@/lib/logger";

const logger = new Logger("AiService");

const DEFAULT_TIMEOUT_MS = 45_000;  // 45s — suficiente para respostas JSON curtas
const CONTENT_TIMEOUT_MS = 90_000; // 90s — para geração de conteúdo longo (gemini-2.5-flash é um modelo de raciocínio)

export { CONTENT_TIMEOUT_MS };

// ========== Interfaces ==========

export interface AiGenerateJsonOptions {
    temperature?: number;
    timeoutMs?: number;
    modelName?: string;
}

export interface AiGenerateTextOptions {
    systemInstruction?: string;
    temperature?: number;
    timeoutMs?: number;
}

// ========== AiService — Orquestrador ==========

export class AiService {
    private static geminiClient: GoogleGenerativeAI | null = null;

    /**
     * Inicialização lazy do client Gemini.
     * Só cria a instância quando o primeiro request chegar.
     */
    private static getGeminiClient(): GoogleGenerativeAI {
        if (!this.geminiClient) {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("GEMINI_API_KEY não configurada.");
            }
            this.geminiClient = new GoogleGenerativeAI(apiKey);
        }
        return this.geminiClient;
    }

    /**
     * Aplica timeout a uma Promise. Rejeita se exceder o limite.
     */
    private static withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout: a requisição excedeu ${ms}ms.`));
            }, ms);

            promise
                .then((result) => { clearTimeout(timer); resolve(result); })
                .catch((err) => { clearTimeout(timer); reject(err); });
        });
    }

    /**
     * Fallback para Groq (Llama 3.3) quando o Gemini falha.
     */
    private static async callGroqFallback(promptText: string, timeoutMs: number): Promise<string> {
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) {
            throw new Error("GROQ_API_KEY não configurada e Gemini falhou.");
        }

        logger.info("callGroqFallback", "Iniciando fallback para Groq", { provider: "groq" });

        const groqPromise = fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: "Você é um especialista em educação tecnológica e criação de materiais didáticos. Responda EXCLUSIVAMENTE com um objeto JSON válido, sem qualquer texto antes ou depois. O conteúdo gerado deve ser completo, detalhado, bem estruturado e rico em informações relevantes."
                    },
                    { role: "user", content: promptText }
                ],
                response_format: { type: "json_object" },
                temperature: 0.6,
                max_tokens: 8192,
            })
        });

        const groqRes = await this.withTimeout(groqPromise, timeoutMs);

        if (!groqRes.ok) {
            const errText = await groqRes.text();
            throw new Error(`Groq API fallback failed: ${errText}`);
        }

        const groqData = await groqRes.json();
        return groqData.choices[0].message.content;
    }

    // ========== Métodos Públicos ==========

    /**
     * Gera conteúdo JSON via Gemini com fallback Groq, timeout e parse seguro.
     * Este é o método principal que os services de domínio devem usar.
     */
    static async generateJson<T = unknown>(
        promptText: string,
        options: AiGenerateJsonOptions = {}
    ): Promise<T> {
        const { temperature = 0.7, timeoutMs = DEFAULT_TIMEOUT_MS, modelName } = options;
        const start = Date.now();

        let rawContent = "";

        try {
            const client = this.getGeminiClient();
            const model = client.getGenerativeModel({
                model: modelName || process.env.GEMINI_MODEL || "gemini-2.5-flash",
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature,
                }
            });

            logger.info("generateJson", "Chamando Gemini", { provider: "gemini", temperature });
            const result = await this.withTimeout(model.generateContent(promptText), timeoutMs);
            rawContent = result.response.text();
            logger.info("generateJson", "Gemini respondeu com sucesso", { provider: "gemini", durationMs: Date.now() - start });
        } catch (geminiError: any) {
            logger.warn("generateJson", `Gemini falhou: ${geminiError.message}`, { provider: "gemini", durationMs: Date.now() - start });
            rawContent = await this.callGroqFallback(promptText, timeoutMs);
            logger.info("generateJson", "Groq respondeu com sucesso", { provider: "groq", durationMs: Date.now() - start });
        }

        const cleaned = cleanMarkdownCodeFences(rawContent);
        const { success, data, error } = safeJsonParse<T>(cleaned);

        if (!success || !data) {
            logger.error("generateJson", `JSON inválido da IA: ${error?.message}`, { rawPreview: cleaned.substring(0, 200) });
            throw new Error(`Resposta da IA não é JSON válido: ${error?.message}`);
        }

        return data;
    }

    /**
     * Gera conteúdo em texto puro via Gemini com fallback Groq e timeout.
     * Usado para respostas que não são JSON (ex: explicações pedagógicas).
     */
    static async generateText(
        promptText: string,
        options: AiGenerateTextOptions = {}
    ): Promise<string> {
        const { systemInstruction, temperature = 0.7, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
        const start = Date.now();

        try {
            const client = this.getGeminiClient();
            const model = client.getGenerativeModel({
                model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
                ...(systemInstruction && { systemInstruction }),
                generationConfig: { temperature }
            });

            logger.info("generateText", "Chamando Gemini", { provider: "gemini" });
            const result = await this.withTimeout(model.generateContent(promptText), timeoutMs);
            logger.info("generateText", "Gemini respondeu", { provider: "gemini", durationMs: Date.now() - start });
            return result.response.text() || "Não foi possível gerar a resposta.";
        } catch (geminiError: any) {
            logger.warn("generateText", `Gemini falhou: ${geminiError.message}`, { provider: "gemini", durationMs: Date.now() - start });

            const groqKey = process.env.GROQ_API_KEY;
            if (!groqKey) throw geminiError;

            const groqPromise = fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${groqKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
                        { role: "user", content: promptText }
                    ],
                    temperature
                })
            });

            const groqRes = await this.withTimeout(groqPromise, timeoutMs);
            if (!groqRes.ok) {
                const errText = await groqRes.text();
                throw new Error(`Groq fallback failed: ${errText}`);
            }

            const groqData = await groqRes.json();
            logger.info("generateText", "Groq respondeu", { provider: "groq", durationMs: Date.now() - start });
            return groqData.choices[0].message.content || "Não foi possível gerar a resposta.";
        }
    }
}

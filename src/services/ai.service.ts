import { GoogleGenAI } from "@google/genai";
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
    responseSchema?: any; // Adicionado suporte para schema tipado
}

export interface AiGenerateTextOptions {
    systemInstruction?: string;
    temperature?: number;
    timeoutMs?: number;
}

// ========== AiService — Orquestrador ==========

export class AiService {
    private static geminiClient: GoogleGenAI | null = null;

    /**
     * Inicialização lazy do client Gemini.
     * Só cria a instância quando o primeiro request chegar.
     */
    private static getGeminiClient(): GoogleGenAI {
        if (!this.geminiClient) {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("GEMINI_API_KEY não configurada.");
            }
            this.geminiClient = new GoogleGenAI({ apiKey });
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

        const systemPrompt = `Você é um Especialista Sênior em Engenharia de Redes (IPv6) e Designer Instrucional de elite além de professor doutor na área de redes e segurança cibernética.
        Sua missão é criar materiais educacionais de altíssimo nível, comparáveis aos melhores cursos técnicos do mundo.

        DIRETRIZES RÍGIDAS DE CONTEÚDO:
        1. PROFUNDIDADE MÁXIMA: Nunca resuma. Explique o "porquê" e o "como" de cada detalhe técnico. Se o tema for IPv6, aborde bits, cabeçalhos, escopo e protocolos relacionados (ICMPv6, NDP, etc) logicamente relacionados com o pedido.
        2. DENSIDADE DE INFORMAÇÃO: Cada parágrafo deve ser rico em dados. Evite frases genéricas como "é muito importante". Diga POR QUE é importante tecnicamente.
        3. EXEMPLOS PRÁTICOS: Inclua sempre cenários reais, comandos de configuração ou estruturas de endereçamento detalhadas.
        4. ESTRUTURA PEDAGÓGICA: Use uma linguagem que desafie o aluno, sendo didática mas extremamente técnica.
        5. FORMATO: Responda EXCLUSIVAMENTE com um objeto JSON válido, sem qualquer texto antes ou depois.

        NUNCA retorne respostas curtas, rasas ou simplificadas. O usuário espera um conteúdo denso que sirva para estudo profundo.`;

        const groqPromise = fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
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

            logger.info("generateJson", "Chamando Gemini", { provider: "gemini", temperature });

            const result = await this.withTimeout(
                client.models.generateContent({
                    model: modelName || process.env.GEMINI_MODEL || "gemini-2.5-flash",
                    contents: [{ role: "user", parts: [{ text: promptText }] }],
                    config: {
                        responseMimeType: "application/json",
                        temperature,
                        maxOutputTokens: 8192,
                        responseSchema: options.responseSchema
                    }
                }),
                timeoutMs
            );

            rawContent = result.text || "";
            logger.info("generateJson", "Gemini respondeu com sucesso", { provider: "gemini", durationMs: Date.now() - start });
        } catch (geminiError: any) {
            logger.warn("generateJson", `Gemini falhou: ${geminiError.message}`, { provider: "gemini", durationMs: Date.now() - start });
            rawContent = await this.callGroqFallback(promptText, timeoutMs);
            logger.info("generateJson", "Groq respondeu com sucesso", { provider: "groq", durationMs: Date.now() - start });
        }

        const cleaned = cleanMarkdownCodeFences(rawContent);
        const { success, data, error } = safeJsonParse<T>(cleaned);

        if (!success || !data) {
            const previewStart = cleaned.substring(0, 300);
            const previewEnd = cleaned.length > 300 ? cleaned.substring(cleaned.length - 300) : "";

            logger.error("generateJson", `JSON inválido da IA: ${error?.message}`, {
                totalLength: cleaned.length,
                previewStart,
                previewEnd,
                errorPosition: (error?.message?.match(/at position (\d+)/) || [])[1]
            });

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

            logger.info("generateText", "Chamando Gemini", { provider: "gemini" });

            const result = await this.withTimeout(
                client.models.generateContent({
                    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
                    contents: [{ role: "user", parts: [{ text: promptText }] }],
                    config: {
                        systemInstruction,
                        temperature
                    }
                }),
                timeoutMs
            );

            logger.info("generateText", "Gemini respondeu", { provider: "gemini", durationMs: Date.now() - start });
            return result.text || "Não foi possível gerar a resposta.";
        } catch (geminiError: any) {
            logger.warn("generateText", `Gemini falhou: ${geminiError.message}`, { provider: "gemini", durationMs: Date.now() - start });

            const groqKey = process.env.GROQ_API_KEY;
            if (!groqKey) throw geminiError;

            const textSystemPrompt = systemInstruction
                ? `${systemInstruction}\n\nIMPORTANTE: Gere um conteúdo profundo, detalhado e tecnicamente denso. Evite respostas superficiais ou curtas.`
                : "Você é um especialista em educação tecnológica. Gere uma resposta detalhada, profunda e didaticamente rica.";

            const groqPromise = fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${groqKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: textSystemPrompt },
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

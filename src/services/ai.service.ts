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
    fallbackModelName?: string; // Nome do modelo para o fallback (ex: para módulos longos)
    responseSchema?: any; // Adicionado suporte para schema tipado
    systemInstruction?: string;

    // Metadados para persistência e RAG
    pipeline?: string;
    moduleId?: string;
    sessionId?: string;
    criticScore?: number;
    criticMetrics?: any;
    retrievedChunks?: any;
}

export interface AiGenerateTextOptions {
    systemInstruction?: string;
    temperature?: number;
    timeoutMs?: number;
    modelName?: string;

    // Metadados para persistência e RAG
    pipeline?: string;
    moduleId?: string;
    sessionId?: string;
    criticScore?: number;
    criticMetrics?: any;
    retrievedChunks?: any;
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
     * Auxiliar para estimar o custo financeiro da chamada (USD por milhão de tokens)
     */
    private static estimateCost(modelName: string, promptTokens: number, completionTokens: number): number {
        const name = modelName.toLowerCase();
        let promptRate = 0;
        let completionRate = 0;

        if (name.includes("gemini-2.5-pro")) {
            // gemini-2.5-pro: $1.25 / 1M input, $5.00 / 1M output
            promptRate = 1.25 / 1_000_000;
            completionRate = 5.00 / 1_000_000;
        } else if (name.includes("gemini-2.5-flash")) {
            // gemini-2.5-flash: $0.075 / 1M input, $0.30 / 1M output
            promptRate = 0.075 / 1_000_000;
            completionRate = 0.30 / 1_000_000;
        } else if (name.includes("deepseek-r1")) {
            // deepseek-r1: $0.55 / 1M input, $2.19 / 1M output
            promptRate = 0.55 / 1_000_000;
            completionRate = 2.19 / 1_000_000;
        } else if (name.includes("llama-3.3-70b-versatile") || name.includes("llama")) {
            // llama-3.3-70b-versatile: $0.59 / 1M input, $0.79 / 1M output
            promptRate = 0.59 / 1_000_000;
            completionRate = 0.79 / 1_000_000;
        } else {
            // Padrão (gemini-2.5-flash)
            promptRate = 0.075 / 1_000_000;
            completionRate = 0.30 / 1_000_000;
        }

        return (promptTokens * promptRate) + (completionTokens * completionRate);
    }

    /**
     * Persiste assincronamente os metadados de geração no banco de dados.
     */
    private static async saveMetadata(params: {
        pipeline: string;
        promptUsed: string;
        modelName: string;
        temperature: number;
        generationTimeMs: number;
        promptTokens?: number | null;
        completionTokens?: number | null;
        costUsd?: number | null;
        criticScore?: number;
        criticMetrics?: any;
        retrievedChunks?: any;
        moduleId?: string | null;
        sessionId?: string | null;
    }) {
        try {
            const { prisma } = await import("@/lib/prisma");
            await prisma.aiGenerationMetadata.create({
                data: {
                    pipeline: params.pipeline,
                    promptUsed: params.promptUsed,
                    modelName: params.modelName,
                    temperature: params.temperature,
                    generationTimeMs: params.generationTimeMs,
                    promptTokens: params.promptTokens,
                    completionTokens: params.completionTokens,
                    costUsd: params.costUsd,
                    criticScore: params.criticScore ?? 1.0,
                    criticMetrics: params.criticMetrics ?? {},
                    retrievedChunks: params.retrievedChunks ?? [],
                    moduleId: params.moduleId || null,
                    sessionId: params.sessionId || null,
                }
            });
            logger.info("saveMetadata", "Metadados de IA salvos com sucesso", { pipeline: params.pipeline });
        } catch (err: any) {
            logger.error("saveMetadata", "Erro ao salvar metadados de geração no Prisma", { error: err.message });
        }
    }

    private static mapGroqModel(model: string): string {
        const name = model.toLowerCase();
        if (name === "deepseek-r1" || name.includes("deepseek")) {
            // Groq descontinuou o DeepSeek R1 Distill em Out/2025. A recomendação oficial é migrar para o Llama 3.3 70B.
            return "llama-3.3-70b-versatile";
        }
        if (name === "llama3" || name.includes("llama")) {
            if (name.includes("llama-3.3") || name.includes("llama3.3")) {
                return model;
            }
            return "llama-3.3-70b-versatile";
        }
        return model;
    }

    /**
     * Fallback para Groq quando o Gemini falha.
     */
    private static async callGroqFallback(
        promptText: string,
        timeoutMs: number,
        fallbackModelName?: string
    ): Promise<{ content: string; promptTokens: number | null; completionTokens: number | null }> {
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) {
            throw new Error("GROQ_API_KEY não configurada e Gemini falhou.");
        }

        const rawModel = fallbackModelName || process.env.GROQ_FALLBACK_MODEL || "llama-3.3-70b-versatile";
        const modelUsed = this.mapGroqModel(rawModel);
        logger.info("callGroqFallback", "Iniciando fallback para Groq", { provider: "groq", model: modelUsed });

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
                model: modelUsed,
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
        const content = groqData.choices[0].message.content || "";
        const promptTokens = groqData.usage?.prompt_tokens ?? null;
        const completionTokens = groqData.usage?.completion_tokens ?? null;

        return { content, promptTokens, completionTokens };
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
        const modelSelected = modelName || process.env.GEMINI_MODEL || "gemini-2.5-flash";

        let rawContent = "";
        let promptTokens: number | null = null;
        let completionTokens: number | null = null;
        let costUsd: number | null = null;

        try {
            const client = this.getGeminiClient();

            logger.info("generateJson", "Chamando Gemini", { provider: "gemini", model: modelSelected, temperature });

            const result = await this.withTimeout(
                client.models.generateContent({
                    model: modelSelected,
                    contents: [{ role: "user", parts: [{ text: promptText }] }],
                    config: {
                        systemInstruction: options.systemInstruction,
                        responseMimeType: "application/json",
                        temperature,
                        maxOutputTokens: 8192,
                        responseSchema: options.responseSchema
                    }
                }),
                timeoutMs
            );

            rawContent = result.text || "";
            const durationMs = Date.now() - start;

            if (result.usageMetadata) {
                promptTokens = result.usageMetadata.promptTokenCount ?? null;
                completionTokens = result.usageMetadata.candidatesTokenCount ?? null;
                if (promptTokens !== null && completionTokens !== null) {
                    costUsd = this.estimateCost(modelSelected, promptTokens, completionTokens);
                }
            }

            if (options.pipeline) {
                this.saveMetadata({
                    pipeline: options.pipeline,
                    promptUsed: promptText,
                    modelName: modelSelected,
                    temperature,
                    generationTimeMs: durationMs,
                    promptTokens,
                    completionTokens,
                    costUsd,
                    criticScore: options.criticScore,
                    criticMetrics: options.criticMetrics,
                    retrievedChunks: options.retrievedChunks,
                    moduleId: options.moduleId,
                    sessionId: options.sessionId,
                });
            }

            logger.info("generateJson", "Gemini respondeu com sucesso", { provider: "gemini", durationMs });
        } catch (geminiError: any) {
            logger.warn("generateJson", `Gemini falhou: ${geminiError.message}`, { provider: "gemini", durationMs: Date.now() - start });
            
            const fallbackModel = options.fallbackModelName || process.env.GROQ_FALLBACK_MODEL || "llama-3.3-70b-versatile";

            const groqResult = await this.callGroqFallback(promptText, timeoutMs, options.fallbackModelName);
            rawContent = groqResult.content;
            
            const durationMs = Date.now() - start;
            promptTokens = groqResult.promptTokens;
            completionTokens = groqResult.completionTokens;
            
            if (promptTokens !== null && completionTokens !== null) {
                costUsd = this.estimateCost(fallbackModel, promptTokens, completionTokens);
            }

            if (options.pipeline) {
                this.saveMetadata({
                    pipeline: options.pipeline,
                    promptUsed: promptText,
                    modelName: fallbackModel,
                    temperature,
                    generationTimeMs: durationMs,
                    promptTokens,
                    completionTokens,
                    costUsd,
                    criticScore: options.criticScore,
                    criticMetrics: options.criticMetrics,
                    retrievedChunks: options.retrievedChunks,
                    moduleId: options.moduleId,
                    sessionId: options.sessionId,
                });
            }

            logger.info("generateJson", "Groq respondeu com sucesso", { provider: "groq", durationMs });
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
        const modelSelected = options.modelName || process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";

        try {
            const client = this.getGeminiClient();

            logger.info("generateText", "Chamando Gemini", { provider: "gemini", model: modelSelected });

            const result = await this.withTimeout(
                client.models.generateContent({
                    model: modelSelected,
                    contents: [{ role: "user", parts: [{ text: promptText }] }],
                    config: {
                        systemInstruction,
                        temperature
                    }
                }),
                timeoutMs
            );

            const durationMs = Date.now() - start;
            const content = result.text || "Não foi possível gerar a resposta.";

            let promptTokens: number | null = null;
            let completionTokens: number | null = null;
            let costUsd: number | null = null;

            if (result.usageMetadata) {
                promptTokens = result.usageMetadata.promptTokenCount ?? null;
                completionTokens = result.usageMetadata.candidatesTokenCount ?? null;
                if (promptTokens !== null && completionTokens !== null) {
                    costUsd = this.estimateCost(modelSelected, promptTokens, completionTokens);
                }
            }

            if (options.pipeline) {
                this.saveMetadata({
                    pipeline: options.pipeline,
                    promptUsed: promptText,
                    modelName: modelSelected,
                    temperature,
                    generationTimeMs: durationMs,
                    promptTokens,
                    completionTokens,
                    costUsd,
                    criticScore: options.criticScore,
                    criticMetrics: options.criticMetrics,
                    retrievedChunks: options.retrievedChunks,
                    moduleId: options.moduleId,
                    sessionId: options.sessionId,
                });
            }

            logger.info("generateText", "Gemini respondeu", { provider: "gemini", durationMs });
            return content;
        } catch (geminiError: any) {
            logger.warn("generateText", `Gemini falhou: ${geminiError.message}`, { provider: "gemini", durationMs: Date.now() - start });

            const groqKey = process.env.GROQ_API_KEY;
            if (!groqKey) throw geminiError;

            const textSystemPrompt = systemInstruction
                ? `${systemInstruction}\n\nIMPORTANTE: Gere um conteúdo profundo, detalhado e tecnicamente denso. Evite respostas superficiais ou curtas.`
                : "Você é um especialista em educação tecnológica. Gere uma resposta detalhada, profunda e didaticamente rica.";

            const rawModel = process.env.GROQ_FALLBACK_MODEL || "llama-3.3-70b-versatile";
            const fallbackModel = this.mapGroqModel(rawModel);

            const groqPromise = fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${groqKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: fallbackModel,
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
            const durationMs = Date.now() - start;

            const content = groqData.choices[0].message.content || "Não foi possível gerar a resposta.";
            const promptTokens = groqData.usage?.prompt_tokens ?? null;
            const completionTokens = groqData.usage?.completion_tokens ?? null;

            let costUsd: number | null = null;
            if (promptTokens !== null && completionTokens !== null) {
                costUsd = this.estimateCost(fallbackModel, promptTokens, completionTokens);
            }

            if (options.pipeline) {
                this.saveMetadata({
                    pipeline: options.pipeline,
                    promptUsed: promptText,
                    modelName: fallbackModel,
                    temperature,
                    generationTimeMs: durationMs,
                    promptTokens,
                    completionTokens,
                    costUsd,
                    criticScore: options.criticScore,
                    criticMetrics: options.criticMetrics,
                    retrievedChunks: options.retrievedChunks,
                    moduleId: options.moduleId,
                    sessionId: options.sessionId,
                });
            }

            logger.info("generateText", "Groq respondeu", { provider: "groq", durationMs });
            return content;
        }
    }

    /**
     * Gera texto em modo streaming via Gemini SDK (generateContentStream).
     * Retorna um ReadableStream<string> compatível com Next.js Response.
     *
     * Em caso de falha do Gemini, faz fallback para Groq e envolve a resposta
     * completa num ReadableStream artificial para manter a interface uniforme.
     */
    static async generateTextStream(
        promptText: string,
        options: AiGenerateTextOptions = {}
    ): Promise<ReadableStream<Uint8Array>> {
        const { systemInstruction, temperature = 0.7, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
        const modelSelected = options.modelName || process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
        const encoder = new TextEncoder();

        try {
            const client = this.getGeminiClient();

            logger.info("generateTextStream", "Iniciando stream com Gemini", { model: modelSelected });

            const stream = await client.models.generateContentStream({
                model: modelSelected,
                contents: [{ role: "user", parts: [{ text: promptText }] }],
                config: {
                    systemInstruction,
                    temperature,
                }
            });

            return new ReadableStream<Uint8Array>({
                async start(controller) {
                    try {
                        for await (const chunk of stream) {
                            const text = chunk.text;
                            if (text) {
                                controller.enqueue(encoder.encode(text));
                            }
                        }
                        controller.close();
                    } catch (err: any) {
                        controller.error(err);
                    }
                }
            });

        } catch (geminiError: any) {
            logger.warn("generateTextStream", `Gemini stream falhou — usando Groq fallback`, { error: geminiError.message });

            // Fallback Groq: busca a resposta completa e envolve num ReadableStream
            const groqKey = process.env.GROQ_API_KEY;
            if (!groqKey) throw geminiError;

            const rawModel = process.env.GROQ_FALLBACK_MODEL || "llama-3.3-70b-versatile";
            const fallbackModel = this.mapGroqModel(rawModel);
            const textSystemPrompt = systemInstruction
                || "Você é um professor especialista em redes. Gere uma resposta detalhada e didática.";

            const groqRes = await this.withTimeout(
                fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${groqKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: fallbackModel,
                        messages: [
                            { role: "system", content: textSystemPrompt },
                            { role: "user", content: promptText },
                        ],
                        temperature,
                        stream: true, // Groq suporta streaming SSE nativo
                    }),
                }),
                timeoutMs
            );

            if (!groqRes.ok || !groqRes.body) {
                throw new Error(`Groq streaming fallback failed: ${groqRes.statusText}`);
            }

            logger.info("generateTextStream", "Groq streaming iniciado como fallback", { model: fallbackModel });

            // Groq retorna SSE ("data: {...}\n\n") — parseamos e re-emitimos só o texto
            return new ReadableStream<Uint8Array>({
                async start(controller) {
                    const reader = groqRes.body!.getReader();
                    const dec = new TextDecoder();
                    let buffer = "";
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            buffer += dec.decode(value, { stream: true });
                            const lines = buffer.split("\n");
                            buffer = lines.pop() || "";
                            for (const line of lines) {
                                const trimmed = line.trim();
                                if (!trimmed.startsWith("data:")) continue;
                                const jsonStr = trimmed.slice(5).trim();
                                if (jsonStr === "[DONE]") continue;
                                try {
                                    const parsed = JSON.parse(jsonStr);
                                    const delta = parsed?.choices?.[0]?.delta?.content;
                                    if (delta) controller.enqueue(encoder.encode(delta));
                                } catch { /* chunk inválido, ignorar */ }
                            }
                        }
                        controller.close();
                    } catch (err) {
                        controller.error(err);
                    }
                }
            });
        }
    }
}

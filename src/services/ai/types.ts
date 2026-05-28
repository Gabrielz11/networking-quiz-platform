export const DEFAULT_TIMEOUT_MS = 45_000;
export const CONTENT_TIMEOUT_MS = 90_000;

export interface AiGenerateOptions {
    temperature?: number;
    timeoutMs?: number;
    modelName?: string;
    systemInstruction?: string;
    responseSchema?: any;
    // Metadados para persistência
    pipeline?: string;
    moduleId?: string;
    sessionId?: string;
}

export interface AiProvider {
    name: string;
    generateJson<T = unknown>(prompt: string, options?: AiGenerateOptions): Promise<T>;
    generateText(prompt: string, options?: AiGenerateOptions): Promise<string>;
    generateTextStream(prompt: string, options?: AiGenerateOptions): Promise<ReadableStream<Uint8Array>>;
}

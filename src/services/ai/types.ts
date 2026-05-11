export interface AiGenerateOptions {
    temperature?: number;
    timeoutMs?: number;
    modelName?: string;
    systemInstruction?: string;
    responseSchema?: any;
}

export interface AiGenerateJsonOptions extends AiGenerateOptions {}
export interface AiGenerateTextOptions extends AiGenerateOptions {}


export interface AiProvider {
    name: string;
    generateJson<T = unknown>(prompt: string, options?: AiGenerateOptions): Promise<T>;
    generateText(prompt: string, options?: AiGenerateOptions): Promise<string>;
}

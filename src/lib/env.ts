import { z } from "zod";

const booleanFromEnv = z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true");

const numberFromEnv = (defaultValue: number) =>
    z
        .string()
        .default(String(defaultValue))
        .transform(Number)
        .refine((value) => Number.isFinite(value) && value > 0, {
            message: "O valor deve ser um número positivo",
        });

const envSchema = z
    .object({
        DATABASE_URL: z.string().url(),

        NEXTAUTH_SECRET: z.string().min(32),
        NEXTAUTH_URL: z.string().url(),
        NEXT_PUBLIC_APP_URL: z.string().url(),

        TEACHER_REGISTRATION_KEY: z.string().min(16),

        DB_USER: z.string().min(1),
        DB_PASSWORD: z.string().min(1),
        DB_NAME: z.string().min(1),

        REDIS_URL: z.string().default("redis://localhost:6379"),

        // Gemini
        GEMINI_API_KEY: z.string().min(1),

        CONTENT_GENERATION_PROVIDER: z.enum(["gemini"]).default("gemini"),
        CONTENT_GENERATION_MODEL: z.string().default("gemini-3.5-flash"),

        QUESTION_GENERATION_PROVIDER: z.enum(["gemini"]).default("gemini"),
        QUESTION_GENERATION_MODEL: z.string().default("gemini-3.5-flash"),

        // Groq
        GROQ_API_KEY: z.string().min(1),

        EXPLANATION_PROVIDER: z.enum(["groq"]).default("groq"),
        EXPLANATION_MODEL: z.string().default("llama-3.1-8b-instant"),

        CONTENT_FALLBACK_ENABLED: booleanFromEnv,
        CONTENT_FALLBACK_PROVIDER: z.enum(["groq"]).default("groq"),
        CONTENT_FALLBACK_MODEL: z.string().default("llama-3.3-70b-versatile"),

        // Embeddings
        EMBEDDING_PROVIDER: z.enum(["openai", "gemini"]).default("openai"),
        EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
        OPENAI_API_KEY: z.string().min(1).optional(),

        // Rerank
        RAG_RERANK_ENABLED: booleanFromEnv,
        RAG_RERANK_PROVIDER: z.enum(["cohere"]).default("cohere"),
        RAG_RERANK_MODEL: z.string().default("rerank-v3.5"),
        COHERE_API_KEY: z.string().min(1).optional(),

        // RAG
        UPLOAD_DIR: z.string().default("./storage/uploads"),
        RAG_CHUNK_SIZE: numberFromEnv(1200),
        RAG_CHUNK_OVERLAP: numberFromEnv(200),
        RAG_FINAL_CONTEXT_LIMIT: numberFromEnv(3),
        RAG_RETRIEVAL_LIMIT: numberFromEnv(10),
    })
    .superRefine((data, ctx) => {
        if (data.EMBEDDING_PROVIDER === "openai" && !data.OPENAI_API_KEY) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    "OPENAI_API_KEY é obrigatória quando EMBEDDING_PROVIDER=openai",
                path: ["OPENAI_API_KEY"],
            });
        }

        if (data.RAG_RERANK_ENABLED && !data.COHERE_API_KEY) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    "COHERE_API_KEY é obrigatória quando RAG_RERANK_ENABLED=true",
                path: ["COHERE_API_KEY"],
            });
        }

        if (data.RAG_FINAL_CONTEXT_LIMIT > data.RAG_RETRIEVAL_LIMIT) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    "RAG_FINAL_CONTEXT_LIMIT não pode ser maior que RAG_RETRIEVAL_LIMIT",
                path: ["RAG_FINAL_CONTEXT_LIMIT"],
            });
        }

        if (data.RAG_CHUNK_OVERLAP >= data.RAG_CHUNK_SIZE) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    "RAG_CHUNK_OVERLAP deve ser menor que RAG_CHUNK_SIZE",
                path: ["RAG_CHUNK_OVERLAP"],
            });
        }
    });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Erro de configuração nas variáveis de ambiente:");
    console.error(parsed.error.format());
    process.exit(1);
}

export const env = parsed.data;
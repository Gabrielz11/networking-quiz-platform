import { z } from "zod";

const booleanFromEnv = z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true");

const positiveIntegerFromEnv = (defaultValue: number) =>
    z
        .string()
        .default(String(defaultValue))
        .transform((value) => Number(value))
        .refine(
            (value) =>
                Number.isFinite(value) &&
                Number.isInteger(value) &&
                value > 0,
            {
                message: "O valor deve ser um número inteiro positivo",
            }
        );

const temperatureFromEnv = (defaultValue: number) =>
    z
        .string()
        .default(String(defaultValue))
        .transform((value) => Number(value))
        .refine(
            (value) =>
                Number.isFinite(value) &&
                value >= 0 &&
                value <= 2,
            {
                message: "A temperatura deve estar entre 0 e 2",
            }
        );

const positiveFloatFromEnv = (defaultValue: number) =>
    z
        .string()
        .default(String(defaultValue))
        .transform((value) => Number(value))
        .refine(
            (value) =>
                Number.isFinite(value) &&
                value >= 0 &&
                value <= 1,
            {
                message: "O valor deve ser um número entre 0 e 1",
            }
        );

const envSchema = z
    .object({
        // App
        DATABASE_URL: z.string().url(),

        NEXTAUTH_SECRET: z.string().min(32),
        NEXTAUTH_URL: z.string().url(),
        NEXT_PUBLIC_APP_URL: z.string().url(),

        TEACHER_REGISTRATION_KEY: z.string().min(16),

        // Banco de dados
        DB_USER: z.string().min(1),
        DB_PASSWORD: z.string().min(1),
        DB_NAME: z.string().min(1),

        // Redis
        REDIS_URL: z
            .string()
            .default("redis://localhost:6379"),

        // Gemini
        GEMINI_API_KEY: z.string().min(1),

        CONTENT_GENERATION_PROVIDER: z
            .enum(["gemini"])
            .default("gemini"),

        CONTENT_GENERATION_MODEL: z
            .string()
            .min(1)
            .default("gemini-3.5-flash"),

        CONTENT_GENERATION_TEMPERATURE:
            temperatureFromEnv(0.4),

        CONTENT_GENERATION_MAX_TOKENS:
            positiveIntegerFromEnv(8192),

        QUESTION_GENERATION_PROVIDER: z
            .enum(["gemini"])
            .default("gemini"),

        QUESTION_GENERATION_MODEL: z
            .string()
            .min(1)
            .default("gemini-3.5-flash"),

        QUESTION_GENERATION_TEMPERATURE:
            temperatureFromEnv(0.5),

        QUESTION_GENERATION_MAX_TOKENS:
            positiveIntegerFromEnv(4096),

        // Groq
        GROQ_API_KEY: z.string().min(1),

        EXPLANATION_PROVIDER: z
            .enum(["groq"])
            .default("groq"),

        EXPLANATION_MODEL: z
            .string()
            .min(1)
            .default("openai/gpt-oss-20b"),

        EXPLANATION_TEMPERATURE:
            temperatureFromEnv(0.3),

        EXPLANATION_MAX_TOKENS:
            positiveIntegerFromEnv(512),

        CONTENT_FALLBACK_ENABLED: booleanFromEnv,

        CONTENT_FALLBACK_PROVIDER: z
            .enum(["groq", "openai"])
            .default("openai"),

        CONTENT_FALLBACK_MODEL: z
            .string()
            .min(1)
            .default("gpt-5.6-terra"),

        // Embeddings
        EMBEDDING_PROVIDER: z
            .enum(["openai", "gemini"])
            .default("openai"),

        EMBEDDING_MODEL: z
            .string()
            .min(1)
            .default("text-embedding-3-small"),

        OPENAI_API_KEY: z
            .string()
            .min(1)
            .optional(),

        // Rerank
        RAG_RERANK_ENABLED: booleanFromEnv,

        RAG_RERANK_PROVIDER: z
            .enum(["cohere"])
            .default("cohere"),

        RAG_RERANK_MODEL: z
            .string()
            .min(1)
            .default("rerank-v3.5"),

        COHERE_API_KEY: z
            .string()
            .min(1)
            .optional(),

        // RAG
        UPLOAD_DIR: z
            .string()
            .default("./storage/uploads"),

        RAG_CHUNK_SIZE:
            positiveIntegerFromEnv(1200),

        RAG_CHUNK_OVERLAP:
            positiveIntegerFromEnv(200),

        RAG_FINAL_CONTEXT_LIMIT:
            positiveIntegerFromEnv(8),

        RAG_RETRIEVAL_LIMIT:
            positiveIntegerFromEnv(25),

        RAG_CONTEXT_BUDGET_TOKENS:
            positiveIntegerFromEnv(12000),

        RAG_MAX_CHUNKS_PER_FILE:
            positiveIntegerFromEnv(3),

        RAG_MAX_CHUNKS_PER_SECTION:
            positiveIntegerFromEnv(2),

        // RAG Evaluation (RAGAS Faithfulness)
        RAG_EVALUATION_ENABLED: booleanFromEnv,

        RAG_EVALUATION_PROVIDER: z
            .enum(["google", "openai"])
            .default("google"),

        RAG_EVALUATION_MODEL: z
            .string()
            .min(1)
            .default("gemini-2.5-flash"),

        RAG_EVALUATION_SERVICE_URL: z
            .string()
            .url()
            .default("http://127.0.0.1:8000"),

        RAG_EVALUATION_TRUSTED_THRESHOLD:
            positiveFloatFromEnv(0.90),

        RAG_EVALUATION_REVIEW_THRESHOLD:
            positiveFloatFromEnv(0.80),

    })
    .superRefine((data, ctx) => {
        if (
            (data.EMBEDDING_PROVIDER === "openai" || data.CONTENT_FALLBACK_PROVIDER === "openai") &&
            !data.OPENAI_API_KEY
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    "OPENAI_API_KEY é obrigatória quando EMBEDDING_PROVIDER ou CONTENT_FALLBACK_PROVIDER for 'openai'",
                path: ["OPENAI_API_KEY"],
            });
        }

        if (
            data.RAG_RERANK_ENABLED &&
            !data.COHERE_API_KEY
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    "COHERE_API_KEY é obrigatória quando RAG_RERANK_ENABLED=true",
                path: ["COHERE_API_KEY"],
            });
        }

        if (
            data.RAG_FINAL_CONTEXT_LIMIT >
            data.RAG_RETRIEVAL_LIMIT
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    "RAG_FINAL_CONTEXT_LIMIT não pode ser maior que RAG_RETRIEVAL_LIMIT",
                path: ["RAG_FINAL_CONTEXT_LIMIT"],
            });
        }

        if (
            data.RAG_CHUNK_OVERLAP >=
            data.RAG_CHUNK_SIZE
        ) {
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
    console.error(
        "❌ Erro de configuração nas variáveis de ambiente:"
    );

    console.error(
        JSON.stringify(
            parsed.error.flatten().fieldErrors,
            null,
            2
        )
    );

    process.exit(1);
}

export const env = parsed.data;

export type Env = z.infer<typeof envSchema>;
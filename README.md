# Lumina LMS — Plataforma Educacional Adaptativa para IPv6

O **Lumina LMS** é uma plataforma educacional voltada ao ensino de **Redes de Computadores** com foco em **IPv6**. O sistema combina quizzes adaptativos com inteligência artificial generativa e um pipeline **RAG (Retrieval-Augmented Generation)**, permitindo que professores enviem materiais didáticos e a IA gere conteúdo pedagógico fundamentado nesses documentos.

---

## Funcionalidades Principais

### Para o Aluno
- **Quiz Adaptativo**: Motor de dificuldade dinâmica (`EASY → MEDIUM → HARD`) — 1 acerto avança nível, 2 erros consecutivos retrocedem.
- **Tutor IA com Streaming**: Explicações pedagógicas geradas por IA após cada resposta, em tempo real.
- **Persistência de Sessão**: Pausa e retoma o quiz preservando progresso e nível.
- **Conteúdo Fundamentado (RAG)**: Módulos gerados a partir de materiais reais, reduzindo alucinações.

### Para o Professor
- **Dashboard Administrativo**: RBAC — somente professores acessam o painel.
- **Upload de Materiais**: PDF e TXT processados por pipeline de ingestão assíncrona (BullMQ).
- **Geração de Conteúdo com IA + RAG**: Conteúdo ancorado nos materiais enviados (pgvector + Gemini).
- **Geração de Questões via IA**: Banco de questões criado via `BatchQuizGenerationService`.
- **CRUD Completo de Módulos**.

---

## Tech Stack

| Camada | Tecnologia |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router) + React 19 + TypeScript 5 |
| **Estilização** | Tailwind CSS v4 + shadcn/ui + Radix UI |
| **Banco de Dados** | PostgreSQL 16 + pgvector (extensão vetorial), via Docker |
| **ORM** | Prisma 6 |
| **Autenticação** | NextAuth v5 (beta) — Credentials provider + JWT, roles STUDENT/TEACHER |
| **IA Primária** | Google Gemini (`gemini-2.5-flash`) via `@google/genai` |
| **IA Fallback** | Groq (`llama-3.3-70b-versatile`) — fallback simétrico com retry/backoff |
| **Embeddings** | OpenAI `text-embedding-3-small` (padrão) ou `gemini-embedding-001` |
| **Fila de Ingestão** | BullMQ + Redis 7 (processamento assíncrono de PDFs) |
| **Cache Semântico** | Redis (Tier 1, hash exato) + pgvector (Tier 2, similaridade cosine ≥ 0.92) |
| **Parsing de Docs** | pdf-parse, tiktoken |
| **Validação** | Zod 4 |

---

## Pipeline RAG

```
Upload PDF/TXT
    → ModuleSourceFile (DB) + BullMQ job enfileirado
    → Worker: parse → chunking tiktoken (1200 tok, 200 overlap)
    → Embedding (OpenAI text-embedding-3-small, 1536d)
    → ModuleSourceChunk + pgvector (HNSW index, cosine similarity)

Geração de conteúdo:
    Query = título + descrição do módulo
    → Busca vetorial (top-20 → reranker Cohere → top-5)
    → Prompt com chunks + metadados (fonte, seção, relevância %)
    → Gemini 2.5 Flash gera markdown estruturado
    → Conteúdo salvo no Module

Quiz adaptativo:
    sessionId → embed pergunta atual → cosine search → top-K chunks
    → injetados no prompt de geração de questão
```

### Componentes do Pipeline

| Etapa | Serviço | Localização |
| :--- | :--- | :--- |
| Ingestão (enfileiramento) | `IngestionService` | `src/lib/rag/services/ingestion.service.ts` |
| Parsing + Chunking + Embedding | Worker BullMQ | `src/lib/rag/workers/` |
| Vector Store | `VectorStore` (pgvector) | `src/lib/rag/core/vector-store.ts` |
| Geração com RAG (final, salva no DB) | `ModuleContentRagService` | `src/services/generation/module-content-rag.service.ts` |
| Geração prévia (sem RAG, sem salvar) | `ModuleContentPreviewService` | `src/services/generation/module-content-preview.service.ts` |
| Contexto de quiz | `QuizContextService` | `src/lib/rag/services/quiz-context.service.ts` |

---

## Estrutura do Projeto

```
src/
├── app/
│   ├── (public)/auth/        # Login e registro
│   ├── (admin)/dashboard/    # Dashboard do professor (RBAC)
│   ├── (student)/            # Quiz e módulos do aluno
│   └── api/                  # Route Handlers
├── services/
│   ├── ai/                   # LlmRouter (Gemini + Groq, fallback simétrico, retry)
│   ├── generation/           # Todos os serviços de geração por IA
│   │   ├── batch-quiz-generation.service.ts
│   │   ├── quiz-question-generation.service.ts
│   │   ├── explanation-generation.service.ts
│   │   ├── module-content-preview.service.ts  # preview sem RAG
│   │   └── module-content-rag.service.ts      # geração final com RAG
│   ├── quiz-progression.service.ts  # Algoritmo adaptativo PDR v3.0
│   ├── score.service.ts             # Sliding window (4 sessões)
│   └── activity.service.ts          # Logs de eventos (non-blocking)
├── repositories/
│   ├── quiz.repository.ts    # Acesso ao BD para quizzes (adotado pelas rotas)
│   └── module.repository.ts
├── lib/
│   ├── auth-guard.ts         # requireUser(), requireRole(), AuthError
│   ├── quiz-config.ts        # QUIZ_QUESTION_LIMIT
│   ├── rate-limit.ts         # Sliding window Redis (membro único por requisição)
│   ├── env.ts                # Variáveis validadas com Zod (sempre importar daqui)
│   ├── prisma.ts             # Singleton do Prisma client
│   ├── redis.ts              # Singleton do ioredis
│   ├── cache.ts              # Wrapper de cache Redis
│   └── rag/                  # Infra RAG (vector store, chunking, embeddings, workers)
├── components/
│   ├── ui/                   # Primitivos shadcn
│   └── admin/                # Componentes do professor
└── types/                    # Tipos compartilhados TypeScript
prisma/
├── schema.prisma             # 11 modelos (User, Module, QuizSession, etc.)
└── migrations/               # Incluem migrations SQL cruas para pgvector e índices parciais
```

---

## API Routes

| Rota | Método | Auth | Descrição |
| :--- | :--- | :--- | :--- |
| `/api/auth/register` | POST | — | Registro (aluno ou professor com chave) |
| `/api/quiz/session/start` | POST | Aluno | Cria ou retoma sessão de quiz |
| `/api/quiz/generate-question` | POST | Aluno | Gera próxima questão adaptativa (RAG + IA) |
| `/api/quiz/answer` | POST | Aluno | Submete resposta (atômico, anti-TOCTOU) |
| `/api/quiz/session/cleanup` | POST | — | Purga sessões antigas |
| `/api/explain` | POST | Aluno | Streaming de explicação pedagógica |
| `/api/generate-questions` | POST | Professor | Gera banco de questões por IA |
| `/api/generate-content` | POST | Professor | Gera prévia de conteúdo (sem RAG) |
| `/api/modules/[id]/generate-content-rag` | POST | Professor | Gera conteúdo final com RAG |
| `/api/modules/[id]/sources` | GET/POST | Professor | Lista/upload de arquivos RAG |
| `/api/modules/[id]/sources/[fid]/process` | POST | Professor | Dispara pipeline de ingestão |
| `/api/dashboard/students` | GET | Professor | Analytics de alunos |
| `/api/dashboard/ai-metrics` | GET | Professor | Métricas de uso da IA |

---

## Como Executar

### Pré-requisitos
- Node.js v18+
- Docker e Docker Compose
- Chaves de API: Google Gemini, Groq, OpenAI (embeddings)

### Variáveis de Ambiente

Copie `.env.example` para `.env.local`:

```env
DATABASE_URL="postgresql://admin:password123@localhost:5432/lumina_lms?schema=public"
NEXTAUTH_SECRET="<openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
TEACHER_REGISTRATION_KEY="<chave_secreta>"
REDIS_URL="redis://localhost:6379"

# Provedores de IA
GEMINI_API_KEY="..."
GEMINI_MODEL="gemini-2.5-flash"
GEMINI_PRO_MODEL="gemini-2.5-flash"
GROQ_API_KEY="..."
REASONING_FALLBACK_MODEL="llama-3.3-70b-versatile"

# Embeddings
OPENAI_API_KEY="..."
EMBEDDING_PROVIDER="openai"
EMBEDDING_MODEL="text-embedding-3-small"

# RAG
RAG_CHUNK_SIZE="1200"
RAG_CHUNK_OVERLAP="200"
RAG_RETRIEVAL_LIMIT="20"
RAG_FINAL_CONTEXT_LIMIT="5"
UPLOAD_DIR="./storage/uploads"

# Reranker (opcional)
COHERE_API_KEY="..."
```

### Instalação

```bash
npm install

# Sobe PostgreSQL + Redis
npm run db:up

# Aplica migrations (incluindo pgvector e índices)
npx prisma migrate dev

# Gera o Prisma client
npx prisma generate

# Inicia o servidor de desenvolvimento
npm run dev
```

### Comandos

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm run db:up` | Sobe PostgreSQL + Redis (Docker) |
| `npm run db:down` | Para os containers |
| `npx prisma studio` | Interface visual do banco |
| `npx prisma migrate dev` | Aplica migrations |

---

## Segurança

- **RBAC**: `requireRole("TEACHER")` em todas as rotas de professor; `requireUser()` nas de aluno.
- **Zod**: Validação estrita de todas as entradas de API.
- **Sem gabarito no cliente**: `/api/explain` busca `correctOptionIndex` do banco — o cliente não influencia.
- **Anti-TOCTOU**: `updateMany({ where: { studentAnswer: null } })` garante pontuação única por questão.
- **Unicidade de sessão**: Índice único parcial `QuizSession_active_unique` no Postgres.
- **Rate limit**: Sliding window Redis com membro único por requisição (sem subcontagem).
- **bcrypt**: Senhas hasheadas (10 rounds). Mínimo de 8 caracteres.
- **Sem vazamento de erros**: Mensagens ao cliente são genéricas; detalhes vão apenas ao logger.

---

> Built with coffee and code by **Gabrielz11** — 2026.

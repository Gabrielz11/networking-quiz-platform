# 🎓 Lumina LMS — Plataforma Educacional Adaptativa para IPv6

O **Lumina LMS** é uma plataforma educacional de última geração voltada ao ensino de **Redes de Computadores** com foco em **IPv6**. O sistema combina quizzes adaptativos com inteligência artificial generativa e uma arquitetura **RAG (Retrieval-Augmented Generation)**, permitindo que professores enviem materiais didáticos e a IA gere conteúdo pedagógico fundamentado nesses documentos.

---

## ✨ Funcionalidades Principais

### 👨‍🎓 Para o Aluno
- **Quiz Adaptativo**: Motor de dificuldade dinâmica (`EASY → MEDIUM → HARD`) que se ajusta em tempo real conforme o desempenho — 1 acerto sobe o nível, 2 erros consecutivos descem para reforçar a base.
- **Tutor IA com Feedback Imediato**: Explicações pedagógicas personalizadas geradas por IA após cada resposta, incentivando o aprendizado pelo erro.
- **Persistência de Sessão**: O aluno pode pausar e retomar o quiz exatamente de onde parou, preservando o progresso e o nível de dificuldade.
- **Conteúdo Fundamentado (RAG)**: Os módulos de estudo são gerados a partir de materiais reais enviados pelo professor, eliminando alucinações da IA.

### 👨‍🏫 Para o Professor
- **Dashboard Administrativo**: Interface completa com navegação fixa para gestão de módulos, questões e materiais de apoio.
- **Upload de Materiais (RAG)**: Envio de arquivos PDF e TXT que são processados automaticamente — extração de texto, fragmentação em chunks e vetorização com embeddings.
- **Geração de Conteúdo com IA + RAG**: A IA gera conteúdo pedagógico rico, ancorado estritamente nos materiais enviados pelo professor.
- **Geração de Questões via IA**: Criação automática de bancos de questões estruturados a partir de tópicos específicos.
- **CRUD Completo de Módulos**: Criação, edição e exclusão de módulos acadêmicos com feedback visual instantâneo.

---

## 🏗️ Arquitetura RAG

O diferencial técnico do Lumina LMS é seu pipeline RAG completo integrado ao banco relacional:

```
Professor cria módulo → Upload de PDF/TXT → Extração de texto
    → Chunking (1200 chars, 200 overlap) → Embeddings (gemini-embedding-001, 768d)
    → PostgreSQL + pgvector → Busca Semântica (Cosine Similarity)
    → Contexto Recuperado → LLM Gera Conteúdo Fundamentado
```

### Componentes do Pipeline RAG
| Etapa | Tecnologia | Descrição |
| :--- | :--- | :--- |
| **Parsing** | `pdf-parse` | Extração de texto de PDFs e TXT |
| **Chunking** | Custom service | Fragmentação com overlap para manter contexto |
| **Embeddings** | `gemini-embedding-001` | Vetores de 768 dimensões via `@google/genai` |
| **Vector Store** | `pgvector` (PostgreSQL) | Busca vetorial com operador `<=>` (Cosine Distance) |
| **Geração** | `Gemini 2.5 Flash` + Groq fallback | Conteúdo ancorado nos chunks recuperados |

---

## 🛠 Tech Stack

| Camada | Tecnologia |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router) + React 19 |
| **Linguagem** | TypeScript |
| **Estilização** | Tailwind CSS v4 + shadcn/ui + Lucide Icons |
| **Banco de Dados** | PostgreSQL 16 + pgvector (via Docker) |
| **ORM** | Prisma ORM |
| **Autenticação** | NextAuth.js v5 (Auth.js) com Roles (STUDENT/TEACHER) |
| **IA Primária** | Google Gemini 2.5 Flash (`@google/genai`) |
| **IA Fallback** | Groq (Llama 3.3 70B) |
| **Embeddings** | Google `gemini-embedding-001` (768d) |
| **Validação** | Zod |
| **Notificações** | Sonner |

---

## 📂 Estrutura do Projeto

```
src/
├── app/
│   ├── (public)/        # Landing page e autenticação (login/registro)
│   ├── (admin)/         # Dashboard do professor (protegido por middleware)
│   ├── (student)/       # Módulos de estudo e quizzes adaptativos
│   └── api/             # Route Handlers (auth, modules, quiz, generate, explain)
├── components/
│   ├── admin/           # Componentes do dashboard do professor
│   ├── ui/              # Design system (shadcn/ui)
│   ├── layout/          # Navbar, Sidebar
│   └── providers/       # Context providers (Session, Theme)
├── services/
│   ├── ai.service.ts    # Orquestrador Gemini + Groq com timeout e fallback
│   ├── explain.service.ts
│   ├── quiz.service.ts
│   └── llm/             # Services de domínio (content, quiz, batch)
├── lib/
│   ├── rag/             # Pipeline RAG completo
│   │   ├── document-parser.ts
│   │   ├── chunking-service.ts
│   │   ├── embedding-service.ts
│   │   ├── vector-store.ts
│   │   ├── rag-ingestion-service.ts
│   │   └── module-content-generation-service.ts
│   ├── prisma.ts
│   ├── markdown.ts
│   └── logger.ts
└── types/
prisma/
├── schema.prisma        # Modelos: User, Module, Question, QuizSession,
│                        #   QuestionInstance, ModuleSourceFile, ModuleSourceChunk
docker-compose.yml       # PostgreSQL 16 + pgvector
```

---

## 🚀 Como Executar

### Pré-requisitos
- **Node.js** v18+
- **Docker** & **Docker Compose**
- Chaves de API: **Google Gemini** e **Groq** (opcional, para fallback)

### 1. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Banco de Dados
DATABASE_URL="postgresql://admin:password123@localhost:5432/lumina_lms?schema=public"
DB_USER="admin"
DB_PASSWORD="password123"
DB_NAME="lumina_lms"

# Autenticação
AUTH_SECRET="sua_chave_secreta_aqui"

# Chave de Registro de Professores
TEACHER_REGISTRATION_KEY="chave_secreta_para_registro"

# IA — Provedores
GEMINI_API_KEY="sua_chave_gemini"
GROQ_API_KEY="sua_chave_groq"
```

### 2. Instalação e Execução

```bash
# Instala as dependências
npm install

# Sobe o banco de dados PostgreSQL com pgvector
docker-compose up -d

# Sincroniza o schema do Prisma com o banco
npx prisma generate
npx prisma db push

# Inicia o servidor de desenvolvimento
npm run dev
```

Acesse **http://localhost:3000** para começar.

### Comandos Úteis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run db:up` | Sobe o PostgreSQL (Docker) |
| `npm run db:down` | Para o PostgreSQL |
| `npx prisma studio` | Interface visual do banco de dados |

---

## 🔒 Segurança

- **Zod**: Validação rigorosa de todas as entradas de API.
- **bcrypt**: Senhas hasheadas no banco de dados.
- **NextAuth v5**: Controle de sessão e proteção de rotas por Role.
- **Teacher Gatekeeper**: Registro de professores protegido por `TEACHER_REGISTRATION_KEY`.
- **Storage Seguro**: Arquivos salvos fora da pasta pública (`./storage/uploads`), acessíveis somente via backend autenticado.

---

## 📊 Modelo de Dados

| Modelo | Responsabilidade |
| :--- | :--- |
| `User` | Perfis com roles (STUDENT/TEACHER) e senhas hasheadas |
| `Module` | Módulos de estudo com conteúdo gerado por IA |
| `Question` | Banco de questões vinculado a módulos |
| `QuizSession` | Estado do quiz: nível atual, score, progresso |
| `QuestionInstance` | Snapshot de cada questão respondida com explicação da IA |
| `ModuleSourceFile` | Arquivos enviados pelo professor (PDF/TXT) com status de processamento |
| `ModuleSourceChunk` | Fragmentos vetorizados dos documentos (embeddings 768d) |

---

> Built with ☕ and Code by **Gabrielz11** — 2026.

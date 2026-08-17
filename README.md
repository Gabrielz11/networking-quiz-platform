# Lumina LMS — Plataforma Educacional Adaptativa para IPv6

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis_7-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma_6-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=google&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

> **Trabalho de Conclusão de Curso (TCC)** — Plataforma web de ensino-aprendizagem que utiliza Inteligência Artificial Generativa e Retrieval-Augmented Generation (RAG) para oferecer quizzes adaptativos sobre redes de computadores com foco em IPv6.

---

## 📋 Sobre o Projeto

O **Lumina LMS** é uma plataforma educacional que combina **quizzes adaptativos**, **inteligência artificial generativa** e um pipeline de **RAG (Retrieval-Augmented Generation)** para criar uma experiência de aprendizado personalizada no ensino de **redes de computadores**, com ênfase no protocolo **IPv6**.

O sistema permite que professores façam upload de materiais didáticos (PDFs e TXTs), e a IA gera conteúdo pedagógico e questões de quiz fundamentadas nesses documentos — reduzindo significativamente o risco de alucinações (informações falsas geradas pela IA). Para os alunos, a plataforma ajusta automaticamente o nível de dificuldade das questões com base no desempenho individual, oferecendo explicações personalizadas em tempo real após cada resposta.

---

## 🔍 O Problema

O ensino de redes de computadores, em particular do protocolo **IPv6**, enfrenta desafios significativos no contexto educacional brasileiro:

### Escassez de Materiais Didáticos Específicos
Embora o IPv6 tenha sido padronizado há décadas (RFC 2460, 1998; atualizado pela RFC 8200, 2017), grande parte do material didático disponível ainda foca predominantemente no IPv4. Isso cria uma lacuna na formação de estudantes de cursos de tecnologia, que frequentemente chegam ao mercado de trabalho sem domínio adequado do protocolo que será o padrão da internet atual e futura.

### Avaliações Estáticas e Genéricas
Os métodos tradicionais de avaliação em plataformas de ensino online geralmente utilizam bancos de questões fixos, que não se adaptam ao nível de conhecimento do aluno. Um estudante que domina conceitos básicos é forçado a responder questões triviais, enquanto outro com dificuldades pode ser confrontado com perguntas acima do seu nível — ambos os cenários prejudicam o engajamento e a efetividade do aprendizado.

### Falta de Personalização no Feedback
Em turmas numerosas, professores têm dificuldade em oferecer explicações individualizadas. O feedback após uma avaliação é tipicamente limitado a "correto" ou "incorreto", sem esclarecer o raciocínio por trás da resposta ou indicar caminhos de estudo para melhorar.

### Risco de Alucinações em Conteúdos Gerados por IA
Plataformas que utilizam Modelos de Linguagem (LLMs) para gerar conteúdo educacional sem ancoragem em fontes confiáveis correm o risco de apresentar informações fabricadas (alucinações). Em um domínio técnico como redes de computadores, onde a precisão é crítica (endereços, cabeçalhos, protocolos), uma informação incorreta pode comprometer a formação do aluno.

---

## 🎯 Objetivo

### Objetivo Geral

Desenvolver uma plataforma web de ensino-aprendizagem adaptativo voltada ao protocolo IPv6, que utilize técnicas de **Inteligência Artificial Generativa** com **Retrieval-Augmented Generation (RAG)** para produzir conteúdo educacional fundamentado em materiais didáticos fornecidos por professores, avaliações adaptativas e feedback pedagógico personalizado em tempo real.

### Objetivos Específicos

1. **Implementar um pipeline de RAG** que processe documentos didáticos enviados pelo professor (PDFs e TXTs), realizando extração de texto, fragmentação semântica (chunking), geração de embeddings vetoriais e indexação em banco de dados vetorial (pgvector), permitindo buscas por similaridade semântica.

2. **Desenvolver um motor de quiz adaptativo** que ajuste dinamicamente o nível de dificuldade das questões (Fácil → Médio → Difícil) com base no desempenho imediato do aluno, utilizando regras de progressão configuráveis.

3. **Integrar um tutor IA** capaz de fornecer explicações pedagógicas personalizadas em tempo real (via streaming), fundamentadas no conteúdo dos materiais didáticos e no contexto da questão respondida.

4. **Projetar uma arquitetura de alta disponibilidade** com suporte a múltiplos provedores de IA (Google Gemini como primário, Groq/Llama como fallback), garantindo resiliência e continuidade do serviço.

5. **Garantir a segurança e integridade do sistema** por meio de autenticação baseada em papéis (RBAC), validação de entradas via Zod, mecanismos anti-TOCTOU, idempotência de operações e rate limiting.

---

## 💡 Solução Proposta

O Lumina LMS aborda os problemas identificados por meio de três pilares tecnológicos integrados:

### Pilar 1 — RAG (Retrieval-Augmented Generation)

O RAG é uma técnica que estende as capacidades de um Modelo de Linguagem ao permitir que ele consulte uma **base de conhecimento externa** antes de gerar uma resposta. Em vez de depender apenas do conhecimento adquirido durante o treinamento da IA, o sistema busca trechos relevantes nos documentos enviados pelo professor e os fornece como contexto.

**Como funciona no Lumina LMS:**

```
Upload de PDF/TXT pelo professor
    → Extração de texto (pdf-parse)
    → Fragmentação em chunks (1200 tokens, 200 de sobreposição)
    → Geração de embeddings vetoriais (OpenAI text-embedding-3-small, 1536 dimensões)
    → Indexação no PostgreSQL via pgvector (índice HNSW, similaridade cosine)

Geração de conteúdo do módulo:
    → Busca vetorial (top-20 chunks mais relevantes)
    → Re-ranking com Cohere (seleciona top-5)
    → Prompt contextualizado com metadados (fonte, seção, relevância %)
    → Gemini 2.5 Flash gera conteúdo em Markdown estruturado
    → Conteúdo salvo no módulo

Quiz do aluno:
    → Embedding da questão atual → busca cosine → top-K chunks relevantes
    → Chunks injetados no prompt de geração da próxima questão
```

**Resultado:** O conteúdo gerado é **ancorado (grounded)** nos materiais oficiais da disciplina, reduzindo significativamente o risco de alucinações.

### Pilar 2 — Quiz Adaptativo (Motor de Dificuldade Dinâmica v3.0)

Diferente de quizzes tradicionais com questões fixas, o Lumina LMS ajusta a dificuldade em tempo real:

| Evento | Ação do Sistema |
| :--- | :--- |
| Aluno **acerta** uma questão | Sobe o nível de dificuldade (ex: Fácil → Médio) |
| Aluno **erra** pela 1ª vez no nível | Mantém o nível atual (reforço) |
| Aluno **erra** pela 2ª vez consecutiva no mesmo nível | Desce o nível de dificuldade (ex: Médio → Fácil) |

**Exemplo de fluxo:**

```
Q1: FÁCIL     → Acertou → Próxima: MÉDIO
Q2: MÉDIO     → Errou   → Próxima: MÉDIO (mantém, 1º erro)
Q3: MÉDIO     → Errou   → Próxima: FÁCIL (caiu, 2 erros consecutivos)
Q4: FÁCIL     → Acertou → Próxima: MÉDIO
Q5: MÉDIO     → Acertou → Próxima: DIFÍCIL
```

Cada sessão de quiz é composta por **10 questões**, e o progresso é persistido — se o aluno fechar o navegador, ele retoma exatamente de onde parou.

### Pilar 3 — Tutor IA com Explicações em Tempo Real

Após cada resposta do aluno, a plataforma gera uma explicação pedagógica personalizada em **streaming** (resposta progressiva, palavra por palavra), fundamentada no conteúdo do módulo e nos chunks relevantes do RAG. A IA atua como um **tutor socrático**, explicando o raciocínio correto sem simplesmente revelar a resposta.

---

## 🏗️ Arquitetura do Sistema

O Lumina LMS utiliza uma arquitetura Full-Stack moderna com forte separação de responsabilidades:

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
│  Next.js 16 (App Router) + React 19 + Tailwind CSS v4           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐       │
│  │  Área Pública│  │ Painel Aluno │  │ Dashboard Prof.  │       │
│  │  (Landing)   │  │ (Quiz + RAG) │  │ (CRUD + Upload)  │       │
│  └──────────────┘  └──────────────┘  └──────────────────┘       │
└────────────────────────────┬────────────────────────────────────┘
                             │ API Route Handlers
┌────────────────────────────┴────────────────────────────────────┐
│                        BACKEND                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Camada de Serviços (Services Layer)                     │   │
│  │  ┌────────────┐ ┌──────────────┐ ┌────────────────────┐  │   │
│  │  │ Generation │ │ Analytics    │ │ Learning           │  │   │
│  │  │ (IA + RAG) │ │ (Dashboards) │ │ (Quiz + Explain)   │  │   │
│  │  └────────────┘ └──────────────┘ └────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Camada de IA (LLM Router)                               │   │
│  │  Primário: Google Gemini 2.5 Flash                       │   │
│  │  Fallback: Groq (Llama 3.3 70B) — retry + backoff        │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Camada RAG                                              │   │
│  │  Ingestão (BullMQ Worker) → Chunking → Embeddings        │   │
│  │  → pgvector (Busca Vetorial) → Reranker → Geração        │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                     INFRAESTRUTURA                              │
│  ┌────────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │ PostgreSQL 16  │  │  Redis 7    │  │  Docker Compose      │  │
│  │ + pgvector     │  │  (Cache +   │  │  (Orquestração)      │  │
│  │ (Dados + Vet.) │  │   Filas)    │  │                      │  │
│  └────────────────┘  └─────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Componentes do Pipeline RAG

| Etapa | Serviço | Descrição |
| :--- | :--- | :--- |
| Ingestão | `IngestionService` | Recebe o upload e enfileira o processamento |
| Processamento | Worker BullMQ | Parsing, chunking e geração de embeddings |
| Armazenamento Vetorial | `VectorStore` (pgvector) | Indexa e busca chunks por similaridade |
| Geração com RAG | `ModuleContentRagService` | Gera conteúdo final ancorado nos documentos |
| Prévia sem RAG | `ModuleContentPreviewService` | Gera prévia do conteúdo (sem fontes) |
| Contexto de Quiz | `QuizContextService` | Recupera chunks relevantes para a questão |

---

## ⚙️ Tech Stack

| Camada | Tecnologia | Propósito |
| :--- | :--- | :--- |
| **Framework Web** | Next.js 16 (App Router) + React 19 + TypeScript 5 | Renderização, roteamento e tipagem estática |
| **Estilização** | Tailwind CSS v4 + shadcn/ui + Radix UI | Design system moderno e acessível |
| **Banco de Dados** | PostgreSQL 16 + pgvector | Dados relacionais + busca vetorial |
| **ORM** | Prisma 6 | Mapeamento objeto-relacional e migrations |
| **Autenticação** | NextAuth v5 (beta) — JWT + RBAC | Controle de acesso por papéis (STUDENT/TEACHER) |
| **IA Primária** | Google Gemini (`gemini-2.5-flash`) | Geração de conteúdo, questões e explicações |
| **IA Fallback** | Groq (`llama-3.3-70b-versatile`) | Redundância com retry e backoff exponencial |
| **Embeddings** | OpenAI (`text-embedding-3-small`, 1536d) | Vetorização semântica dos documentos |
| **Fila Assíncrona** | BullMQ + Redis 7 | Processamento de PDFs em background |
| **Cache Semântico** | Redis (hash exato) + pgvector (cosine ≥ 0.92) | Cache de respostas da IA em dois níveis |
| **Parsing de Documentos** | pdf-parse + tiktoken | Extração de texto e contagem de tokens |
| **Validação** | Zod 4 | Validação de schemas em tempo de execução |

---

## 🧩 Funcionalidades

### Para o Aluno

| Funcionalidade | Descrição |
| :--- | :--- |
| **Quiz Adaptativo** | Motor de dificuldade dinâmica com 3 níveis (Fácil → Médio → Difícil). Acerto sobe de nível; 2 erros consecutivos descem. |
| **Tutor IA em Tempo Real** | Explicações pedagógicas geradas por IA via streaming após cada resposta, fundamentadas no material didático. |
| **Persistência de Sessão** | O quiz pode ser pausado e retomado preservando todo o progresso, nível atual e pontuação. |
| **Conteúdo Fundamentado** | Módulos de estudo gerados a partir de materiais reais enviados pelo professor (RAG), reduzindo alucinações. |

### Para o Professor

| Funcionalidade | Descrição |
| :--- | :--- |
| **Dashboard Administrativo** | Painel com RBAC — somente professores acessam. Inclui analytics de alunos e métricas de uso da IA. |
| **Upload de Materiais** | Envio de PDFs e TXTs processados por pipeline de ingestão assíncrona (BullMQ). |
| **Geração de Conteúdo com RAG** | Conteúdo pedagógico gerado pela IA e ancorado nos materiais enviados (pgvector + Gemini). |
| **Geração de Questões em Lote** | Banco de questões criado automaticamente pela IA via `BatchQuizGenerationService`. |
| **CRUD de Módulos** | Criação, edição, visualização e exclusão completa de módulos de estudo. |

---

## 📂 Estrutura do Projeto

```
src/
├── app/
│   ├── (public)/auth/              # Login e registro de usuários
│   ├── (admin)/dashboard/          # Dashboard do professor (RBAC)
│   ├── (student)/                  # Quiz e módulos do aluno
│   └── api/                        # Route Handlers (endpoints da API)
├── services/
│   ├── ai/                         # LLM Router (Gemini + Groq, fallback simétrico)
│   ├── generation/                 # Serviços de geração por IA
│   │   ├── batch-quiz-generation.service.ts
│   │   ├── quiz-question-generation.service.ts
│   │   ├── explanation-generation.service.ts
│   │   ├── module-content-preview.service.ts     # Prévia sem RAG
│   │   └── module-content-rag.service.ts         # Geração final com RAG
│   ├── analytics/                  # Dashboards e métricas
│   ├── learning/                   # Submissão de quiz e explicações
│   ├── quiz-progression.service.ts # Algoritmo adaptativo v3.0
│   ├── score.service.ts            # Nota por janela deslizante (4 sessões)
│   └── student-activity-log.service.ts  # Logs de comportamento
├── repositories/                   # Camada de acesso ao banco de dados
├── lib/
│   ├── auth-guard.ts               # requireUser(), requireRole()
│   ├── env.ts                      # Variáveis validadas com Zod
│   ├── redis.ts                    # Singleton Redis (ioredis)
│   ├── prisma.ts                   # Singleton Prisma client
│   ├── semantic-cache.ts           # Cache semântico (Redis + pgvector)
│   ├── rate-limit.ts               # Sliding window Redis
│   └── rag/                        # Pipeline RAG completo
│       ├── core/                   # Vector store, chunking, embeddings
│       ├── services/               # Ingestão e contexto de quiz
│       └── jobs/                   # Workers BullMQ (processamento async)
├── components/
│   ├── ui/                         # Primitivos shadcn/ui
│   └── admin/                      # Componentes do painel do professor
└── types/                          # Tipos compartilhados TypeScript

prisma/
├── schema.prisma                   # 13 modelos (User, Module, QuizSession, etc.)
└── migrations/                     # Migrations SQL (pgvector, índices parciais)
```

---

## 🛡️ Segurança

O sistema implementa múltiplas camadas de proteção:

| Mecanismo | Descrição |
| :--- | :--- |
| **RBAC** | `requireRole("TEACHER")` em rotas de professor; `requireUser()` nas de aluno. |
| **Validação Zod** | Todas as entradas de API são validadas por schemas Zod antes do processamento. |
| **Anti-Trapaça** | O gabarito (`correctOptionIndex`) nunca é enviado ao cliente — a verificação ocorre no servidor. |
| **Anti-TOCTOU** | `updateMany({ where: { studentAnswer: null } })` impede resposta duplicada por questão. |
| **Sessão Única** | Índice parcial único `QuizSession_active_unique` no PostgreSQL garante uma sessão ativa por aluno/módulo. |
| **Rate Limiting** | Sliding window no Redis com membro único por requisição (sem subcontagem). |
| **Senhas** | Hasheadas com bcrypt (10 rounds). Mínimo de 8 caracteres exigido. |
| **Erros Seguros** | Mensagens ao cliente são genéricas; detalhes técnicos são registrados apenas no logger do servidor. |
| **Idempotência** | Mecanismo de lock via Redis impede processamento duplicado de operações críticas. |

---

## 🚀 Como Executar

### Pré-requisitos

- **Node.js** v18 ou superior
- **Docker** e **Docker Compose**
- Chaves de API: Google Gemini, Groq, OpenAI (para embeddings)

### 1. Clonar o Repositório

```bash
git clone https://github.com/Gabrielz11/networking-quiz-platform.git
cd networking-quiz-platform
```

### 2. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo e preencha com suas chaves:

```bash
cp .env.example .env
```

As principais variáveis são:

```env
# Banco de Dados
DATABASE_URL="postgresql://admin:password123@localhost:5432/lumina_lms?schema=public"

# Autenticação
NEXTAUTH_SECRET="<gere com: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
TEACHER_REGISTRATION_KEY="<chave secreta para registro de professores>"

# Redis
REDIS_URL="redis://localhost:6379"

# Provedores de IA
GEMINI_API_KEY="..."
GEMINI_MODEL="gemini-2.5-flash"
GROQ_API_KEY="..."
REASONING_FALLBACK_MODEL="llama-3.3-70b-versatile"

# Embeddings
OPENAI_API_KEY="..."
EMBEDDING_PROVIDER="openai"
EMBEDDING_MODEL="text-embedding-3-small"

# Pipeline RAG
RAG_CHUNK_SIZE="1200"
RAG_CHUNK_OVERLAP="200"
RAG_RETRIEVAL_LIMIT="20"
RAG_FINAL_CONTEXT_LIMIT="5"
UPLOAD_DIR="./storage/uploads"

# Reranker (opcional)
COHERE_API_KEY="..."
```

### 3. Instalar e Executar

```bash
# Instalar dependências
npm install

# Subir PostgreSQL (com pgvector) + Redis via Docker
npm run db:up

# Aplicar migrations do banco de dados
npx prisma migrate dev

# Gerar o Prisma client
npx prisma generate

# Iniciar o servidor de desenvolvimento
npm run dev
```

A aplicação estará disponível em **http://localhost:3000**.

### Comandos Úteis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm run lint` | Executa o ESLint |
| `npm run db:up` | Sobe PostgreSQL + Redis (Docker) |
| `npm run db:down` | Para os containers Docker |
| `npm run worker` | Inicia o worker BullMQ (processamento de PDFs) |
| `npx prisma studio` | Abre a interface visual do banco de dados |
| `npx prisma migrate dev` | Aplica migrations pendentes |

---

## 🔌 API Routes

| Rota | Método | Auth | Descrição |
| :--- | :--- | :--- | :--- |
| `/api/auth/register` | POST | — | Registro de usuário (aluno ou professor com chave) |
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
| `/api/dashboard/students` | GET | Professor | Analytics de desempenho dos alunos |
| `/api/dashboard/ai-metrics` | GET | Professor | Métricas de uso da IA |
| `/api/dashboard/analytics` | GET | Professor | Estatísticas gerais da plataforma |

---

## 📚 Glossário

| Termo | Definição |
| :--- | :--- |
| **RAG** | *Retrieval-Augmented Generation* — Técnica que combina busca em base de conhecimento com geração por IA, ancorando as respostas em documentos reais. |
| **LLM** | *Large Language Model* — Modelo de linguagem de grande escala treinado em volumes massivos de texto (ex: Gemini, Llama). |
| **Embedding** | Representação numérica (vetor) do significado semântico de um texto. Textos similares geram vetores próximos no espaço vetorial. |
| **Chunk** | Fragmento pequeno de um documento, criado durante o processo de chunking para respeitar os limites de contexto da IA. |
| **pgvector** | Extensão do PostgreSQL que permite armazenar e buscar vetores por similaridade, eliminando a necessidade de bancos vetoriais externos. |
| **Similaridade Cosine** | Métrica matemática usada para medir o quão semanticamente similares são dois textos com base no ângulo entre seus vetores. |
| **Alucinação** | Fenômeno em que a IA gera informações falsas ou inventadas com aparência de veracidade. O RAG mitiga este problema. |
| **RBAC** | *Role-Based Access Control* — Modelo de controle de acesso baseado em papéis (ex: STUDENT, TEACHER). |
| **TOCTOU** | *Time-of-Check to Time-of-Use* — Classe de vulnerabilidade onde o estado muda entre a verificação e a ação. |
| **BullMQ** | Biblioteca de filas para Node.js baseada em Redis, usada para processamento assíncrono de tarefas pesadas. |
| **Fallback** | Mecanismo de redundância que aciona um provedor alternativo quando o primário falha. |
| **Streaming** | Técnica de transmissão progressiva da resposta da IA (token por token), proporcionando feedback imediato ao usuário. |
| **HNSW** | *Hierarchical Navigable Small World* — Algoritmo de indexação para busca aproximada de vizinhos mais próximos em espaços vetoriais. |

---

## 📄 Licença

Este projeto foi desenvolvido como **Trabalho de Conclusão de Curso (TCC)** para fins acadêmicos.

---

> Desenvolvido por **Gabriel** — 2026

# EXECUTE.md — Implementação RAG com pgvector no Lumina LMS

## Projeto

Repositório:

```txt
https://github.com/Gabrielz11/networking-quiz-platform
```

## Objetivo

Adicionar uma estrutura **RAG — Retrieval-Augmented Generation** ao projeto atual, sem reescrever a aplicação inteira.

O sistema atual já permite que o professor crie módulos e gere conteúdo/quiz usando IA.  
A nova estrutura deve permitir que o professor envie arquivos de apoio, como PDF e TXT, e a IA gere o conteúdo do módulo com base nesses materiais.

Exemplo de fluxo desejado:

```txt
Professor cria módulo
    ↓
Título: "O que é IPv6?"
    ↓
Professor adiciona arquivo: livro-de-ipv6.pdf
    ↓
Sistema extrai o texto do PDF
    ↓
Sistema divide em chunks
    ↓
Sistema gera embeddings
    ↓
Sistema salva os embeddings no PostgreSQL com pgvector
    ↓
Professor clica em "Gerar conteúdo com IA usando materiais"
    ↓
Sistema busca os chunks mais relevantes com pgvector
    ↓
IA gera conteúdo em Markdown baseado no PDF
    ↓
Conteúdo é salvo no módulo
    ↓
Aluno visualiza o conteúdo normalmente
```

---

# 1. Objetivo técnico

Implementar uma arquitetura RAG incremental usando:

- Next.js App Router
- TypeScript
- Prisma ORM
- PostgreSQL
- pgvector
- Docker
- Docker Compose
- Gemini/Groq para geração de conteúdo
- Serviço de embeddings compatível com Gemini ou OpenAI
- Upload local de arquivos inicialmente
- PDF/TXT como formatos iniciais
- Zod para validações
- shadcn/ui para interface
- Server Actions ou API Routes, conforme a estrutura atual do projeto

---

# 2. Restrições importantes

Não reescrever o projeto inteiro.

Preservar:

- fluxo atual de criação de módulos;
- fluxo atual do quiz adaptativo;
- autenticação atual com NextAuth/Auth.js;
- painel do professor;
- painel do aluno;
- estrutura atual do Prisma;
- providers atuais de IA, se já existirem.

Não fazer:

- lógica RAG diretamente dentro de componentes React;
- chamadas diretas para IA dentro da UI;
- arquivos públicos sem controle;
- arquitetura exagerada para MVP;
- mudança radical no quiz neste primeiro momento.

---

# 3. Resultado esperado

Ao final da implementação, o professor deverá conseguir:

1. Criar ou editar um módulo.
2. Informar um título, por exemplo: `O que é IPv6?`.
3. Informar uma descrição curta ou não.
4. Fazer upload de um PDF ou TXT.
5. Processar o arquivo.
6. Gerar conteúdo com IA usando os arquivos enviados.
7. Salvar o conteúdo no módulo.
8. Permitir que o aluno visualize o conteúdo normalmente.
9. Manter o quiz funcionando com base no conteúdo salvo.

---

# 4. Arquitetura desejada

## 4.1 Fluxo geral

```txt
Upload do arquivo
    ↓
Salva arquivo localmente
    ↓
Cria registro no banco
    ↓
Extrai texto
    ↓
Faz chunking
    ↓
Gera embeddings
    ↓
Salva chunks + embeddings no PostgreSQL com pgvector
    ↓
Busca semântica pelo título do módulo
    ↓
Monta contexto
    ↓
Chama IA generativa
    ↓
Salva conteúdo no módulo
```

---

# 5. Docker e infraestrutura

## 5.1 Atualizar Docker Compose

Verifique o arquivo atual de Docker Compose do projeto.

Caso o projeto já use PostgreSQL, substituir a imagem padrão por uma imagem com pgvector.

Usar preferencialmente:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: lumina_postgres
    restart: always
    environment:
      POSTGRES_USER: lumina
      POSTGRES_PASSWORD: lumina
      POSTGRES_DB: lumina_lms
    ports:
      - "5432:5432"
    volumes:
      - lumina_postgres_data:/var/lib/postgresql/data
    networks:
      - lumina_network

volumes:
  lumina_postgres_data:

networks:
  lumina_network:
    driver: bridge
```

Se o projeto já tiver outros serviços no Docker Compose, preservar os serviços existentes e apenas adaptar o PostgreSQL para usar pgvector.

## 5.2 Serviços que podem ficar em Docker

Colocar no Docker quando viável:

- PostgreSQL com pgvector;
- aplicação Next.js, se já existir Dockerfile;
- serviço de processamento RAG futuramente;
- Redis futuramente para fila;
- MinIO futuramente para simular S3 local.

Para este MVP, priorizar:

```txt
PostgreSQL + pgvector em Docker
```

## 5.3 Dockerfile opcional para aplicação

Caso ainda não exista Dockerfile para a aplicação, criar um Dockerfile básico:

```dockerfile
FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

## 5.4 docker-compose com app + database

Se for adequado ao projeto, criar ou adaptar:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: lumina_app
    restart: always
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - postgres
    networks:
      - lumina_network

  postgres:
    image: pgvector/pgvector:pg16
    container_name: lumina_postgres
    restart: always
    environment:
      POSTGRES_USER: lumina
      POSTGRES_PASSWORD: lumina
      POSTGRES_DB: lumina_lms
    ports:
      - "5432:5432"
    volumes:
      - lumina_postgres_data:/var/lib/postgresql/data
    networks:
      - lumina_network

volumes:
  lumina_postgres_data:

networks:
  lumina_network:
    driver: bridge
```

---

# 6. Variáveis de ambiente

revisar o `.env`:

---

# 7. Prisma e pgvector

## 7.1 Habilitar extensão pgvector

Criar migration SQL para habilitar a extensão:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

No Prisma, pode ser necessário criar uma migration manual:

```bash
npx prisma migrate dev --name add_pgvector_extension
```

Depois editar o arquivo SQL da migration para conter:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## 7.2 Atualizar schema Prisma

Adicionar os models abaixo no `schema.prisma`, adaptando o nome do model `Module` conforme o projeto atual.

```prisma
model ModuleSourceFile {
  id            String   @id @default(cuid())

  moduleId      String
  module        Module   @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  fileName      String
  originalName  String
  mimeType      String
  size          Int
  storagePath   String

  status        SourceFileStatus @default(UPLOADED)
  errorMessage  String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  chunks        ModuleSourceChunk[]

  @@index([moduleId])
}

model ModuleSourceChunk {
  id          String   @id @default(cuid())

  fileId      String
  file        ModuleSourceFile @relation(fields: [fileId], references: [id], onDelete: Cascade)

  moduleId    String
  module      Module @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  content     String
  chunkIndex  Int
  tokenCount  Int?

  embedding   Unsupported("vector")?

  createdAt   DateTime @default(now())

  @@index([moduleId])
  @@index([fileId])
}

enum SourceFileStatus {
  UPLOADED
  PROCESSING
  PROCESSED
  FAILED
}
```

## 7.3 Relações no model Module

No model `Module`, adicionar:

```prisma
sourceFiles   ModuleSourceFile[]
sourceChunks  ModuleSourceChunk[]
```

Exemplo:

```prisma
model Module {
  id            String   @id @default(cuid())
  title         String
  description   String?
  content       String?

  sourceFiles   ModuleSourceFile[]
  sourceChunks  ModuleSourceChunk[]

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

Não substituir o model Module inteiro. Apenas adaptar o model real do projeto.

---

# 8. Migration para índice vetorial

Depois que a tabela for criada, criar migration SQL para índice vetorial.

A dimensão depende do modelo de embeddings.

Se usar Gemini `text-embedding-004`, confirmar dimensão retornada pelo provider antes de fixar.

Exemplo comum com 768 dimensões:

```sql
CREATE INDEX IF NOT EXISTS module_source_chunk_embedding_idx
ON "ModuleSourceChunk"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

Se o Prisma não gerar corretamente a coluna vector, criar manualmente:

```sql
ALTER TABLE "ModuleSourceChunk"
ADD COLUMN IF NOT EXISTS embedding vector(768);
```

Importante:

- confirmar a dimensão do embedding;
- manter o índice compatível com essa dimensão;
- documentar a dimensão escolhida no README.

---

# 9. Estrutura de pastas RAG

Criar:

```txt
src/lib/rag/
  document-parser.ts
  chunking-service.ts
  embedding-service.ts
  vector-store.ts
  rag-ingestion-service.ts
  module-content-generation-service.ts
  quiz-rag-context-service.ts
  rag-types.ts
```

Criar componentes:

```txt
src/components/admin/modules/
  ModuleSourceUploader.tsx
  ModuleSourceFilesList.tsx
  GenerateContentWithRagButton.tsx
```

Criar rotas ou actions:

```txt
src/app/api/modules/[moduleId]/sources/route.ts
src/app/api/modules/[moduleId]/sources/[fileId]/process/route.ts
src/app/api/modules/[moduleId]/generate-content-rag/route.ts
```

Adaptar os caminhos se a estrutura real do projeto for diferente.

---

# 10. Tipos principais

Criar:

```ts
// src/lib/rag/rag-types.ts

export interface ParsedDocument {
  text: string;
  metadata: {
    fileName: string;
    mimeType: string;
    pageCount?: number;
  };
}

export interface DocumentChunk {
  content: string;
  chunkIndex: number;
  tokenCount?: number;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  fileName: string;
  score: number;
}

export interface AddChunksInput {
  moduleId: string;
  fileId: string;
  chunks: DocumentChunk[];
  embeddings: number[][];
}

export interface SearchSimilarInput {
  moduleId: string;
  query: string;
  limit?: number;
}
```

---

# 11. Upload de arquivos

## 11.1 Regras

Aceitar inicialmente:

```txt
application/pdf
text/plain
```

Limite inicial:

```txt
10MB por arquivo
```

Salvar localmente em:

```txt
storage/uploads/modules/{moduleId}/
```

O nome físico do arquivo deve ser seguro, por exemplo:

```txt
{fileId}-{timestamp}.pdf
```

Nunca confiar no nome original do arquivo para path.

## 11.2 Rota de upload

Criar rota:

```txt
POST /api/modules/[moduleId]/sources
```

Responsabilidades:

1. Validar sessão.
2. Validar se o usuário é professor/admin.
3. Validar `moduleId`.
4. Validar arquivo.
5. Salvar arquivo localmente.
6. Criar registro em `ModuleSourceFile`.
7. Retornar arquivo criado.

Pseudo-fluxo:

```ts
const session = await auth();

if (!session || session.user.role !== "TEACHER") {
  return unauthorized();
}

const formData = await request.formData();
const file = formData.get("file");

validateFile(file);

const savedFile = await saveFileToStorage(file, moduleId);

const sourceFile = await prisma.moduleSourceFile.create({
  data: {
    moduleId,
    fileName: savedFile.fileName,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    storagePath: savedFile.storagePath,
    status: "UPLOADED",
  },
});
```

---

# 12. Parser de documentos

Criar:

```txt
src/lib/rag/document-parser.ts
```

Responsabilidade:

- receber caminho do arquivo;
- identificar MIME type;
- extrair texto;
- retornar texto limpo.

Interface:

```ts
import type { ParsedDocument } from "./rag-types";

export async function parseDocument(input: {
  filePath: string;
  fileName: string;
  mimeType: string;
}): Promise<ParsedDocument> {
  if (input.mimeType === "application/pdf") {
    return parsePdf(input);
  }

  if (input.mimeType === "text/plain") {
    return parseTxt(input);
  }

  throw new Error(`Unsupported file type: ${input.mimeType}`);
}
```

Bibliotecas sugeridas:

```bash
npm install pdf-parse
```

Para TXT:

```ts
import fs from "node:fs/promises";

const text = await fs.readFile(filePath, "utf-8");
```

Para PDF:

```ts
import fs from "node:fs/promises";
import pdf from "pdf-parse";

const buffer = await fs.readFile(filePath);
const data = await pdf(buffer);

return {
  text: data.text,
  metadata: {
    fileName,
    mimeType,
    pageCount: data.numpages,
  },
};
```

---

# 13. Chunking

Criar:

```txt
src/lib/rag/chunking-service.ts
```

Implementar:

```ts
import type { DocumentChunk } from "./rag-types";

export function createChunks(
  text: string,
  options?: {
    chunkSize?: number;
    overlap?: number;
  }
): DocumentChunk[] {
  const chunkSize = options?.chunkSize ?? Number(process.env.RAG_CHUNK_SIZE ?? 1200);
  const overlap = options?.overlap ?? Number(process.env.RAG_CHUNK_OVERLAP ?? 200);

  const normalized = text
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return [];
  }

  const chunks: DocumentChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const content = normalized.slice(start, end).trim();

    if (content.length > 0) {
      chunks.push({
        content,
        chunkIndex,
        tokenCount: Math.ceil(content.length / 4),
      });
    }

    chunkIndex++;
    start += chunkSize - overlap;
  }

  return chunks;
}
```

Para o MVP, chunking por caracteres é aceitável.  
Futuramente, melhorar para chunking por tokens usando tokenizer.

---

# 14. Embedding Service

Criar:

```txt
src/lib/rag/embedding-service.ts
```

Interface:

```ts
export interface EmbeddingService {
  embedText(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
}
```

Implementação inicial com Gemini, se o projeto já usa Gemini:

```bash
npm install @google/generative-ai
```

Exemplo:

```ts
import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiEmbeddingService implements EmbeddingService {
  private client: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    this.client = new GoogleGenerativeAI(apiKey);
  }

  async embedText(text: string): Promise<number[]> {
    const modelName = process.env.EMBEDDING_MODEL ?? "text-embedding-004";
    const model = this.client.getGenerativeModel({ model: modelName });

    const result = await model.embedContent(text);

    const embedding = result.embedding?.values;

    if (!embedding || embedding.length === 0) {
      throw new Error("Failed to generate embedding");
    }

    return embedding;
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      embeddings.push(await this.embedText(text));
    }

    return embeddings;
  }
}

export function getEmbeddingService(): EmbeddingService {
  return new GeminiEmbeddingService();
}
```

Observação:

- Se o SDK atual do projeto já tiver wrapper para Gemini, reutilizar.
- Não duplicar lógica de API key se já existir service centralizado.
- Se o projeto já usa outro provider, adaptar mantendo a interface.

---

# 15. Vector Store com pgvector

Criar:

```txt
src/lib/rag/vector-store.ts
```

Responsabilidades:

- salvar chunks com embeddings;
- buscar chunks similares usando cosine distance;
- retornar os melhores trechos.

## 15.1 Função para converter array em vector

```ts
function toPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}
```

## 15.2 Implementação sugerida

```ts
import { prisma } from "@/lib/prisma";
import type {
  AddChunksInput,
  RetrievedChunk,
  SearchSimilarInput,
} from "./rag-types";
import { getEmbeddingService } from "./embedding-service";

function toPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}

export class PgVectorStore {
  async addChunks(input: AddChunksInput): Promise<void> {
    for (let i = 0; i < input.chunks.length; i++) {
      const chunk = input.chunks[i];
      const embedding = input.embeddings[i];

      await prisma.$executeRawUnsafe(
        `
        INSERT INTO "ModuleSourceChunk"
          ("id", "fileId", "moduleId", "content", "chunkIndex", "tokenCount", "embedding", "createdAt")
        VALUES
          (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::vector, NOW())
        `,
        input.fileId,
        input.moduleId,
        chunk.content,
        chunk.chunkIndex,
        chunk.tokenCount ?? null,
        toPgVector(embedding)
      );
    }
  }

  async searchSimilar(input: SearchSimilarInput): Promise<RetrievedChunk[]> {
    const embeddingService = getEmbeddingService();
    const queryEmbedding = await embeddingService.embedText(input.query);
    const limit = input.limit ?? Number(process.env.RAG_RETRIEVAL_LIMIT ?? 6);

    const rows = await prisma.$queryRawUnsafe<RetrievedChunk[]>(
      `
      SELECT
        c."id",
        c."content",
        f."originalName" as "fileName",
        1 - (c."embedding" <=> $1::vector) as "score"
      FROM "ModuleSourceChunk" c
      INNER JOIN "ModuleSourceFile" f ON f."id" = c."fileId"
      WHERE c."moduleId" = $2
      ORDER BY c."embedding" <=> $1::vector
      LIMIT $3
      `,
      toPgVector(queryEmbedding),
      input.moduleId,
      limit
    );

    return rows;
  }
}

export function getVectorStore() {
  return new PgVectorStore();
}
```

Atenção:

- Validar se o banco possui `gen_random_uuid()`.
- Se não possuir, usar `cuid()` gerado na aplicação.
- Se o projeto usa IDs cuid, preferir gerar IDs com `createId()` da lib `@paralleldrive/cuid2` ou usar `crypto.randomUUID()`.
- Ajustar o tipo do ID conforme o padrão atual do projeto.

---

# 16. Serviço de ingestão RAG

Criar:

```txt
src/lib/rag/rag-ingestion-service.ts
```

Responsabilidade:

```txt
Arquivo enviado
  -> atualizar status para PROCESSING
  -> extrair texto
  -> criar chunks
  -> gerar embeddings
  -> remover chunks antigos do arquivo
  -> salvar novos chunks
  -> atualizar status para PROCESSED
```

Implementação sugerida:

```ts
import { prisma } from "@/lib/prisma";
import { parseDocument } from "./document-parser";
import { createChunks } from "./chunking-service";
import { getEmbeddingService } from "./embedding-service";
import { getVectorStore } from "./vector-store";

export async function processSourceFile(input: {
  fileId: string;
  moduleId: string;
}) {
  const sourceFile = await prisma.moduleSourceFile.findFirst({
    where: {
      id: input.fileId,
      moduleId: input.moduleId,
    },
  });

  if (!sourceFile) {
    throw new Error("Source file not found");
  }

  try {
    await prisma.moduleSourceFile.update({
      where: { id: sourceFile.id },
      data: {
        status: "PROCESSING",
        errorMessage: null,
      },
    });

    const parsed = await parseDocument({
      filePath: sourceFile.storagePath,
      fileName: sourceFile.originalName,
      mimeType: sourceFile.mimeType,
    });

    const chunks = createChunks(parsed.text);

    if (chunks.length === 0) {
      throw new Error("No text content could be extracted from this file");
    }

    const embeddingService = getEmbeddingService();
    const embeddings = await embeddingService.embedMany(
      chunks.map((chunk) => chunk.content)
    );

    await prisma.moduleSourceChunk.deleteMany({
      where: {
        fileId: sourceFile.id,
      },
    });

    const vectorStore = getVectorStore();

    await vectorStore.addChunks({
      moduleId: sourceFile.moduleId,
      fileId: sourceFile.id,
      chunks,
      embeddings,
    });

    await prisma.moduleSourceFile.update({
      where: { id: sourceFile.id },
      data: {
        status: "PROCESSED",
        errorMessage: null,
      },
    });

    return {
      success: true,
      chunks: chunks.length,
    };
  } catch (error) {
    await prisma.moduleSourceFile.update({
      where: { id: sourceFile.id },
      data: {
        status: "FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Unknown processing error",
      },
    });

    throw error;
  }
}
```

---

# 17. Rota para processar arquivo

Criar:

```txt
POST /api/modules/[moduleId]/sources/[fileId]/process
```

Responsabilidades:

1. Validar sessão.
2. Validar role de professor/admin.
3. Chamar `processSourceFile`.
4. Retornar resultado.

Exemplo:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { processSourceFile } from "@/lib/rag/rag-ingestion-service";

export async function POST(
  request: Request,
  context: { params: { moduleId: string; fileId: string } }
) {
  const session = await auth();

  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { moduleId, fileId } = context.params;

  try {
    const result = await processSourceFile({
      moduleId,
      fileId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process file",
      },
      { status: 500 }
    );
  }
}
```

Adaptar a checagem de role conforme o projeto atual.

---

# 18. Serviço de geração de conteúdo com RAG

Criar:

```txt
src/lib/rag/module-content-generation-service.ts
```

Fluxo:

```txt
Recebe moduleId
    ↓
Busca o módulo
    ↓
Usa o título do módulo como query
    ↓
Busca chunks similares no pgvector
    ↓
Monta contexto
    ↓
Chama IA
    ↓
Salva o conteúdo gerado no módulo
```

Implementação conceitual:

```ts
import { prisma } from "@/lib/prisma";
import { getVectorStore } from "./vector-store";

export async function generateModuleContentWithRag(input: {
  moduleId: string;
}) {
  const module = await prisma.module.findUnique({
    where: { id: input.moduleId },
  });

  if (!module) {
    throw new Error("Module not found");
  }

  const vectorStore = getVectorStore();

  const retrievedChunks = await vectorStore.searchSimilar({
    moduleId: module.id,
    query: module.title,
    limit: Number(process.env.RAG_RETRIEVAL_LIMIT ?? 6),
  });

  if (retrievedChunks.length === 0) {
    throw new Error("No processed source content found for this module");
  }

  const context = retrievedChunks
    .map((chunk, index) => {
      return `Fonte ${index + 1}: ${chunk.fileName}\nScore: ${chunk.score}\nConteúdo:\n${chunk.content}`;
    })
    .join("\n\n---\n\n");

  const prompt = buildModuleContentPrompt({
    moduleTitle: module.title,
    moduleDescription: module.description ?? "",
    retrievedContext: context,
  });

  const generatedContent = await callGenerativeAi(prompt);

  const updatedModule = await prisma.module.update({
    where: { id: module.id },
    data: {
      content: generatedContent,
    },
  });

  return {
    module: updatedModule,
    usedChunks: retrievedChunks,
  };
}
```

Criar função de prompt:

```ts
function buildModuleContentPrompt(input: {
  moduleTitle: string;
  moduleDescription?: string;
  retrievedContext: string;
}) {
  return `
Você é um professor especialista em redes de computadores.

Crie um conteúdo didático para alunos do 2º semestre do curso de redes.

Título do módulo:
${input.moduleTitle}

Descrição do módulo:
${input.moduleDescription ?? ""}

Use prioritariamente o contexto abaixo, extraído dos materiais enviados pelo professor.

Contexto:
${input.retrievedContext}

Regras obrigatórias:
- Explique de forma clara e progressiva.
- Use linguagem simples, mas tecnicamente correta.
- Estruture em Markdown.
- Inclua exemplos práticos.
- Inclua analogias quando útil.
- Não invente informações que não estejam no contexto.
- Se o contexto for insuficiente, informe quais partes precisam de material complementar.
- Não cite fontes inexistentes.
- Não diga que acessou o PDF diretamente; diga que usou o material enviado.
- Gere um conteúdo educacional completo.

Estrutura desejada:
# ${input.moduleTitle}

## 1. Introdução

## 2. Conceito principal

## 3. Explicação técnica

## 4. Exemplo prático

## 5. Erros comuns

## 6. Resumo final

## 7. Perguntas de revisão
`;
}
```

A função `callGenerativeAi` deve reutilizar o service de IA já existente no projeto.

Não criar uma chamada nova duplicada se já houver wrapper para Gemini/Groq.

---

# 19. Rota para gerar conteúdo com RAG

Criar:

```txt
POST /api/modules/[moduleId]/generate-content-rag
```

Responsabilidades:

1. Validar sessão.
2. Validar professor/admin.
3. Chamar `generateModuleContentWithRag`.
4. Retornar conteúdo gerado.

Exemplo:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateModuleContentWithRag } from "@/lib/rag/module-content-generation-service";

export async function POST(
  request: Request,
  context: { params: { moduleId: string } }
) {
  const session = await auth();

  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateModuleContentWithRag({
      moduleId: context.params.moduleId,
    });

    return NextResponse.json({
      content: result.module.content,
      usedChunks: result.usedChunks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate module content with RAG",
      },
      { status: 500 }
    );
  }
}
```

---

# 20. Interface do professor

Adicionar uma seção na tela de criação/edição do módulo.

Título da seção:

```txt
Materiais de apoio para geração por IA
```

Componentes sugeridos:

```txt
ModuleSourceUploader.tsx
ModuleSourceFilesList.tsx
GenerateContentWithRagButton.tsx
```

## 20.1 ModuleSourceUploader

Responsável por:

- selecionar arquivo;
- validar tipo;
- validar tamanho;
- enviar arquivo para API;
- mostrar toast de sucesso/erro;
- atualizar lista de arquivos.

Texto da interface:

```txt
Adicione PDFs ou arquivos TXT que servirão como base para a IA gerar o conteúdo deste módulo.
```

## 20.2 ModuleSourceFilesList

Mostrar:

- nome original;
- tipo;
- tamanho;
- status;
- botão processar;
- botão reprocessar;
- botão remover, se implementado;
- mensagem de erro, se houver.

Status visuais:

```txt
UPLOADED    → Enviado
PROCESSING  → Processando
PROCESSED   → Processado
FAILED      → Erro
```

## 20.3 GenerateContentWithRagButton

Botão:

```txt
Gerar conteúdo com IA usando materiais
```

Comportamento:

- só habilitar se existir pelo menos um arquivo `PROCESSED`;
- ao clicar, chamar `/api/modules/[moduleId]/generate-content-rag`;
- exibir loading;
- exibir toast;
- atualizar o campo de conteúdo do módulo.

---

# 21. Integração com o quiz atual

Não alterar o quiz radicalmente neste MVP.

Garantir que:

- o conteúdo gerado pelo RAG seja salvo no mesmo campo que o conteúdo atual;
- o quiz continue lendo esse conteúdo;
- a geração de quiz continue funcionando usando o conteúdo salvo no módulo.

Criar serviço preparado para evolução futura:

```txt
src/lib/rag/quiz-rag-context-service.ts
```

Conteúdo inicial:

```ts
import { getVectorStore } from "./vector-store";

export async function getQuizContextFromRag(input: {
  moduleId: string;
  topic?: string;
}) {
  const vectorStore = getVectorStore();

  return vectorStore.searchSimilar({
    moduleId: input.moduleId,
    query: input.topic ?? "principais conceitos do módulo",
    limit: 8,
  });
}
```

Não integrar obrigatoriamente no quiz agora, apenas deixar preparado.

---

# 22. Validações com Zod

Criar schemas para:

```txt
upload de arquivo
processamento
geração de conteúdo
```

Exemplo:

```ts
import { z } from "zod";

export const moduleSourceUploadSchema = z.object({
  moduleId: z.string().min(1),
});

export const processSourceFileSchema = z.object({
  moduleId: z.string().min(1),
  fileId: z.string().min(1),
});

export const generateContentWithRagSchema = z.object({
  moduleId: z.string().min(1),
});
```

---

# 23. Segurança

Implementar:

- validar sessão em todas as rotas;
- validar role de professor/admin;
- validar se o módulo existe;
- validar se o arquivo pertence ao módulo;
- impedir acesso público direto aos arquivos;
- salvar arquivos fora da pasta `public`;
- sanitizar nomes de arquivos;
- limitar tamanho do arquivo;
- limitar tipos de arquivo;
- não expor paths internos no frontend;
- tratar erros sem vazar stack trace.

---

# 24. Erros esperados e mensagens

Mensagens úteis:

```txt
Nenhum arquivo enviado para este módulo.
O arquivo ainda não foi processado.
Não foi possível extrair texto deste PDF.
Este tipo de arquivo ainda não é suportado.
O arquivo excede o limite de 10MB.
Não há contexto suficiente para gerar conteúdo.
Erro ao gerar embeddings.
Erro ao buscar chunks relevantes.
Conteúdo gerado com sucesso.
```

---

# 25. README

Atualizar o README com uma seção:

```md
## RAG com materiais do professor

O professor pode anexar PDFs ou arquivos TXT em um módulo.  
O sistema processa esses arquivos, gera embeddings com IA e salva os vetores no PostgreSQL usando pgvector.

### Fluxo

1. Criar módulo.
2. Adicionar arquivo de apoio.
3. Processar arquivo.
4. Gerar conteúdo com IA.
5. Revisar e salvar conteúdo.
6. Aluno acessa o conteúdo normalmente.

### Rodando com Docker

```bash
docker compose up -d
```

### Prisma

```bash
npx prisma migrate dev
npx prisma generate
```

### Variáveis de ambiente

```env
DATABASE_URL="postgresql://lumina:lumina@localhost:5432/lumina_lms?schema=public"
GEMINI_API_KEY=""
EMBEDDING_PROVIDER="gemini"
EMBEDDING_MODEL="text-embedding-004"
UPLOAD_DIR="./storage/uploads"
```
```

---

# 26. Pacotes sugeridos

Instalar apenas se necessário:

```bash
npm install pdf-parse
npm install @google/generative-ai
npm install zod
```

Se for usar cuid manual:

```bash
npm install @paralleldrive/cuid2
```

Se for usar upload helper:

```bash
npm install mime
```

Evitar instalar bibliotecas desnecessárias.

---

# 27. Ordem de execução recomendada

Executar nesta ordem:

## Etapa 1 — Infraestrutura

1. Atualizar Docker Compose para PostgreSQL com pgvector.
2. Subir banco.
3. Ajustar `.env`.
4. Validar conexão com Prisma.

## Etapa 2 — Banco

1. Habilitar extensão vector.
2. Criar models `ModuleSourceFile` e `ModuleSourceChunk`.
3. Relacionar com `Module`.
4. Rodar migration.
5. Criar índice vetorial.

## Etapa 3 — Serviços base

1. Criar `rag-types.ts`.
2. Criar `document-parser.ts`.
3. Criar `chunking-service.ts`.
4. Criar `embedding-service.ts`.
5. Criar `vector-store.ts`.

## Etapa 4 — Ingestão

1. Criar rota de upload.
2. Criar serviço de ingestão.
3. Criar rota de processamento.
4. Testar PDF.
5. Testar TXT.
6. Validar chunks no banco.

## Etapa 5 — Geração de conteúdo

1. Criar serviço `module-content-generation-service.ts`.
2. Reutilizar provider de IA existente.
3. Criar rota `generate-content-rag`.
4. Testar com título `O que é IPv6?`.

## Etapa 6 — Interface

1. Criar uploader.
2. Criar lista de arquivos.
3. Criar botão de geração com RAG.
4. Integrar na página de módulo do professor.
5. Exibir status e erros.

## Etapa 7 — Quiz

1. Garantir que o quiz continue lendo o conteúdo salvo.
2. Não alterar regra adaptativa neste MVP.
3. Criar service preparado para contexto RAG futuro.

## Etapa 8 — Documentação

1. Atualizar README.
2. Documentar Docker.
3. Documentar pgvector.
4. Documentar fluxo do professor.
5. Documentar limitações do MVP.

---

# 28. Critérios de aceite

A tarefa estará concluída quando:

- Docker subir PostgreSQL com pgvector.
- Prisma conseguir conectar no banco.
- A extensão `vector` estiver habilitada.
- O professor conseguir enviar PDF/TXT.
- O arquivo for salvo fora da pasta public.
- O arquivo aparecer listado no módulo.
- O professor conseguir processar o arquivo.
- O texto for extraído.
- Os chunks forem criados.
- Os embeddings forem gerados.
- Os vetores forem salvos no PostgreSQL com pgvector.
- A busca semântica retornar chunks relevantes.
- O professor conseguir gerar conteúdo pelo título do módulo.
- O conteúdo for salvo no módulo.
- O aluno conseguir visualizar o conteúdo.
- O quiz atual continuar funcionando.
- Erros forem tratados de forma amigável.
- README for atualizado.

---

# 29. Exemplo prático esperado

Entrada:

```txt
Título do módulo:
O que é IPv6?

Arquivo:
livro-de-ipv6.pdf
```

Processamento esperado:

```txt
1. Extrair texto do PDF.
2. Criar chunks sobre IPv6.
3. Gerar embeddings.
4. Salvar no pgvector.
5. Buscar chunks similares ao título "O que é IPv6?".
6. Gerar conteúdo didático com base nos chunks.
```

Saída esperada:

```md
# O que é IPv6?

## 1. Introdução

IPv6 é a versão mais recente do Protocolo de Internet...

## 2. Conceito principal

...

## 3. Exemplo prático

...

## 4. Erros comuns

...

## 5. Resumo final

...

## 6. Perguntas de revisão

...
```

---

# 30. Prompt interno recomendado para geração de conteúdo

Usar este prompt dentro do service de geração:

```txt
Você é um professor especialista em redes de computadores.

Sua tarefa é gerar um conteúdo didático para alunos do 2º semestre de um curso de redes.

Título do módulo:
{{moduleTitle}}

Descrição do módulo:
{{moduleDescription}}

Contexto extraído dos materiais enviados pelo professor:
{{retrievedContext}}

Regras:
1. Use o contexto fornecido como base principal.
2. Não invente informações fora do contexto.
3. Se o contexto for insuficiente, informe claramente.
4. Explique com linguagem simples e progressiva.
5. Use exemplos práticos.
6. Use analogias quando ajudar o aluno.
7. Estruture tudo em Markdown.
8. Evite linguagem excessivamente acadêmica.
9. Não cite páginas ou fontes se elas não estiverem disponíveis.
10. Gere um conteúdo pronto para ser estudado pelo aluno.

Estrutura obrigatória:

# {{moduleTitle}}

## 1. Introdução

## 2. Conceito principal

## 3. Explicação técnica

## 4. Exemplo prático

## 5. Erros comuns

## 6. Resumo final

## 7. Perguntas de revisão
```

---

# 31. Importante para o agente

Antes de implementar, faça uma análise real do projeto:

- leia o `schema.prisma`;
- leia as rotas atuais de módulos;
- leia os services atuais de IA;
- leia os componentes do painel professor;
- descubra o nome real do model de módulo;
- descubra como o conteúdo é salvo hoje;
- descubra como o quiz consome o conteúdo;
- só depois aplique as alterações.

Não assumir nomes de arquivos se eles já existirem com outro padrão.

Sempre adaptar ao padrão real do projeto.

---

# 32. Evoluções futuras

Não implementar agora, apenas deixar como possibilidade:

- suporte a DOCX;
- suporte a XLSX;
- upload para S3;
- MinIO local via Docker;
- Redis + BullMQ para processamento assíncrono;
- tela de visualização dos chunks;
- mostrar fontes usadas na geração;
- permitir professor escolher quais arquivos usar;
- gerar quiz diretamente dos chunks;
- gerar flashcards;
- gerar resumo;
- gerar mapa mental;
- reprocessamento automático quando arquivo for alterado;
- multi-tenant;
- controle de custo por geração;
- histórico de gerações.

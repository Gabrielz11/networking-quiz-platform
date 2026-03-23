# 🎓 Lumina LMS

O **Lumina LMS** é uma plataforma interativa web voltada para ensino, onde professores podem adicionar seus próprios conteúdos e criar quizzes sobre **qualquer matéria ou assunto**.

---

## 🛠 Features Principais

### Para o Aluno
* **Módulos Limpos**: Conteúdos redigidos pelo tutor lidos num ambiente acadêmico Markdown, com zero distração.
* **Simulados Guiados**: Uma questão na tela, barra de progresso simples.
* **Tutor de IA Integrado**: Ao errar uma alternativa, a ferramenta fornece uma explicação pedagógica personalizada via **Google Gemini** e gera um diagrama técnico explicativo via **DALL-E 3**.

### Para o Professor
* **Dashboard Autenticado**: Autenticação segura via **NextAuth v5**. CRUD completo de módulos e questões via Prisma.
* **Geração de Questões via IA**: O professor pode gerar automaticamente um banco de questões usando o Google Gemini.

## 🚀 Arquitetura e Stack
Este projeto utiliza as tecnologias mais modernas do ecossistema Web:

- **Framework**: `Next.js 16 (App Router)`
- **Linguagem**: `TypeScript`
- **Componentes**: `React 19` + `Tailwind CSS V4`
- **ORM**: `Prisma`
- **Banco de Dados**: `PostgreSQL` (Rodando via Docker)
- **Autenticação**: `NextAuth.js v5 (Auth.js)`
- **Engine IA (Texto)**: `Google Gemini 2.5 Flash`
- **Engine IA (Imagem)**: `OpenAI DALL-E 3`

---

## 💻 Configuração Local

### 1. Requisitos
- [Node.js](https://nodejs.org/) (versão 18+)
- [Docker](https://www.docker.com/) instalado
- Chaves de API: Google AI Studio (Gemini) e OpenAI.

### 2. Variáveis de Ambiente
Renomeie o arquivo `.env.example` para `.env` (ou `.env.local`) e preencha as seguintes chaves:
```env
# Banco de Dados (Docker Local)
DATABASE_URL="postgresql://admin:password123@localhost:5432/lumina_lms?schema=public"

# Autenticação (NextAuth)
AUTH_SECRET="seu_secret_aqui"

# IA
GEMINI_API_KEY="sua_chave_gemini"
OPENAI_API_KEY="sua_chave_openai"
```

### 3. Rodando os Serviços (Docker)
```bash
docker-compose up -d
```

### 4. Rodando o Projeto
```bash
# 1. Instalar dependências
npm install

# 2. Configurar o Banco de Dados (Prisma)
npx prisma generate
npx prisma db push

# 3. Iniciar em desenvolvimento
npm run dev
```
A plataforma estará acessível em `http://localhost:3000`.

---

## 🎨 Design Guideline
A aparência original obedece ao protocolo das Vercel/Linear vibes:
1. `Light Mode` primário como guia de contraste. Cor Primária: `#2563EB`.
2. Interação fluida, micro-interações minimalistas via `shadcn/ui`.
3. Foco total no conteúdo e redução de distrações.

> Open Source - 2026. Divirta-se quebrando código e ensinando Internet!

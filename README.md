# 🎓 Lumina LMS

O **Lumina LMS** é uma plataforma interativa web voltada para ensino, onde professores podem adicionar seus próprios conteúdos e criar quizzes adaptativos sobre **qualquer matéria ou assunto**. A plataforma evoluiu para integrar inteligência artificial avançada tanto na tutoria dos alunos quanto na geração de conteúdos.

---

## 🛠 Features Principais

### Para o Aluno
* **Módulos Limpos**: Conteúdos redigidos pelo tutor lidos num ambiente acadêmico Markdown, com zero distração. Componentes modulares garantem alta performance e foco total no aprendizado.
* **Sistema de Quiz Adaptativo (v3.0)**: Um motor de simulados inteligente que se adapta ao nível de proficiência do aluno. A progressão de dificuldade é dinâmica (ex: 1 acerto = sobe de nível, 2 erros = desce de nível). O quiz é finalizado de forma estruturada (ex: após 10 questões), preservando o estado de sessão de forma persistente.
* **Tutor de IA Integrado e Resiliente**: Ao errar uma alternativa, o sistema fornece uma explicação pedagógica robusta. Utiliza **Google Gemini** como motor principal e possui uma arquitetura de **fallback automático nativo para Groq**, assegurando alta disponibilidade ininterrupta. Adicionalmente, gera diagramas técnicos explicativos via **DALL-E 3**.

### Para o Professor
* **Dashboard Autenticado e Protegido**: Arquitetura segura via **NextAuth v5**, garantindo que as rotas administrativas sejam rigorosamente isoladas do acesso de alunos e visitantes.
* **Gestão e CRUD Completo**: Gerenciamento integrado de módulos acadêmicos e bancos de questões.
* **Geração de Questões via IA**: O professor pode gerar automaticamente um banco de questões em lotes estruturados, potencializado pelo Google Gemini.

---

## 🚀 Arquitetura e Stack

A fundação do projeto foi refatorada para maximizar a governança de código e a escalabilidade, adotando **Route Groups** para organizar a aplicação por domínio lógico de negócios, sem comprometer roteamento ou integrações.

- **Framework**: `Next.js 16 (App Router)`
- **Linguagem**: `TypeScript`
- **UI & Componentes**: `React 19` + `Tailwind CSS V4` + `shadcn/ui`
- **Banco de Dados Relacional**: `PostgreSQL` (Rodando via Docker)
- **ORM**: `Prisma`
- **Autenticação e Sessão**: `NextAuth.js v5 (Auth.js)`
- **Engine IA Principal**: `Google Gemini 2.5 Flash`
- **Engine IA de Fallback**: `Groq`
- **Engine IA Gráfica**: `OpenAI DALL-E 3`

---

## 📂 Visão Geral da Estrutura (Route Groups)

O projeto é particionado nos seguintes domínios:
- `app/(public)/`: Rotas abertas e páginas institucionais com ampla acessibilidade.
- `app/(admin)/`: Rotas estritamente protegidas contendo o painel de professores e gerenciamento sistêmico.
- `app/(student)/`: Ambiente focado no aprendizado do aluno, englobando acesso a módulos e simulados adaptativos.

---

## 💻 Configuração Local

### 1. Requisitos
- [Node.js](https://nodejs.org/) (versão 18+)
- [Docker](https://www.docker.com/) instalado
- Chaves de API das plataformas provedoras de inteligência e dados:
  - Google AI Studio (Gemini)
  - Groq (Sistema de Fallback)
  - OpenAI (Geração de Imagem)

### 2. Variáveis de Ambiente
Renomeie o arquivo `.env.example` para `.env` (ou `.env.local`) e defina rigorosamente as seguintes chaves requeridas:
```env
# Banco de Dados Relacional (Docker Local)
DATABASE_URL="postgresql://admin:password123@localhost:5432/lumina_lms?schema=public"

# Autenticação (NextAuth)
AUTH_SECRET="seu_secret_aqui_gerado"

# Inteligência Artificial e Modelos LLMs
GEMINI_API_KEY="sua_chave_gemini"
OPENAI_API_KEY="sua_chave_openai"
GROQ_API_KEY="sua_chave_groq"
```

### 3. Rodando os Serviços Auxiliares
```bash
docker-compose up -d
```

### 4. Rodando o Projeto
```bash
# 1. Instalação das dependências
npm install

# 2. Resolução de esquema e sincronização de dados
npx prisma generate
npx prisma db push

# 3. Iniciando ambiente de desenvolvimento
npm run dev
```
A plataforma estará acessível localmente escutando em `http://localhost:3000`.

---

## 🎨 Design Guideline
A aparência e experiência de usuário baseia-se num espectro minimalista utilitário, com uma assinatura de Vercel/Linear vibes:
1. `Light Mode` primário como guia central de contraste e usabilidade diurna. Foco na cor primária `#2563EB`.
2. Interações reativas hiper fluidas com foco em tipografia limpa.
3. Componentização visual desengatada de lógicas pesadas, garantindo baixo Time to Interactive.

> Open Source - 2026. Divirta-se quebrando código e ensinando Internet!

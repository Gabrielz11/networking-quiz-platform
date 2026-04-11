# 🎓 Lumina LMS (IPv6 Edition)

O **Lumina LMS** é uma plataforma educacional de última geração, projetada para transformar o ensino de redes de computadores com foco especial em **IPv6**. Através de uma interface minimalista e um motor de inteligência artificial resiliente, a plataforma oferece uma experiência de aprendizado adaptativa e personalizada.

---

## ✨ Diferenciais e Funcionalidades

### 👨‍🎓 Para o Aluno: Foco e Adaptação
*   **Ambiente Clean (v3.0)**: Experiência de leitura em Markdown otimizada para reduzir a fadiga cognitiva e aumentar o foco no conteúdo.
*   **Motor Adaptativo Inteligente**: O sistema ajusta a dificuldade das questões em tempo real com base no desempenho do aluno (ex: 1 acerto sobe o nível, 2 erros descem para reforçar a base).
*   **Tutor IA Resiliente**: Feedback pedagógico imediato após cada resposta, utilizando **Google Gemini** com redundância automática (**fallback**) para **Groq (Llama 3)**, garantindo 100% de disponibilidade.
*   **Persistência de Sessão**: Inicie um quiz e continue exatamente de onde parou, com o estado de dificuldade e progresso preservados.

### 👨‍🏫 Para o Professor: Gestão e Escala
*   **Dashboard Administrativo Premium**: Interface de alta performance com navegação fixa e área de trabalho independente para gestão de conteúdos.
*   **Segurança Avançada**: Acesso protegido via **NextAuth v5** com controle de rotas por domínios lógicos (Route Groups).
*   **Geração de Questões via IA**: Ferramentas integradas para gerar bancos de questões estruturados automaticamente a partir de tópicos específicos.
*   **Gestão de Módulos**: CRUD completo para criação e edição de módulos acadêmicos e bancos de questões.

---

## 🛠 Tech Stack & Arquitetura

A aplicação utiliza as tecnologias mais modernas do ecossistema Web para garantir escalabilidade, segurança e uma experiência de usuário fluida.

*   **Estrutura Principal**: `Next.js 16 (App Router)` + `React 19`
*   **Linguagem**: `TypeScript`
*   **Estilização**: `Tailwind CSS V4` + `shadcn/ui` + `Lucide Icons`
*   **Banco de Dados**: `PostgreSQL` via `Docker`
*   **Persistência (ORM)**: `Prisma ORM`
*   **Autenticação**: `NextAuth.js v5 (Auth.js)`
*   **Inteligência Artificial**:
    *   **Primária**: `Google Gemini 1.5/2.0 Flash`
    *   **Fallback**: `Groq (Llama 3 API)`
*   **UX/UI**: `Sonner` (Notificações) + `Zod` (Validação de Dados)

---

## 📂 Organização do Projeto (Route Groups)

O roteamento da aplicação é organizado por domínios de negócio para facilitar a manutenção e segurança:
- `app/(public)/`: Páginas institucionais e acesso aberto.
- `app/(admin)/`: Painel do professor e ferramentas de gestão (protegido por middleware).
- `app/(student)/`: Ecossistema de aprendizado, módulos e simulados adaptativos.

---

## 🚀 Configuração Local

### 1. Pré-requisitos
- **Node.js** (v18 ou superior)
- **Docker** & **Docker Compose**
- Chaves de API (Gemini e Groq)

### 2. Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto seguindo o modelo:

```env
# Database (PostgreSQL no Docker)
DATABASE_URL="postgresql://admin:password123@localhost:5432/lumina_lms?schema=public"

# Autenticação
AUTH_SECRET="sua_chave_secreta_aqui"

# Chave de Registro de Professores (Segurança)
TEACHER_REGISTRATION_KEY="chave_secreta_para_registro"

# AI Engines
GEMINI_API_KEY="sua_chave_gemini"
GROQ_API_KEY="sua_chave_groq"
```

### 3. Instalação e Execução

```bash
# Sobe o banco de dados
docker-compose up -d

# Instala as dependências
npm install

# Sincroniza o banco de dados
npx prisma generate
npx prisma db push

# Inicia o servidor de desenvolvimento
npm run dev
```

Acesse `http://localhost:3000` para começar!

---

## 🎨 Design System
O Lumina LMS segue uma estética utilitarista e moderna ("Linear/Vercel vibes"):
- **Contraste**: Foco no `Light Mode` primário com acentos em `#2563EB`.
- **Tipografia**: Uso de fontes modernas e legíveis para conteúdo acadêmico.
- **Feedback**: Micro-interações e transições suaves para uma sensação de aplicação nativa.

> Built with ☕ and Code by Gabrielz11 - 2026.


# 🎓 Documentação do Projeto: Lumina LMS (IPv6 Edition)

Este documento detalha o funcionamento, a arquitetura e os componentes do **Lumina LMS**, uma plataforma educacional interativa projetada para o ensino de redes de computadores, com foco especial em **IPv6**.

---

## 1. Visão Geral
O **Lumina LMS** é um Sistema de Gerenciamento de Aprendizagem (LMS) que prioriza a redução do ruído cognitivo. Ele permite que professores criem módulos de estudo em Markdown e quizzes interativos. O grande diferencial é o **Tutor IA Pedagógico**, que oferece explicações personalizadas e gera diagramas técnicos em tempo real quando um aluno erra uma questão.

---

## 2. Arquitetura do Sistema
O projeto segue uma arquitetura moderna de **Full-Stack Web App** utilizando o framework **Next.js 16**.

- **Frontend**: Desenvolvido com **React 19** e **Tailwind CSS V4**, utilizando o **App Router** do Next.js.
- **Backend (API)**: Implementado através de **Route Handlers** e **Server Actions**.
- **Banco de Dados**: Gerenciado via **Prisma ORM** conectando a um banco **PostgreSQL** rodando localmente em um contêiner **Docker**.
- **Autenticação**: Gerenciada pelo **NextAuth.js v5**, garantindo sessões seguras e proteção de rotas.
- **Motor de IA**: 
    - **Texto**: Google Gemini (API via `@google/generative-ai`).
    - **Imagens**: OpenAI DALL-E 3 (API via `openai`).

---

## 3. Funcionamento do Fluxo de Dados

### 3.1. Fluxo do Professor
1. O professor autentica-se via NextAuth.
2. Através do **Dashboard**, gerencia módulos e questões através de **Server Actions** com Prisma.
3. O professor pode usar a IA para **gerar automaticamente questões** baseadas no conteúdo do módulo.
4. Para cada questão, existe uma **"Explicação Base"**, que serve de guia para a IA nas correções.

### 3.2. Fluxo do Aluno
1. O aluno acessa os módulos e realiza os quizzes.
2. Ao errar uma questão, o sistema dispara uma chamada para a rota `/api/explain`.
3. A API combina o erro do aluno com a "Explicação Base" e envia ao **Gemini**, que gera um feedback pedagógico.
4. Paralelamente, o **DALL-E 3** gera um diagrama técnico para ilustrar o conceito correto.

---

## 4. Classes e Componentes Principais

### 4.1. Componentes de Interface (UI)
- **`QuizPage`**: Gerencia o estado do simulado e a interação com as APIs de IA.
- **`ModulesManager` & `QuestionsManager`**: Interfaces de CRUD para os professores gerenciarem o conteúdo via Prisma Server Actions.
- **`Auth Components`**: Telas de login e registro integradas ao NextAuth.

### 4.2. Módulos de Lógica e Serviços
- **`prisma.ts`**: Instância única do Prisma Client para comunicação com o PostgreSQL local.
- **`Explain API`**: Orquestra o prompt do Gemini e a geração de imagem com o DALL-E.
- **`Server Actions`**: Funções como `createModule`, `createQuestion`, etc., que executam lógica de banco diretamente no servidor.

---

## 5. Integração com IA

A plataforma utiliza **Prompt Engineering** para garantir a qualidade pedagógica:
- **System Instruction**: Define o Gemini como um professor especialista, calmo e encorajador.
- **RAG Simplificado**: A "Explicação Base" funciona como uma fonte de verdade para a IA, minimizando alucinações.
- **Multi-Modalidade**: Enquanto o Gemini cuida da parte textual, o DALL-E provê a parte visual, atacando diferentes estilos de aprendizagem.

---

## 6. Modelo de Dados e Segurança

O esquema do banco de dados (Prisma) é composto por:
- **User**: Gerenciamento de perfis (Teacher/Student).
- **Module**: Título, conteúdo (Markdown) e relacionamento com autor.
- **Question**: Enunciado, opções (JSON), resposta correta e base de explicação.
- **Attempt**: Registro de desempenho dos alunos.

**Segurança**: Middleware do NextAuth protege as rotas de dashboard, garantindo que apenas professores acessem funções administrativas. O PostgreSQL é executado localmente via Docker para garantir privacidade dos dados durante o desenvolvimento.

---

## 7. Design e Experiência do Usuário (UX)

- **Shadcn/UI**: Componentes consistentes e acessíveis.
- **Tailwind V4**: Estilização moderna e performática.
- **Foco Atencional**: Interface limpa, sem elementos que distraiam do objetivo educacional.

---

## 8. Conclusão
O **Lumina LMS** evoluiu para uma solução robusta utilizando Prisma e Docker, garantindo independência de serviços proprietários enquanto utiliza o que há de melhor em IA generativa (Gemini e DALL-E).

> **Status do Projeto**: Em desenvolvimento ativo (2026).

# 🎓 Documentação do Projeto: Lumina LMS (IPv6 Edition)

Este documento detalha o funcionamento, a arquitetura e os componentes do **Lumina LMS**, uma plataforma educacional interativa projetada para o ensino de redes de computadores, com foco especial em **IPv6**.

---

## 1. Visão Geral
O **Lumina LMS** é um Sistema de Gerenciamento de Aprendizagem (LMS) que prioriza a redução do ruído cognitivo. Ele permite que professores criem módulos de estudo em Markdown e quizzes interativos. O grande diferencial é o **Tutor IA Pedagógico**, que oferece explicações personalizadas e gera diagramas técnicos em tempo real quando um aluno erra uma questão.

### Diferenciais:
- **Metodologia "Uma-Pergunta-por-Vez"**: Foco total na tarefa atual.
- **Feedback Construtivo**: A IA não apenas indica o erro, mas explica a lógica por trás da alternativa correta com base nas diretrizes do professor.
- **Visualização Técnica**: Geração de imagens explicativas (DALL-E) para conceitos complexos.

---

## 2. Arquitetura do Sistema
O projeto segue uma arquitetura moderna de **Full-Stack Web App** utilizando o framework **Next.js**.

- **Frontend**: Desenvolvido com **React** e **Tailwind CSS**, utilizando o **App Router** do Next.js para roteamento e renderização híbrida (SSR/CSR).
- **Backend (API)**: Implementado através de **Route Handlers** (Serverless Functions) do Next.js.
- **Banco de Dados & Autenticação**: Utiliza o **Supabase** como BaaS (Backend as a Service), gerenciando persistência de dados e segurança (RLS - Row Level Security).
- **Motor de IA**: Integração direta com a API da **OpenAI** (GPT-4o-mini e DALL-E-3) para processamento de linguagem natural e geração de imagens.

---

## 3. Funcionamento do Fluxo de Dados

### 3.1. Fluxo do Professor
1. O professor autentica-se no sistema.
2. Através do **Dashboard**, cria módulos de ensino (conteúdo teórico).
3. Para cada módulo, cadastra questões de múltipla escolha.
4. O professor define uma **"Explicação Base"** para cada questão. Esse texto serve de "âncora" para a IA, evitando alucinações.

### 3.2. Fluxo do Aluno
1. O aluno acessa um módulo e estuda o conteúdo.
2. Inicia o quiz vinculado ao módulo.
3. Ao responder uma questão:
   - Se **Correta**: O sistema avança para a próxima.
   - Se **Incorreta**: O sistema faz uma requisição para a API de Explicação, enviando o enunciado, a resposta do aluno, a resposta correta e a explicação base do professor.

---

## 4. Classes e Componentes Principais

Como o projeto utiliza **React** funcional, as "classes" são representadas por componentes de alto nível e módulos de serviço.

### 4.1. Componentes de Interface (UI)
- **`QuizPage` (`src/app/quiz/[id]/page.tsx`)**: Classe/Componente principal que gerencia o estado do quiz (pergunta atual, pontuação, lógica de navegação e integração com a API de IA).
- **`Dashboard` (`src/app/dashboard/page.tsx`)**: Ponto central para gestão de conteúdo pelo professor.
- **`AuthForm`**: Gerencia o login e cadastro via Supabase Auth.
- **Componentes Shadcn/UI**: Utilizados para garantir uma interface premium e acessível (Buttons, Cards, Progress Bars, Accordions).

### 4.2. Módulos de Lógica e Serviços
- **`supabase.ts` (`src/lib/supabase.ts`)**: Singleton que inicializa e exporta o cliente Supabase, permitindo operações de CRUD no banco de dados.
- **`Explain API` (`src/app/api/explain/route.ts`)**: Controlador backend que encapsula a inteligência do sistema. Ele formata o *System Prompt* para a OpenAI, garantindo que a resposta tenha um tom pedagógico e profissional.

---

## 5. Integração com IA (O Cérebro do Projeto)

A plataforma utiliza um modelo de **Prompt Engineering** sofisticado:

- **System Prompt**: Define a identidade da IA como um "Professor de Redes especialista em IPv6".
- **Context Injection**: O sistema injeta a "Explicação Base" do professor no prompt, garantindo que a IA não invente informações e siga a linha pedagógica do tutor humano.
- **DALL-E Integration**: Se o aluno errar, a IA gera um prompt para criação de um diagrama técnico que ilustre o conceito da resposta correta, tornando o aprendizado visual.

---

## 6. Modelo de Dados e Segurança (Supabase)

O esquema do banco de dados (SQL) é composto por:
- **Tabela `modules`**: Armazena título, descrição e conteúdo (Markdown).
- **Tabela `questions`**: Armazena o enunciado, opções (array), índice da resposta correta e a explicação base.
- **Segurança (RLS)**: O sistema utiliza **Row Level Security** (Segurança ao Nível de Linha). Isso garante que apenas usuários autenticados (professores) possam criar ou editar conteúdos, enquanto alunos (ou usuários anônimos, dependendo da configuração) apenas realizam a leitura dos módulos e quizzes.

---

## 7. Design e Experiência do Usuário (UX)

A plataforma foi construída seguindo princípios modernos de design:
- **Design Responsivo**: Totalmente adaptável a dispositivos móveis, tablets e desktops.
- **Micro-interações**: Feedback visual imediato ao selecionar opções, carregar resultados e interagir com a IA.
- **Shadcn/UI & Lucide Icons**: Biblioteca de componentes de classe mundial que garante consistência visual e acessibilidade (A11y).

---

## 8. Conclusão
O **Lumina LMS** não é apenas um portal de questões, mas uma ferramenta de auxílio ao professor. Ele escala a capacidade de dar feedback individualizado, garantindo que nenhum aluno saia de uma questão sem entender o porquê de seu erro, tudo isso em um ambiente moderno, rápido e focado.

> **Desenvolvido por**: [Seu Nome/GitHub]  
> **Instituição**: [Nome da sua Instituição]  
> **Ano**: 2026

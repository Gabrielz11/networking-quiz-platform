# 🎓 Documentação do Projeto: Lumina LMS (IPv6 Edition)

Este documento detalha o funcionamento, a arquitetura e os componentes do **Lumina LMS**, uma plataforma educacional interativa projetada para o ensino de redes de computadores, com foco especial em **IPv6**.

---

## 1. Visão Geral
O **Lumina LMS** evoluiu para um ecossistema de aprendizado adaptativo que prioriza a redução do ruído cognitivo. Ele permite que professores criem módulos de estudo e que alunos passem por trilhas personalizadas baseadas em desempenho em tempo real. O diferencial é o **Motor Adaptativo v3.0**, que ajusta a dificuldade das questões dinamicamente com base em inteligência artificial.

---

## 2. Arquitetura do Sistema
O projeto utiliza um stack **Full-Stack Cutting-Edge** com foco em performance, tipagem rigorosa e arquitetura de serviços modular.

- **Frontend**: **Next.js (App Router)** com **React**.
- **Estilização**: **Tailwind CSS V4** para um design ultra-moderno e performático.
- **Backend**: Server Actions e Route Handlers tipados com **Zod**.
- **Banco de Dados**: **PostgreSQL** via **Prisma ORM**, hospedado em infraestrutura Docker.
- **Autenticação**: **NextAuth.js v5 (Beta)** com suporte a Roles (Admin/Teacher/Student).
- **Notificações**: **Sonner** para feedback de interface premium.

### 2.1. Arquitetura de Serviços Modulares
O backend foi refatorado para garantir forte separação de responsabilidades (Separation of Concerns):
- **Serviços de Analytics (`src/services/analytics/`)**: Isolamento completo de queries analíticas e de dashboard (ex: `analytics-query.service.ts`, `dashboard-query.service.ts`), garantindo que consultas complexas ao banco não interfiram com a lógica de negócio principal.
- **Serviços de Geração com IA (`src/services/generation/`)**: Centralização da lógica de IA generativa (ver Seção 3).
- **Serviço de Progressão (`quiz-progression.service.ts`)**: Gerencia o estado e a progressão de dificuldade do aluno no quiz, separando a lógica de negócio do quiz da geração de conteúdo em si.

---

## 3. Motor de Inteligência Artificial e Geração (Generation Services)
O sistema implementa uma camada de abstração para IA estruturada de forma altamente coesa em `src/services/generation/`:

- **Modularidade de Geração**:
  - `explanation-generation.service.ts`: Responsável exclusivamente pela pedagogia e feedback em streaming (Tutor Socrático).
  - `quiz-question-generation.service.ts`: Focado na geração dinâmica e adaptativa de questões únicas em tempo real.
  - `batch-quiz-generation.service.ts`: Focado na geração otimizada de múltiplas questões em lote (para criação de módulos).
- **Desacoplamento Técnico**: Prompts (`/prompts`), schemas de validação Zod (`/schemas`) e utilitários puros como truncamento e embaralhamento seguro (`/utils`) foram extraídos dos serviços principais, aumentando drasticamente a testabilidade e reusabilidade.
- **Alta Disponibilidade (Fallback)**:
  - **Provedor Primário**: **Google Gemini 1.5/2.0** (Texto e Raciocínio Pedagógico).
  - **Fallback (Redundância)**: **Groq (Llama 3)** para garantir resiliência em caso de falhas de cota ou rate limits do Gemini.

---

## 4. O Ciclo Adaptativo (v3.0)
Diferente de quizzes lineares, o Lumina LMS utiliza lógica de progressão baseada em proficiência:

1.  **Dificuldade Dinâmica**: As questões são classificadas em `EASY`, `MEDIUM` e `HARD`.
2.  **Regra de Progressão**:
    *   **Acertou 1 questão**: O sistema sobe o nível de dificuldade (ex: Easy -> Medium).
    *   **Errou 2 questões no mesmo nível**: O sistema desce o nível de dificuldade (ex: Hard -> Medium) para reforçar a base.
3.  **Persistência e Concorrência**: Cada quiz (limite de 10 questões) gera uma `QuizSession`. O sistema utiliza um mecanismo de idempotência (lock/liberação via Redis ou estado) nas respostas para evitar problemas de concorrência ou processamento duplicado.

---

## 5. Fluxos de Trabalho e Segurança

### 5.1. Segurança e Validação
- **Zod Enforcement**: Todas as entradas de API são validadas via Zod, prevenindo injeções e dados malformados.
- **Teacher Gatekeeper**: O registro de professores exige uma `TEACHER_REGISTRATION_KEY` configurada em variáveis de ambiente.

### 5.2. Gestão de Conteúdo (Teacher)
- **Dashboard Multimodal**: Dashboards com viewport fixo (Navbar e Sidebar estáticas e conteúdo scrollável).
- **CRUD com Server Actions**: Manipulação instantânea de módulos e questões com feedback visual via `sonner`.

---

## 6. Modelo de Dados e Métricas

O banco de dados foi otimizado para rastrear o crescimento do aluno:
- **`User`**: Perfis com senhas hasheadas via `bcrypt`.
- **`QuizSession`**: Armazena o estado atual, score acumulado e nível de dificuldade presente.
- **`QuestionInstance`**: Um snapshot único de cada questão apresentada, salvando a resposta do aluno e a explicação gerada pela IA para consulta histórica.

---

## 7. Design e Experiência do Usuário (UX)
- **Aesthetics First**: Uso de cores harmônicas (HSL), glassmorphism e micro-animações.
- **Foco Atencional**: Interface de quiz limpa, centrada na questão, eliminando distrações laterais.
- **Feedback Imediato**: O aluno recebe instantaneamente a validação da resposta e feedback estruturado do tutor IA.

---

## 8. Conclusão
O **Lumina LMS** evoluiu de um portal de conteúdo para uma plataforma adaptativa modularizada. Com a adoção de uma arquitetura de serviços limpa e IA multi-provedor isolada em subdomínios (Analytics, Generation, Progression), o sistema está pronto para escalar mantendo a robustez técnica e qualidade pedagógica.

> **Versão Atual**: 3.5 (Arquitetura Modular)
> **Data de Atualização**: Maio de 2026

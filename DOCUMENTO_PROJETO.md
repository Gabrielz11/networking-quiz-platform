# 🎓 Documentação do Projeto: Lumina LMS (IPv6 Edition)

Este documento detalha o funcionamento, a arquitetura e os componentes do **Lumina LMS**, uma plataforma educacional interativa projetada para o ensino de redes de computadores, com foco especial em **IPv6**.

---

## 1. Visão Geral
O **Lumina LMS** evoluiu para um ecossistema de aprendizado adaptativo que prioriza a redução do ruído cognitivo. Ele permite que professores criem módulos de estudo e que alunos passem por trilhas personalizadas baseadas em desempenho em tempo real. O diferencial é o **Motor Adaptativo v3.0**, que ajusta a dificuldade das questões dinamicamente.

---

## 2. Arquitetura do Sistema
O projeto utiliza um stack **Full-Stack Cutting-Edge** com foco em performance e tipagem rigorosa.

- **Frontend**: **Next.js 16 (App Router)** com **React 19**.
- **Estilização**: **Tailwind CSS V4** para um design ultra-moderno e performático.
- **Backend**: Server Actions e Route Handlers tipados com **Zod**.
- **Banco de Dados**: **PostgreSQL** via **Prisma ORM**, hospedado em infraestrutura Docker.
- **Autenticação**: **NextAuth.js v5 (Beta)** com suporte a Roles (Admin/Teacher/Student).
- **Notificações**: **Sonner** para feedback de interface premium.

---

## 3. Motor de Inteligência Artificial e Redundância
O sistema implementa uma camada de abstração para IA que garante alta disponibilidade e resiliência:

- **Provedor Primário**: **Google Gemini 1.5/2.0** (Texto e Raciocínio Pedagógico).
- **Fallback (Redundância)**: **Groq (Llama 3)** para garantir que o sistema continue gerando feedbacks mesmo em falhas de cota do Gemini.
- **Prompt Engineering**: System instructions que forçam a IA a agir como um tutor socrático, encorajando o erro como parte do aprendizado.

---

## 4. O Ciclo Adaptativo (v3.0)
Diferente de quizzes lineares, o Lumina LMS utiliza lógica de progressão baseada em proficiência:

1.  **Dificuldade Dinâmica**: As questões são classificadas em `EASY`, `MEDIUM` e `HARD`.
2.  **Regra de Progressão**:
    *   **Acertou 1 questão**: O sistema sobe o nível de dificuldade (ex: Easy -> Medium).
    *   **Errou 2 questões no mesmo nível**: O sistema desce o nível de dificuldade (ex: Hard -> Medium) para reforçar a base.
3.  **Persistência de Sessão**: Cada quiz (limite de 10 questões) gera uma `QuizSession` que permite ao aluno parar e continuar de onde parou sem perder o progresso ou o nível de dificuldade alcançado.

---

## 5. Fluxos de Trabalho e Segurança

### 5.1. Segurança e Validação
- **Zod Enforcement**: Todas as entradas de API (Registro, Login, Respostas, Criação de Módulos) são validadas via Zod, prevenindo injeções e dados malformados.
- **Teacher Gatekeeper**: O registro de professores exige uma `TEACHER_REGISTRATION_KEY` configurada em variáveis de ambiente, impedindo que usuários comuns acessem o dashboard administrativo.

### 5.2. Gestão de Conteúdo (Teacher)
- **Dashboard Multimodal**: Dashboards com viewport fixo (Navbar e Sidebar estáticas e conteúdo scrollável) para experiência de aplicação desktop.
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
- **Feedback Imediato**: O aluno sabe instantaneamente se acertou, recebendo o tutor IA e o diagrama visual em frações de segundo.

---

## 8. Conclusão
O **Lumina LMS** não é apenas um portal de conteúdo; é um professor particular de IPv6 que se adapta à velocidade do aluno. Com a integração de Prisma, Next.js e IA multi-provedor (Gemini/Groq), o sistema está pronto para produção com escalabilidade e robustez.

> **Versão Atual**: 3.0 (Alpha Experimental)
> **Data de Atualização**: Abril de 2026


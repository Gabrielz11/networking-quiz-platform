# Project Lumina LMS 3.0: Adaptative Adaptive IPv6 Quiz

## 1. Visão Geral
O Lumina LMS 3.0 migra de um modelo de quizes estáticos e pré-gerados para um sistema de **Aprendizado Adaptativo**. As questões serão geradas sob demanda pela IA (Gemini), ajustando o nível de dificuldade (EASY, MEDIUM, HARD) conforme o desempenho imediato do aluno.

## 2. Personas e Fluxo do Usuário
- **Aluno:** 
    1. Acessa a página do módulo.
    2. Clica em "Iniciar Quiz".
    3. Responde uma questão por vez.
    4. Recebe feedback imediato da IA após cada resposta.
    5. Finaliza o quiz após 10 questões e recebe uma nota baseada em acertos.
    6. Se o aluno sair do navegador, a sessão de quiz é mantida para que ele retome de onde parou.

- **Professor:** 
    1. Não precisa mais gerar quizes manualmente na área administrativa. O conteúdo do módulo serve como base única para a IA gerar questões adaptativas em tempo real.

## 3. Lógica de Adaptabilidade (Algoritmo v3.0)
O quiz consiste em exatamente **10 questões**.

### Níveis de Dificuldade:
- `EASY` (Inicial)
- `MEDIUM`
- `HARD`

### Regras de Progressão:
1. **Acerto:** Sobe de nível imediatamente (se estiver em EASY vai para MEDIUM, se MEDIUM vai para HARD).
2. **Erro:**
    - Primeira vez no nível: Mantém o nível atual.
    - Segunda vez seguida de erro no mesmo nível: Cai para o nível anterior (se estiver em MEDIUM volta para EASY).
    - Se estiver em EASY e errar repetidamente: Permanece em EASY.

### Exemplo de Fluxo:
- Q1: EASY -> Acertou -> Próxima: MEDIUM
- Q2: MEDIUM -> Errou -> Próxima: MEDIUM (Mantém 1x)
- Q3: MEDIUM -> Errou -> Próxima: EASY (Caiu)
- Q4: EASY -> Acertou -> Próxima: MEDIUM

## 4. Sistema de Notas
- **Fórmula:** Simples (Linear).
- **Valor:** 1 ponto por acerto, independente da dificuldade.
- **Máximo:** 10 pontos.

## 5. Requisitos de Persistência (Banco de Dados)
Precisaremos ajustar o `schema.prisma` para suportar sessões de quiz e instâncias de questões:

- `QuizSession`: Armazena o progresso do aluno em um módulo (index da questão atual, nível atual, erros seguidos no nível, status "em andamento" ou "finalizado").
- `QuestionInstance`: Armazena a questão específica gerada pela IA para aquela sessão, a resposta do aluno e se ele acertou.

## 6. Integração com IA (Arquitetura Técnica)
- A geração será "Lazy" (Uma por vez).
- O prompt da IA será contextualizado com:
    1. O conteúdo do módulo.
    2. O nível de dificuldade alvo.
    3. Questões anteriores para evitar repetição.

## 7. Experiência do Usuário (UI/UX)
- Botão "Iniciar Quiz" na página do módulo.
- Tela de Quiz com progresso (ex: "Questão 4 de 10").
- Loading visual entre questões (IA generation state).
- Feedback visual de correto/errado com explicação curta da IA.
- Tela final com resumo de performance e nota.

## 8. Resumo da Estrutura de Mudança
| Recurso | Antigo (v2.0) | Novo (v3.0) |
| :--- | :--- | :--- |
| **Geração** | Batch (3-10 questões de uma vez) | On-demand (1 por vez) |
| **Dificuldade** | Aleatória/Fixa | Adaptativa (EASY -> MEDIUM -> HARD) |
| **Local de Geração** | Painel do Professor | Clique do Aluno (Início do Quiz) |
| **Resiliência** | Perdia o progresso se fechasse | Retoma do ponto exato (Persistence) |
| **Nota** | Calculada no final | Calculada ponto a ponto |

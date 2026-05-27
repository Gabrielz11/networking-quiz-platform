/**
 * Tipos e interfaces do sistema de avaliação pedagógica (Critic Loop).
 */

/**
 * As 7 métricas de qualidade do conteúdo gerado pela IA.
 * Cada pilar é avaliado de 0.0 (ausente) a 1.0 (excelente).
 */
export interface CriticMetrics {
    /** Nível de aprofundamento técnico — vai além do óbvio, explica "porquê" e "como". */
    depth: number;
    /** Clareza didática e uso correto de formatação Markdown. */
    clarity: number;
    /** Alinhamento com o material de base — ausência de alucinações ou invenções. */
    fidelity: number;
    /** Foco em aprendizagem ativa, feedbacks explicativos úteis. */
    pedagogy: number;
    /** Presença de código, tabelas, diagramas e comandos reais. */
    technicalDensity: number;
    /**
     * Grau de ambiguidade do conteúdo (0 = sem ambiguidade, 1 = muito ambíguo).
     * ATENÇÃO: Este pilar é INVERTIDO no cálculo — penaliza conteúdo ambíguo.
     */
    ambiguity: number;
    /** Calibração do nível de dificuldade em relação ao alvo solicitado. */
    difficulty: number;
}

/**
 * Relatório gerado pelo CriticService após avaliação de um conteúdo.
 */
export interface CriticReport {
    /** Pontuação geral ponderada (0.0 a 1.0). Threshold de aprovação: >= 0.85 */
    qualityScore: number;
    /** Indica se o conteúdo passou no threshold de qualidade. */
    approved: boolean;
    /** Pontuação detalhada por pilar. */
    metrics: CriticMetrics;
    /** Feedback textual para orientar a regeneração quando reprovado. */
    feedback: string;
}

/**
 * Opções de configuração para o AIOrchestrator.
 */
export interface OrchestratorOptions {
    /** Identificador do pipeline (ex: CONTENT_GEN, QUIZ_GEN, EXPLANATION). */
    pipeline: string;
    /** Ativa o Critic Loop para avaliação pedagógica do conteúdo gerado. */
    useCritic?: boolean;
    /** Número máximo de retentativas caso o critic reprovar. Default: 2. */
    maxRetries?: number;
    /** ID do módulo associado à geração (para metadados). */
    moduleId?: string;
    /** ID da sessão de quiz associada (para metadados). */
    sessionId?: string;
    /** Chunks do RAG utilizados como contexto (para metadados). */
    retrievedChunks?: any;
    /** Modelo primário de IA (sobrescreve a variável de ambiente). */
    modelName?: string;
    /** Modelo de fallback (Groq/DeepSeek) se o primário falhar. */
    fallbackModelName?: string;
    /** Temperatura do modelo primário. */
    temperature?: number;
    /** Timeout em ms para a chamada ao modelo primário. */
    timeoutMs?: number;
    /** Schema de validação de resposta JSON do Gemini. */
    responseSchema?: any;
    /** Instrução de sistema para o modelo primário. */
    systemInstruction?: string;
    /**
     * Se true, ignora o Semantic Cache (lookup e store).
     * Útil para regeneração forçada e testes.
     */
    skipCache?: boolean;
}

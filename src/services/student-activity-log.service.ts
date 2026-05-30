import fs from "fs/promises";
import path from "path";
import { Logger } from "@/lib/logger";

const logger = new Logger("StudentActivityLogService");
const LOG_DIR = path.join(process.cwd(), "storage", "logs");
const LOG_FILE_PATH = path.join(LOG_DIR, "sentimento.log");

export interface LogParams {
  studentId: string;
  eventType: "QUIZ_ANSWERED" | "AI_EXPLANATION_REQUESTED" | "STUDENT_FEEDBACK" | "STUDENT_QUESTION";
  textContent?: string;
  metadata?: Record<string, any>;
}

export class StudentActivityLogService {
  /**
   * Registra um evento de comportamento no arquivo de log sentimento.log de forma assíncrona.
   */
  static logEvent(params: LogParams): void {
    const { studentId, eventType, textContent, metadata = {} } = params;

    const logEntry = {
      student_id: studentId,
      event_type: eventType,
      text_content: textContent && textContent.trim().length > 0 ? textContent : null,
      metadata,
      created_at: new Date().toISOString(),
    };

    // Gravação em background não-bloqueante para garantir performance máxima
    (async () => {
      try {
        await fs.mkdir(LOG_DIR, { recursive: true });
        const logLine = JSON.stringify(logEntry) + "\n";
        await fs.appendFile(LOG_FILE_PATH, logLine, "utf-8");
      } catch (error) {
        logger.error("logEvent", "Falha ao gravar arquivo sentimento.log", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }

  /**
   * Registra um evento de solicitação de explicação por IA de forma encapsulada.
   */
  static logAiExplanationRequested(params: {
    studentId: string;
    sessionId: string;
    questionId: string;
    moduleId: string;
    studentAnswer: string;
    questionPrompt: string;
    isCorrect: boolean;
  }): void {
    this.logEvent({
      studentId: params.studentId,
      eventType: "AI_EXPLANATION_REQUESTED",
      textContent: `Questão: ${params.questionPrompt}\nResposta do Aluno: ${params.studentAnswer}\nCorreta: ${params.isCorrect ? "Sim" : "Não"}`,
      metadata: {
        sessionId: params.sessionId,
        questionId: params.questionId,
        moduleId: params.moduleId,
        isCorrect: params.isCorrect,
        studentAnswer: params.studentAnswer,
      },
    });
  }
}

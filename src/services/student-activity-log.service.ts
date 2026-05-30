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
}

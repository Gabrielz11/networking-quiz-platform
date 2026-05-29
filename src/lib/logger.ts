type LogLevel = "info" | "warn" | "error";

interface LogPayload {
    service: string;
    method: string;
    provider?: string;
    message: string;
    durationMs?: number;
    [key: string]: unknown;
}

/**
 * Logger estruturado leve para a camada de serviços.
 * Em produção, emite JSON para facilitar integração com ferramentas de log.
 * Em desenvolvimento, emite formato legível.
 */
export class Logger {
    private service: string;

    constructor(service: string) {
        this.service = service;
    }

    info(method: string, message: string, extra?: Record<string, unknown>) {
        this.log("info", { service: this.service, method, message, ...extra });
    }

    warn(method: string, message: string, extra?: Record<string, unknown>) {
        this.log("warn", { service: this.service, method, message, ...extra });
    }

    error(method: string, message: string, extra?: Record<string, unknown>) {
        this.log("error", { service: this.service, method, message, ...extra });
    }

    private log(level: LogLevel, payload: LogPayload) {
        const timestamp = new Date().toISOString();
        const isProduction = process.env.NODE_ENV === "production";

        if (isProduction) {
            // JSON estruturado para produção
            const entry = { timestamp, level, ...payload };
            console[level](JSON.stringify(entry));
        } else {
            // Formato legível para desenvolvimento
            const prefix = `[${timestamp}] [${level.toUpperCase()}] [${payload.service}.${payload.method}]`;
            const provider = payload.provider ? ` (${payload.provider})` : "";
            const duration = payload.durationMs !== undefined ? ` [${payload.durationMs}ms]` : "";
            console[level](`${prefix}${provider}${duration} ${payload.message}`);
        }

        // Gravação em arquivo de log na raiz se for de serviço relevante (módulos, RAG, workers, vector-store)
        const isRelevant =
            payload.service.includes("Module") ||
            payload.service.includes("Rag") ||
            payload.service.includes("Worker") ||
            payload.service.includes("Vector") ||
            payload.service === "LlmRouter" ||
            payload.service === "AdminModulesActions";

        if (isRelevant) {
            try {
                // Utilizando require dinâmico para não quebrar bundlers do Next.js no build do cliente
                const fs = require("fs");
                const path = require("path");
                const logPath = path.join(process.cwd(), "created-modules.log");
                
                const formattedTime = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
                const { service: _s, method: _m, message: _msg, ...extraData } = payload;

                const extraStr = Object.keys(extraData).length > 0 ? ` | Meta: ${JSON.stringify(extraData)}` : "";
                const entry = `[${formattedTime}] [${level.toUpperCase()}] [${payload.service}.${payload.method}] ${payload.message}${extraStr}\n`;
                
                fs.appendFileSync(logPath, entry, "utf8");
            } catch (err) {
                // Silenciosamente ignora erros de escrita do arquivo em produção
            }
        }
    }
}

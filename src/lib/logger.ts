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
    }
}

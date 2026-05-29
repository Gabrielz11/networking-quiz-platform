import { writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "crypto";
import { Logger } from "./logger";
import { env } from "./env";

const logger = new Logger("StorageService");

export class StorageService {
    private static getUploadBase() {
        // P2.4 — usa env validado, não process.env direto
        return env.UPLOAD_DIR;
    }

    /**
     * Salva um arquivo no sistema de arquivos.
     * P3.1 — Nome gerado com randomUUID para evitar colisão entre uploads simultâneos.
     * P3.1 — Valida magic bytes do PDF para rejeitar MIME falsificado pelo cliente.
     */
    static async saveFile(moduleId: string, file: File): Promise<{ storagePath: string; fileName: string }> {
        const uploadBase = this.getUploadBase();
        const uploadDir = join(process.cwd(), uploadBase, "modules", moduleId);

        await mkdir(uploadDir, { recursive: true });

        const extension = file.type === "application/pdf" ? ".pdf" : ".txt";
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // P3.1 — Validação de magic bytes: rejeita PDF com cabeçalho falsificado
        if (extension === ".pdf") {
            const magic = buffer.subarray(0, 4).toString("ascii");
            if (!magic.startsWith("%PDF")) {
                throw new Error("Arquivo inválido: cabeçalho PDF não encontrado.");
            }
        }

        // P3.1 — UUID garante unicidade mesmo com uploads simultâneos no mesmo módulo
        const fileName = `${randomUUID()}${extension}`;
        const storagePath = join(uploadDir, fileName);

        await writeFile(storagePath, buffer);

        logger.info("saveFile", `Arquivo salvo: ${fileName}`, { moduleId });

        return { storagePath, fileName };
    }

    /**
     * Remove um arquivo físico.
     */
    static async deleteFile(storagePath: string): Promise<void> {
        try {
            await unlink(storagePath);
            logger.info("deleteFile", `Arquivo removido: ${storagePath}`);
        } catch {
            logger.warn("deleteFile", `Falha ao remover arquivo: ${storagePath}`);
        }
    }
}

import { writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Logger } from "./logger";

const logger = new Logger("StorageService");

export class StorageService {
    private static getUploadBase() {
        return process.env.UPLOAD_DIR ?? "./storage/uploads";
    }

    /**
     * Salva um arquivo no sistema de arquivos.
     */
    static async saveFile(moduleId: string, file: File): Promise<{ storagePath: string; fileName: string }> {
        const uploadBase = this.getUploadBase();
        const uploadDir = join(process.cwd(), uploadBase, "modules", moduleId);
        
        await mkdir(uploadDir, { recursive: true });

        const timestamp = Date.now();
        const extension = file.type === "application/pdf" ? ".pdf" : ".txt";
        const fileName = `${timestamp}${extension}`;
        const storagePath = join(uploadDir, fileName);

        const arrayBuffer = await file.arrayBuffer();
        await writeFile(storagePath, Buffer.from(arrayBuffer));

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
        } catch (error) {
            logger.warn("deleteFile", `Falha ao remover arquivo: ${storagePath}`);
        }
    }
}

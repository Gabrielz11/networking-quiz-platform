import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export class FileRepository {
    async findByModuleId(moduleId: string) {
        return prisma.moduleSourceFile.findMany({
            where: { moduleId },
            orderBy: { createdAt: "desc" },
        });
    }

    async findById(id: string) {
        return prisma.moduleSourceFile.findUnique({
            where: { id },
        });
    }

    async create(data: Prisma.ModuleSourceFileCreateInput) {
        return prisma.moduleSourceFile.create({ data });
    }

    async updateStatus(id: string, status: "UPLOADED" | "PROCESSING" | "PROCESSED" | "FAILED", errorMessage?: string) {
        return prisma.moduleSourceFile.update({
            where: { id },
            data: { 
                status,
                errorMessage: errorMessage ?? null
            },
        });
    }

    async delete(id: string) {
        return prisma.moduleSourceFile.delete({
            where: { id },
        });
    }

    async getFilesWithPathsByModule(moduleId: string) {
        return prisma.moduleSourceFile.findMany({
            where: { moduleId },
            select: { storagePath: true }
        });
    }
}

export const fileRepository = new FileRepository();

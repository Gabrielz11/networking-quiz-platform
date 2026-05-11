import { prisma } from "@/lib/prisma";
import { Module, Prisma } from "@prisma/client";

export class ModuleRepository {
    async findAll() {
        return prisma.module.findMany({
            orderBy: { createdAt: "desc" },
        });
    }

    async findById(id: string) {
        return prisma.module.findUnique({
            where: { id },
            include: {
                author: {
                    select: { name: true }
                }
            }
        });
    }

    async create(data: Prisma.ModuleCreateInput) {
        return prisma.module.create({ data });
    }

    async update(id: string, data: Prisma.ModuleUpdateInput) {
        return prisma.module.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        return prisma.module.delete({
            where: { id },
        });
    }

    async findWithSources(id: string) {
        return prisma.module.findUnique({
            where: { id },
            include: {
                sources: true
            }
        });
    }
}

export const moduleRepository = new ModuleRepository();

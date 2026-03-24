"use server";

import { prisma } from "@/lib/prisma";

export async function getQuizQuestions(moduleId: string) {
    return await prisma.question.findMany({
        where: { moduleId },
        orderBy: { createdAt: "asc" }
    });
}

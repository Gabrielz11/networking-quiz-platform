"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { Logger } from "@/lib/logger";

const logger = new Logger("AdminModulesActions");

import { computeContentHash } from "@/lib/rag/eval/hash.utils";

export async function getModules() {
  return await prisma.module.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      evaluations: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function createModule(data: { title: string; content: string; description?: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const author = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });

  if (!author) {
    throw new Error("Sua sessão expirou ou o usuário não existe mais no banco de dados. Por favor, faça login novamente.");
  }

  const module = await prisma.module.create({
    data: {
      title: data.title,
      content: data.content,
      description: data.description,
      authorId: session.user.id,
    },
  });

  logger.info("createModule", "Novo módulo criado com sucesso pelo professor", {
    moduleId: module.id,
    title: module.title,
    description: module.description,
    authorId: session.user.id,
    authorName: session.user.name,
    authorEmail: session.user.email,
  });

  revalidatePath("/dashboard/modules");
  revalidatePath("/student");

  return module;
}

export async function updateModule(id: string, data: { title: string; content: string; description?: string }) {
  const newHash = computeContentHash(data.content || "");

  // Se o conteúdo foi alterado manualmente pelo professor, marcar avaliações com hash diferente como OUTDATED
  await prisma.ragEvaluation.updateMany({
    where: {
      moduleId: id,
      metric: "faithfulness",
      NOT: { contentHash: newHash },
    },
    data: { status: "OUTDATED" },
  });

  await prisma.module.update({
    where: { id },
    data: {
      title: data.title,
      content: data.content,
      description: data.description,
    },
  });

  logger.info("updateModule", "Módulo atualizado com sucesso pelo professor", {
    moduleId: id,
    title: data.title,
    description: data.description,
    newHash: newHash.slice(0, 12),
  });

  revalidatePath("/dashboard/modules");
  revalidatePath("/student");
}

export async function deleteModule(id: string) {
  await prisma.module.delete({ where: { id } });

  logger.info("deleteModule", "Módulo excluído com sucesso pelo professor", {
    moduleId: id,
  });

  revalidatePath("/dashboard/modules");
  revalidatePath("/student");
}

export async function getModuleQuestions(moduleId: string) {
  return await prisma.question.findMany({
    where: { moduleId },
    orderBy: { createdAt: "asc" }
  });
}

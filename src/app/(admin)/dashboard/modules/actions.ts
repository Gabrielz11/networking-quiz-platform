"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { Logger } from "@/lib/logger";

const logger = new Logger("AdminModulesActions");

export async function getModules() {
  return await prisma.module.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function createModule(data: { title: string; content: string; description?: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

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

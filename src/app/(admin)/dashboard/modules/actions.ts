"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function getModules() {
  return await prisma.module.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function createModule(data: { title: string; content: string; description?: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  await prisma.module.create({
    data: {
      title: data.title,
      content: data.content,
      description: data.description,
      authorId: session.user.id,
    },
  });

  revalidatePath("/dashboard/modules");
  revalidatePath("/student");
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

  revalidatePath("/dashboard/modules");
  revalidatePath("/student");
}

export async function deleteModule(id: string) {
  await prisma.module.delete({ where: { id } });
  revalidatePath("/dashboard/modules");
  revalidatePath("/student");
}

export async function getModuleQuestions(moduleId: string) {
  return await prisma.question.findMany({
    where: { moduleId },
    orderBy: { createdAt: "asc" }
  });
}

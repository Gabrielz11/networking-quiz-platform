"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function getQuestions() {
  return await prisma.question.findMany({
    include: {
      module: {
        select: {
          title: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getModules() {
  return await prisma.module.findMany({
    select: {
      id: true,
      title: true,
    },
    orderBy: { title: "asc" },
  });
}

export async function createQuestion(data: {
  moduleId: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanationBase: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.question.create({
    data: {
      moduleId: data.moduleId,
      prompt: data.prompt,
      options: data.options,
      correctOptionIndex: data.correctOptionIndex,
      explanationBase: data.explanationBase,
    },
  });
}

export async function updateQuestion(
  id: string,
  data: {
    moduleId: string;
    prompt: string;
    options: string[];
    correctOptionIndex: number;
    explanationBase: string;
  }
) {
  await prisma.question.update({
    where: { id },
    data: {
      moduleId: data.moduleId,
      prompt: data.prompt,
      options: data.options,
      correctOptionIndex: data.correctOptionIndex,
      explanationBase: data.explanationBase,
    },
  });
}

export async function deleteQuestion(id: string) {
  await prisma.question.delete({ where: { id } });
}

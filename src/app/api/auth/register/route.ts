import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

// Schema de validação para registro
const RegisterSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  name: z.string().min(2, "Nome muito curto").optional(),
  role: z.enum(["STUDENT", "TEACHER"]).optional().default("STUDENT"),
  teacherKey: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = RegisterSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password, name, role, teacherKey } = result.data;

    // Verificar se o usuário já existe
    const exists = await prisma.user.findUnique({
      where: { email },
    });

    if (exists) {
      return NextResponse.json({ error: "Este email já está em uso" }, { status: 400 });
    }

    // Regra de segurança para professores
    let finalRole = "STUDENT";
    if (role === "TEACHER") {
      const serverTeacherKey = process.env.TEACHER_REGISTRATION_KEY;
      
      if (!teacherKey || teacherKey !== serverTeacherKey) {
        return NextResponse.json(
          { error: "Chave de registro de professor inválida ou ausente." },
          { status: 403 }
        );
      }
      finalRole = "TEACHER";
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split("@")[0],
        role: finalRole as "STUDENT" | "TEACHER",
      },
    });

    return NextResponse.json({ message: "Usuário criado com sucesso!" }, { status: 201 });
  } catch (error) {
    console.error("REGISTRATION ERROR:", error);
    return NextResponse.json({ error: "Erro interno no servidor ao cadastrar usuário" }, { status: 500 });
  }
}

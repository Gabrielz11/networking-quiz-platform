import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Logger } from "@/lib/logger";
import { isRateLimited } from "@/lib/rate-limit";
import { env } from "@/lib/env";

const logger = new Logger("AuthRegisterRoute");

// P3.4 — Senha mínima elevada de 6 para 8 caracteres
const RegisterSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
  name: z.string().min(2, "Nome muito curto").optional(),
  role: z.enum(["STUDENT", "TEACHER"]).optional().default("STUDENT"),
  teacherKey: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // P3.4 — Rate limit por IP para conter brute force / enumeração de e-mails.
    // Tentativas repetidas do mesmo IP são bloqueadas (10 tentativas / 15 min).
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const limited = await isRateLimited(ip, "register", { limit: 10, windowSeconds: 900 });
    if (limited) {
      logger.warn("POST", "Rate limit atingido no registro", { ip });
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns minutos." },
        { status: 429 }
      );
    }

    const result = RegisterSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password, name, role, teacherKey } = result.data;

    const exists = await prisma.user.findUnique({ where: { email } });

    if (exists) {
      return NextResponse.json({ error: "Este email já está em uso" }, { status: 400 });
    }

    let finalRole = "STUDENT";
    if (role === "TEACHER") {
      // Importa env validado — nunca process.env direto
      const serverTeacherKey = env.TEACHER_REGISTRATION_KEY;

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
  } catch (error: unknown) {
    logger.error("POST", "Erro interno ao cadastrar usuário", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";

export class AuthError extends Error {
    constructor(
        public status: 401 | 403,
        message: string
    ) {
        super(message);
        this.name = "AuthError";
    }
}

/** Garante que há um usuário logado. Retorna o usuário ou lança AuthError(401). */
export async function requireUser() {
    const session = await auth();
    if (!session?.user?.id) throw new AuthError(401, "Não autorizado.");
    return session.user;
}

/** Garante usuário logado COM o role exigido. Lança 401 (sem login) ou 403 (role errado). */
export async function requireRole(role: Role) {
    const user = await requireUser();
    if (user.role !== role) throw new AuthError(403, "Acesso negado.");
    return user;
}

/** Converte AuthError em NextResponse. Relança erros não relacionados a auth. */
export function handleAuthError(error: unknown): NextResponse {
    if (error instanceof AuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
}

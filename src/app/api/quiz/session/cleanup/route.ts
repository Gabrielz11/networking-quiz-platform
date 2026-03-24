import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request) {
    try {
        const sessionReq = await auth();
        if (!sessionReq?.user) {
            return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
        }

        const { sessionId } = await req.json();

        if (!sessionId) {
            return NextResponse.json({ error: "sessionId é obrigatório." }, { status: 400 });
        }

        const session = await prisma.quizSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
        }

        if (session.userId !== sessionReq.user.id) {
            return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
        }

        // According to PDR v3.0 strategy: Delete session and all related question instances
        // Cascading delete is handled by Prisma schema (onDelete: Cascade)
        await prisma.quizSession.delete({
            where: { id: sessionId }
        });

        return NextResponse.json({ success: true, message: "Sessão finalizada e removida com sucesso." });

    } catch (error: any) {
        console.error("Cleanup Session Error:", error);
        return NextResponse.json(
            { error: "Falha ao finalizar e limpar a sessão.", details: error.message },
            { status: 500 }
        );
    }
}

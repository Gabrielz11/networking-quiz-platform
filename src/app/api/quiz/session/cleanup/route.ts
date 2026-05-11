import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request) {
    try {
        const authSession = await auth();
        if (!authSession?.user) {
            return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
        }

        const { sessionId } = await req.json();

        if (!sessionId || typeof sessionId !== "string") {
            return NextResponse.json({ error: "sessionId é obrigatório." }, { status: 400 });
        }

        //aqui podemos ter um problema se o usuario não for o dono da sessão
        //mas vamos deixar assim por enquanto, pois o usuario só pode acessar a sua sessão 
        const quizSession = await prisma.quizSession.findUnique({
            where: { id: sessionId }
        });

        if (!quizSession) {
            return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
        }

        if (quizSession.userId !== authSession.user.id) {
            return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
        }

        await prisma.quizSession.delete({
            where: { id: sessionId }
        });

        return NextResponse.json({ success: true, message: "Sessão finalizada e removida com sucesso." });

    } catch (error: any) {
        console.error("Cleanup Session Error:", error);
        return NextResponse.json(
            { error: "Falha ao finalizar e limpar a sessão." },
            { status: 500 }
        );
    }
}

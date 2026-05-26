import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCachedStudentList } from "@/lib/cache";

export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    if ((session.user as any).role !== "TEACHER") {
      return NextResponse.json({ error: "Acesso proibido." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const moduleId = searchParams.get("moduleId");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "8", 10) || 8));

    if (!moduleId) {
      return NextResponse.json(
        { error: "O parâmetro moduleId é obrigatório." },
        { status: 400 }
      );
    }

    const result = await getCachedStudentList(moduleId, page, pageSize);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

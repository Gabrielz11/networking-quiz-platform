import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCachedStudentDetail } from "@/lib/cache";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    if ((session.user as any).role !== "TEACHER") {
      return NextResponse.json({ error: "Acesso proibido." }, { status: 403 });
    }

    const resolvedParams = await params;
    const studentId = resolvedParams.studentId;

    if (!studentId) {
      return NextResponse.json(
        { error: "O parâmetro studentId é obrigatório." },
        { status: 400 }
      );
    }

    const data = await getCachedStudentDetail(studentId);

    if (!data) {
      return NextResponse.json(
        { error: "Estudante não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

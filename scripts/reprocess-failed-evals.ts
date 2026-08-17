import { prisma } from "@/lib/prisma";
import { enqueueRagEvaluation } from "@/lib/rag/jobs/queues/evaluation-queue";

async function main() {
    console.log("=== Reenfileirando Avaliações RAGAS com Timeout/Falhas ===");

    const failedEvals = await prisma.ragEvaluation.findMany({
        where: {
            OR: [
                { status: "FAILED" },
                { status: "PROCESSING" },
            ],
        },
    });

    console.log(`Encontradas ${failedEvals.length} avaliações elegíveis para reenfileiramento.`);

    for (const ev of failedEvals) {
        const details = ev.details as { sourceChunkIds?: string[] } | null;
        const sourceChunkIds = details?.sourceChunkIds || [];

        console.log(`\nReenfileirando ID: ${ev.id} (Módulo: ${ev.moduleId})`);

        await prisma.ragEvaluation.update({
            where: { id: ev.id },
            data: {
                status: "PENDING",
                error: null,
                startedAt: null,
                finishedAt: null,
                score: null,
            },
        });

        await enqueueRagEvaluation({
            evaluationId: ev.id,
            moduleId: ev.moduleId,
            contentHash: ev.contentHash,
            sourceChunkIds,
        });

        console.log(`✅ Job reenfileirado para ${ev.id}`);
    }
}

main()
    .catch((err) => console.error("Erro no reenfileiramento:", err))
    .finally(() => prisma.$disconnect());

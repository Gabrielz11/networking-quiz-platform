import { PrismaClient } from "@prisma/client";
import { redis } from "@/lib/redis";

const prisma = new PrismaClient();

const ALLOWED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);
const REDIS_PATTERNS = ["semantic_cache:*", "metrics:cache:*"];

/**
 * Iterador SCAN resiliente para recuperar chaves Redis correspondentes ao padrão sem bloquear o servidor.
 */
async function scanRedisKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = "0";

    do {
        const [nextCursor, foundKeys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;
        if (foundKeys.length > 0) {
            keys.push(...foundKeys);
        }
    } while (cursor !== "0");

    return keys;
}

async function main() {
    const isDryRun = process.argv.includes("--dry-run");
    const isConfirm = process.argv.includes("--confirm");

    // 1. Trava de ambiente de produção
    if (process.env.NODE_ENV === "production") {
        console.error("❌ ERRO DE SEGURANÇA: Execução negada em ambiente de produção!");
        process.exitCode = 1;
        return;
    }

    // 2. Trava de Hostname estrito via new URL()
    const dbUrlString = process.env.DATABASE_URL;
    if (!dbUrlString) {
        console.error("❌ ERRO DE SEGURANÇA: Variável DATABASE_URL não definida.");
        process.exitCode = 1;
        return;
    }

    let hostname: string;
    try {
        const parsedUrl = new URL(dbUrlString);
        hostname = parsedUrl.hostname;
    } catch {
        console.error("❌ ERRO DE SEGURANÇA: Formato inválido na DATABASE_URL.");
        process.exitCode = 1;
        return;
    }

    if (!ALLOWED_HOSTNAMES.has(hostname)) {
        console.error(`❌ ERRO DE SEGURANÇA: Hostname "${hostname}" não é um ambiente local permitido.`);
        console.error("Hostnames permitidos: localhost, 127.0.0.1, ::1, postgres (apenas container local)");
        process.exitCode = 1;
        return;
    }

    // 3. Exigência de modo (--dry-run ou --confirm)
    if (!isDryRun && !isConfirm) {
        console.error("⚠️ ATENÇÃO: É necessário informar uma flag de modo.");
        console.error(`Hostname detectado: "${hostname}"`);
        console.error("  Para simular:  npx tsx scripts/clear-ai-metrics.ts --dry-run");
        console.error("  Para executar: npx tsx scripts/clear-ai-metrics.ts --confirm");
        process.exitCode = 1;
        return;
    }

    try {
        if (isDryRun) {
            console.log(`🔍 [DRY-RUN] Simulação de limpeza no host: "${hostname}"`);
            console.log("Nenhum dado será excluído nesta execução.\n");

            const metadataCount = await prisma.aiGenerationMetadata.count();
            const cacheEntryCount = await prisma.semanticCacheEntry.count();

            let totalRedisKeys = 0;
            const redisBreakdown: Record<string, number> = {};

            for (const pattern of REDIS_PATTERNS) {
                const keys = await scanRedisKeys(pattern);
                redisBreakdown[pattern] = keys.length;
                totalRedisKeys += keys.length;
            }

            console.log("--- RESUMO DA SIMULAÇÃO (DRY-RUN) ---");
            console.log(`📊 AiGenerationMetadata (PostgreSQL): ${metadataCount} registro(s) para remoção.`);
            console.log(`📊 SemanticCacheEntry (PostgreSQL)  : ${cacheEntryCount} registro(s) para remoção.`);
            console.log(`📊 Chaves de Cache no Redis (Total) : ${totalRedisKeys} chave(s) encontrada(s).`);
            for (const [pattern, count] of Object.entries(redisBreakdown)) {
                console.log(`   └─ Padrão "${pattern}": ${count} chave(s)`);
            }
            console.log("\nPara executar a exclusão definitiva, execute com a flag --confirm.");
            return;
        }

        // Execução definitiva com --confirm
        console.log(`🚀 [EXECUÇÃO DEFINITIVA] Limpando métricas de IA no host: "${hostname}"`);

        // 4. Deleção no PostgreSQL via transação Prisma
        const [metadataResult, cacheResult] = await prisma.$transaction([
            prisma.aiGenerationMetadata.deleteMany(),
            prisma.semanticCacheEntry.deleteMany(),
        ]);

        console.log(`✅ AiGenerationMetadata removidos: ${metadataResult.count}`);
        console.log(`✅ SemanticCacheEntry removidos:   ${cacheResult.count}`);

        // 5. Deleção iterativa em lotes no Redis via SCAN
        let deletedRedisKeys = 0;
        for (const pattern of REDIS_PATTERNS) {
            const keys = await scanRedisKeys(pattern);
            if (keys.length > 0) {
                // Delete em lotes de 100 chaves por vez
                const BATCH_SIZE = 100;
                for (let i = 0; i < keys.length; i += BATCH_SIZE) {
                    const batch = keys.slice(i, i + BATCH_SIZE);
                    await redis.del(...batch);
                }
                deletedRedisKeys += keys.length;
                console.log(`✅ Chaves Redis removidas ("${pattern}"): ${keys.length}`);
            } else {
                console.log(`ℹ️ Chaves Redis ("${pattern}"): Nenhuma chave encontrada.`);
            }
        }

        console.log(`\n🎉 Limpeza concluída com sucesso! Total de ${deletedRedisKeys} chaves Redis removidas.`);
    } catch (error) {
        console.error("❌ ERRO CRÍTICO ao executar limpeza de métricas de IA:", error);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
        await redis.quit();
    }
}

main();

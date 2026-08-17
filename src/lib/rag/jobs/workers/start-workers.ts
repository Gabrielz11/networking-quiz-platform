import { embeddingWorker } from "./embedding-worker";
import { evaluationWorker } from "./evaluation-worker";
import { Logger } from "@/lib/logger";

const logger = new Logger("WorkerProcess");

async function start() {
    logger.info("Startup", "Starting BullMQ workers...");

    embeddingWorker.on("ready", () => {
        logger.info("Worker", "Embedding worker is ready and waiting for jobs");
    });

    embeddingWorker.on("active", (job) => {
        logger.info("Worker", `Started processing job ${job.id}`);
    });

    embeddingWorker.on("completed", (job) => {
        logger.info("Worker", `Completed job ${job.id}`);
    });

    embeddingWorker.on("failed", (job, err) => {
        logger.error("Worker", `Job ${job?.id} failed: ${err.message}`);
    });

    evaluationWorker.on("ready", () => {
        logger.info("Worker", "Evaluation worker is ready and waiting for jobs");
    });

    evaluationWorker.on("active", (job) => {
        logger.info("Worker", `[RAG Evaluation] Started job ${job.id}`);
    });

    evaluationWorker.on("completed", (job) => {
        logger.info("Worker", `[RAG Evaluation] Completed job ${job.id}`);
    });

    evaluationWorker.on("failed", (job, err) => {
        logger.error("Worker", `[RAG Evaluation] Job ${job?.id} failed: ${err.message}`);
    });

    process.on("SIGINT", async () => {
        logger.info("Shutdown", "Closing workers...");
        await embeddingWorker.close();
        await evaluationWorker.close();
        process.exit(0);
    });
}

start().catch((err) => {
    logger.error("Startup", `Failed to start workers: ${err.message}`);
    process.exit(1);
});

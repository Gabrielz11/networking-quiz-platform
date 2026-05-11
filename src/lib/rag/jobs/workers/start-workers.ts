import { embeddingWorker } from "./embedding-worker";
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

    process.on("SIGINT", async () => {
        logger.info("Shutdown", "Closing workers...");
        await embeddingWorker.close();
        process.exit(0);
    });
}

start().catch((err) => {
    logger.error("Startup", `Failed to start workers: ${err.message}`);
    process.exit(1);
});

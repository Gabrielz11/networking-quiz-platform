-- CreateTable
CREATE TABLE "SemanticCacheEntry" (
    "id" TEXT NOT NULL,
    "pipeline" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "ttlExpiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SemanticCacheEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SemanticCacheEntry_pipeline_idx" ON "SemanticCacheEntry"("pipeline");

-- CreateIndex
CREATE INDEX "SemanticCacheEntry_promptHash_idx" ON "SemanticCacheEntry"("promptHash");

-- CreateIndex
CREATE INDEX "SemanticCacheEntry_ttlExpiresAt_idx" ON "SemanticCacheEntry"("ttlExpiresAt");

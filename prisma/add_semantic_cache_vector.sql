ALTER TABLE "SemanticCacheEntry" ADD COLUMN IF NOT EXISTS "embedding" vector(768);
CREATE INDEX IF NOT EXISTS "semantic_cache_embedding_idx"
  ON "SemanticCacheEntry" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 50);

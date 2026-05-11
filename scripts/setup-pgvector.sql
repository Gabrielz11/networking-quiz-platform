ALTER TABLE "ModuleSourceChunk" ALTER COLUMN embedding TYPE vector(768) USING embedding::vector(768);

CREATE INDEX IF NOT EXISTS module_source_chunk_embedding_idx
ON "ModuleSourceChunk"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

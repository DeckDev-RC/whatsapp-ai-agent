-- ============================================
-- SUPABASE PGVECTOR SCHEMA - RAG System
-- ============================================
-- Schema para armazenamento de embeddings e busca vetorial
-- Baseado em best practices 2024-2025

-- 1. Habilitar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Criar tabela de embeddings
CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('order', 'customer', 'product', 'conversation')),
  document_id TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536), -- OpenAI text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar índices para performance

-- Índice HNSW para busca vetorial (MUITO IMPORTANTE para performance)
-- m = 16: número de conexões por camada (padrão recomendado)
-- ef_construction = 64: qualidade do índice (maior = melhor qualidade, mais lento para construir)
CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx 
ON document_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Índices para filtros (pre-filtering)
CREATE INDEX IF NOT EXISTS document_embeddings_tenant_id_idx 
ON document_embeddings(tenant_id);

CREATE INDEX IF NOT EXISTS document_embeddings_document_type_idx 
ON document_embeddings(document_type);

CREATE INDEX IF NOT EXISTS document_embeddings_tenant_type_idx 
ON document_embeddings(tenant_id, document_type);

-- Índice GIN para busca em metadata
CREATE INDEX IF NOT EXISTS document_embeddings_metadata_idx 
ON document_embeddings USING GIN (metadata);

-- Índice para busca por texto (keyword search)
CREATE INDEX IF NOT EXISTS document_embeddings_content_idx 
ON document_embeddings USING GIN (to_tsvector('portuguese', content));

-- Índice composto para queries comuns
CREATE INDEX IF NOT EXISTS document_embeddings_composite_idx 
ON document_embeddings(tenant_id, document_type, created_at DESC);

-- 4. Função para busca vetorial com filtros
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_tenant uuid DEFAULT NULL,
  filter_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  document_type text,
  document_id text,
  content text,
  metadata jsonb,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.tenant_id,
    de.document_type,
    de.document_id,
    de.content,
    de.metadata,
    de.created_at,
    1 - (de.embedding <=> query_embedding) AS similarity
  FROM document_embeddings de
  WHERE 
    (filter_tenant IS NULL OR de.tenant_id = filter_tenant)
    AND (filter_type IS NULL OR de.document_type = filter_type)
    AND 1 - (de.embedding <=> query_embedding) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Função para busca híbrida (vector + keyword)
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_tenant uuid DEFAULT NULL,
  filter_type text DEFAULT NULL,
  vector_weight float DEFAULT 0.7,
  keyword_weight float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  document_type text,
  document_id text,
  content text,
  metadata jsonb,
  created_at timestamptz,
  combined_score float,
  vector_score float,
  keyword_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      de.id,
      de.tenant_id,
      de.document_type,
      de.document_id,
      de.content,
      de.metadata,
      de.created_at,
      1 - (de.embedding <=> query_embedding) AS similarity
    FROM document_embeddings de
    WHERE 
      (filter_tenant IS NULL OR de.tenant_id = filter_tenant)
      AND (filter_type IS NULL OR de.document_type = filter_type)
      AND 1 - (de.embedding <=> query_embedding) > match_threshold
  ),
  keyword_results AS (
    SELECT
      de.id,
      ts_rank(to_tsvector('portuguese', de.content), plainto_tsquery('portuguese', query_text)) AS rank
    FROM document_embeddings de
    WHERE 
      (filter_tenant IS NULL OR de.tenant_id = filter_tenant)
      AND (filter_type IS NULL OR de.document_type = filter_type)
      AND to_tsvector('portuguese', de.content) @@ plainto_tsquery('portuguese', query_text)
  )
  SELECT
    vr.id,
    vr.tenant_id,
    vr.document_type,
    vr.document_id,
    vr.content,
    vr.metadata,
    vr.created_at,
    (vr.similarity * vector_weight + COALESCE(kr.rank, 0) * keyword_weight) AS combined_score,
    vr.similarity AS vector_score,
    COALESCE(kr.rank, 0) AS keyword_score
  FROM vector_results vr
  LEFT JOIN keyword_results kr ON vr.id = kr.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 6. Tabela para semantic caching
CREATE TABLE IF NOT EXISTS semantic_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query TEXT NOT NULL,
  query_embedding vector(1536),
  response TEXT NOT NULL,
  hits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice HNSW para busca de queries similares
CREATE INDEX IF NOT EXISTS semantic_cache_embedding_idx 
ON semantic_cache 
USING hnsw (query_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Índice para limpeza de cache antigo
CREATE INDEX IF NOT EXISTS semantic_cache_last_used_idx 
ON semantic_cache(last_used_at);

-- 7. Função para buscar cache semântico
CREATE OR REPLACE FUNCTION find_similar_cache(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.95
)
RETURNS TABLE (
  id uuid,
  query text,
  response text,
  hits integer,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.query,
    sc.response,
    sc.hits,
    1 - (sc.query_embedding <=> query_embedding) AS similarity
  FROM semantic_cache sc
  WHERE 1 - (sc.query_embedding <=> query_embedding) > similarity_threshold
  ORDER BY sc.query_embedding <=> query_embedding
  LIMIT 1;
END;
$$;

-- 8. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_document_embeddings_updated_at
BEFORE UPDATE ON document_embeddings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 9. Row Level Security (RLS) - Segurança por tenant
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só podem ver documentos do próprio tenant
CREATE POLICY tenant_isolation_policy ON document_embeddings
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 10. Função para limpar cache antigo (executar periodicamente)
CREATE OR REPLACE FUNCTION cleanup_old_cache(days_old int DEFAULT 30)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM semantic_cache
  WHERE last_used_at < NOW() - (days_old || ' days')::interval
  AND hits < 5; -- Manter queries populares
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 11. View para estatísticas
CREATE OR REPLACE VIEW embedding_stats AS
SELECT
  tenant_id,
  document_type,
  COUNT(*) as total_documents,
  MIN(created_at) as first_indexed,
  MAX(created_at) as last_indexed,
  pg_size_pretty(pg_total_relation_size('document_embeddings')) as table_size
FROM document_embeddings
GROUP BY tenant_id, document_type;

-- 12. Comentários para documentação
COMMENT ON TABLE document_embeddings IS 'Armazena embeddings de documentos para busca vetorial (RAG)';
COMMENT ON COLUMN document_embeddings.embedding IS 'Vetor de 1536 dimensões (OpenAI text-embedding-3-small)';
COMMENT ON FUNCTION match_documents IS 'Busca vetorial com filtros por tenant e tipo';
COMMENT ON FUNCTION hybrid_search IS 'Busca híbrida combinando similaridade vetorial e keyword search';
COMMENT ON TABLE semantic_cache IS 'Cache semântico para queries similares';

-- ============================================
-- QUERIES ÚTEIS PARA MANUTENÇÃO
-- ============================================

-- Ver estatísticas de embeddings por tenant
-- SELECT * FROM embedding_stats;

-- Buscar documentos similares
-- SELECT * FROM match_documents(
--   query_embedding := '[0.1, 0.2, ...]'::vector,
--   match_threshold := 0.7,
--   match_count := 10,
--   filter_tenant := 'uuid-do-tenant'::uuid
-- );

-- Busca híbrida
-- SELECT * FROM hybrid_search(
--   query_text := 'pedido atrasado',
--   query_embedding := '[0.1, 0.2, ...]'::vector,
--   filter_tenant := 'uuid-do-tenant'::uuid
-- );

-- Limpar cache antigo
-- SELECT cleanup_old_cache(30); -- Remove cache com mais de 30 dias

-- Ver tamanho dos índices
-- SELECT
--   indexname,
--   pg_size_pretty(pg_relation_size(indexname::regclass)) as size
-- FROM pg_indexes
-- WHERE tablename = 'document_embeddings'
-- ORDER BY pg_relation_size(indexname::regclass) DESC;

-- Vacuum e analyze (manutenção)
-- VACUUM ANALYZE document_embeddings;
-- VACUUM ANALYZE semantic_cache;

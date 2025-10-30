-- Cayman Monitor - Simplified Schema
-- Enable pgvector

CREATE EXTENSION IF NOT EXISTS vector;

-- articles
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  url_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT,
  excerpt TEXT,
  body TEXT,
  published_at TIMESTAMPTZ,
  cayman_flag BOOLEAN DEFAULT false,
  signals JSONB DEFAULT '{}',
  reasons TEXT[] DEFAULT '{}',
  confidence REAL,
  embedding VECTOR(1536),
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- entities
CREATE TABLE IF NOT EXISTS public.entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  canonical_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('ORG','PERSON','GPE','RO_PROVIDER')),
  aliases TEXT[] DEFAULT '{}'
);

-- article_entities (m2m)
CREATE TABLE IF NOT EXISTS public.article_entities (
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  role TEXT,
  PRIMARY KEY (article_id, entity_id)
);

-- ingest_runs
CREATE TABLE IF NOT EXISTS public.ingest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  fetched INT DEFAULT 0,
  stored INT DEFAULT 0,
  skipped INT DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON public.articles (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_source ON public.articles (source);
CREATE INDEX IF NOT EXISTS idx_articles_url_hash ON public.articles (url_hash);
CREATE INDEX IF NOT EXISTS idx_articles_signals_gin ON public.articles USING GIN (signals);
CREATE INDEX IF NOT EXISTS idx_articles_embedding_ivf ON public.articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_runs ENABLE ROW LEVEL SECURITY;

-- policies: read for authenticated, write only for service_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='articles' AND policyname='articles_select_auth'
  ) THEN
    CREATE POLICY articles_select_auth ON public.articles
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='entities' AND policyname='entities_select_auth'
  ) THEN
    CREATE POLICY entities_select_auth ON public.entities
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='article_entities' AND policyname='article_entities_select_auth'
  ) THEN
    CREATE POLICY article_entities_select_auth ON public.article_entities
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='ingest_runs' AND policyname='ingest_runs_select_auth'
  ) THEN
    CREATE POLICY ingest_runs_select_auth ON public.ingest_runs
      FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

-- NOTE: inserts/updates/deletes are performed by edge functions using service_role; no public policies for write.

-- Table comments
COMMENT ON TABLE public.articles IS 'News articles ingested from GDELT and NewsAPI with Cayman relevance classification';
COMMENT ON TABLE public.entities IS 'Extracted entities (companies, people, locations, RO providers)';
COMMENT ON TABLE public.article_entities IS 'Many-to-many linking of articles to entities';
COMMENT ON TABLE public.ingest_runs IS 'Audit log of ingestion runs';

-- Column comments
COMMENT ON COLUMN public.articles.url_hash IS 'SHA256 hash of URL for deduplication';
COMMENT ON COLUMN public.articles.cayman_flag IS 'True if article is relevant to Cayman Islands entities';
COMMENT ON COLUMN public.articles.signals IS 'JSONB object with risk signal flags: {fraud: true, financial_decline: false, ...}';
COMMENT ON COLUMN public.articles.reasons IS 'Array of reasoning strings explaining Cayman relevance';
COMMENT ON COLUMN public.articles.confidence IS 'Classification confidence score (0.0 to 1.0)';
COMMENT ON COLUMN public.articles.embedding IS 'OpenAI ada-002 embedding vector (1536 dimensions) for semantic search';
COMMENT ON COLUMN public.articles.meta IS 'Additional metadata (source-specific fields, author, etc.)';


-- Cayman Monitor Database Schema
-- Created: 2025-10-31
-- Purpose: News monitoring for Cayman Islands entities with risk signal classification

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- TABLE: monitor_articles
-- Purpose: Store ingested news articles with classification results
-- ============================================================================
CREATE TABLE monitor_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source metadata
  source_api text NOT NULL CHECK (source_api IN ('gdelt', 'newsapi')),
  source_id text NOT NULL,
  url text NOT NULL,
  url_hash text NOT NULL UNIQUE,
  title text NOT NULL,
  title_normalized text NOT NULL,
  published_at timestamptz NOT NULL,
  
  -- Content
  content_raw text,
  content_normalized text,
  content_snippet text,
  language text DEFAULT 'en',
  embedding vector(1536),
  
  -- Source details
  source_name text,
  source_domain text,
  author text,
  
  -- Cayman relevance
  cayman_relevant boolean DEFAULT false,
  cayman_confidence numeric(3,2) CHECK (cayman_confidence BETWEEN 0 AND 1),
  cayman_keywords jsonb DEFAULT '[]'::jsonb,
  cayman_entities jsonb DEFAULT '[]'::jsonb,
  
  -- Classification (risk signals)
  classified boolean DEFAULT false,
  classification_result jsonb,
  signals jsonb DEFAULT '[]'::jsonb,
  signal_financial_decline boolean DEFAULT false,
  signal_fraud boolean DEFAULT false,
  signal_misstated_financials boolean DEFAULT false,
  signal_shareholder_dispute boolean DEFAULT false,
  signal_director_duties boolean DEFAULT false,
  signal_regulatory_investigation boolean DEFAULT false,
  
  -- Processing metadata
  ingested_at timestamptz DEFAULT now(),
  classified_at timestamptz,
  llm_tokens_used jsonb DEFAULT '{}'::jsonb,
  processing_errors jsonb DEFAULT '[]'::jsonb,
  
  -- Status
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'classified', 'failed')),
  requires_review boolean DEFAULT false,
  
  -- Deduplication
  duplicate_of uuid REFERENCES monitor_articles(id),
  similarity_score numeric(3,2),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(source_api, source_id)
);

-- ============================================================================
-- TABLE: monitor_entities
-- Purpose: Extracted Cayman entities (companies, people, RO providers)
-- ============================================================================
CREATE TABLE monitor_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name text NOT NULL,
  entity_type text CHECK (entity_type IN ('ORG', 'PERSON', 'GPE', 'RO_PROVIDER')),
  normalized_name text NOT NULL UNIQUE,
  aliases jsonb DEFAULT '[]'::jsonb,
  article_count integer DEFAULT 0,
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- TABLE: monitor_article_entities
-- Purpose: Many-to-many relationship between articles and entities
-- ============================================================================
CREATE TABLE monitor_article_entities (
  article_id uuid REFERENCES monitor_articles(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES monitor_entities(id) ON DELETE CASCADE,
  confidence numeric(3,2) CHECK (confidence BETWEEN 0 AND 1),
  mention_count integer DEFAULT 1,
  PRIMARY KEY (article_id, entity_id)
);

-- ============================================================================
-- TABLE: monitor_ingestion_runs
-- Purpose: Track ingestion job history for observability
-- ============================================================================
CREATE TABLE monitor_ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_api text NOT NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text DEFAULT 'running',
  articles_fetched integer DEFAULT 0,
  articles_new integer DEFAULT 0,
  articles_duplicate integer DEFAULT 0,
  articles_cayman_relevant integer DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  triggered_by text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- TABLE: monitor_settings
-- Purpose: Configuration singleton for Monitor feature
-- ============================================================================
CREATE TABLE monitor_settings (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000002'::uuid,
  
  -- API Keys
  gdelt_enabled boolean DEFAULT true,
  newsapi_key text,
  newsapi_enabled boolean DEFAULT false,
  openai_api_key text,
  
  -- Ingestion config
  ingest_schedule text DEFAULT '*/15 * * * *',  -- Every 15 min
  lookback_hours integer DEFAULT 24,
  max_articles_per_run integer DEFAULT 100,
  
  -- Filtering
  cayman_keywords jsonb DEFAULT '["Cayman Islands", "Cayman", "Grand Cayman", "Cayman domiciled", "Cayman-registered"]'::jsonb,
  ro_providers jsonb DEFAULT '["MaplesFS", "Maples", "Walkers", "Ogier", "Carey Olsen", "Appleby", "Campbells"]'::jsonb,
  
  -- Classification
  classification_enabled boolean DEFAULT true,
  classification_threshold numeric(3,2) DEFAULT 0.70,
  batch_size integer DEFAULT 20,
  
  -- Rate limits
  newsapi_daily_limit integer DEFAULT 100,
  newsapi_requests_today integer DEFAULT 0,
  last_newsapi_reset timestamptz,
  
  -- Feature flags
  enable_embeddings boolean DEFAULT false,  -- v1.1
  enable_deduplication boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Initialize settings
INSERT INTO monitor_settings (id) VALUES ('00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Articles indexes
CREATE INDEX idx_monitor_articles_published ON monitor_articles(published_at DESC);
CREATE INDEX idx_monitor_articles_status ON monitor_articles(status) WHERE status = 'pending';
CREATE INDEX idx_monitor_articles_cayman ON monitor_articles(cayman_relevant) WHERE cayman_relevant = true;
CREATE INDEX idx_monitor_articles_signals ON monitor_articles USING GIN(signals);
CREATE INDEX idx_monitor_articles_entities_gin ON monitor_articles USING GIN(cayman_entities);
CREATE INDEX idx_monitor_articles_source_domain ON monitor_articles(source_domain);

-- pgvector similarity index (for v1.1 semantic search)
CREATE INDEX idx_monitor_articles_embedding ON monitor_articles 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Entity indexes
CREATE INDEX idx_monitor_entities_normalized ON monitor_entities(normalized_name);
CREATE INDEX idx_monitor_entities_type ON monitor_entities(entity_type);

-- Join table indexes
CREATE INDEX idx_monitor_article_entities_article ON monitor_article_entities(article_id);
CREATE INDEX idx_monitor_article_entities_entity ON monitor_article_entities(entity_id);

-- Ingestion runs indexes
CREATE INDEX idx_monitor_ingestion_runs_started ON monitor_ingestion_runs(started_at DESC);
CREATE INDEX idx_monitor_ingestion_runs_source ON monitor_ingestion_runs(source_api);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE monitor_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_article_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_settings ENABLE ROW LEVEL SECURITY;

-- Authenticated users can SELECT all data
CREATE POLICY "authenticated_select_articles" ON monitor_articles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_entities" ON monitor_entities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_article_entities" ON monitor_article_entities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_runs" ON monitor_ingestion_runs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_settings" ON monitor_settings
  FOR SELECT TO authenticated USING (true);

-- Only service_role can INSERT/UPDATE/DELETE
-- (service_role bypasses RLS, so no explicit policies needed)

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_monitor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to articles
CREATE TRIGGER trigger_monitor_articles_updated
  BEFORE UPDATE ON monitor_articles
  FOR EACH ROW EXECUTE FUNCTION update_monitor_updated_at();

-- Apply trigger to settings
CREATE TRIGGER trigger_monitor_settings_updated
  BEFORE UPDATE ON monitor_settings
  FOR EACH ROW EXECUTE FUNCTION update_monitor_updated_at();

-- ============================================================================
-- SCHEDULED JOBS (pg_cron)
-- ============================================================================
-- Note: Replace [project] and [SERVICE_ROLE_KEY] with actual values

-- Ingestion job (every 15 minutes)
-- SELECT cron.schedule(
--   'monitor-ingest-job',
--   '*/15 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://[project].supabase.co/functions/v1/monitor-run-ingestion',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer [SERVICE_ROLE_KEY]',
--       'Content-Type', 'application/json'
--     ),
--     body := '{"source": "all"}'::jsonb
--   );
--   $$
-- );

-- Classification job (every 30 minutes)
-- SELECT cron.schedule(
--   'monitor-classify-job',
--   '*/30 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://[project].supabase.co/functions/v1/monitor-batch-classify',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer [SERVICE_ROLE_KEY]',
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- NewsAPI counter reset (daily at midnight UTC)
-- SELECT cron.schedule(
--   'monitor-reset-newsapi-counter',
--   '0 0 * * *',
--   $$
--   UPDATE monitor_settings 
--   SET newsapi_requests_today = 0, 
--       last_newsapi_reset = now()
--   WHERE id = '00000000-0000-0000-0000-000000000002';
--   $$
-- );

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE monitor_articles IS 'News articles ingested from GDELT and NewsAPI with LLM classification';
COMMENT ON TABLE monitor_entities IS 'Extracted Cayman entities (companies, people, registered office providers)';
COMMENT ON TABLE monitor_article_entities IS 'Many-to-many linking of articles to entities';
COMMENT ON TABLE monitor_ingestion_runs IS 'Audit log of ingestion job executions';
COMMENT ON TABLE monitor_settings IS 'Configuration singleton for Monitor feature';

COMMENT ON COLUMN monitor_articles.url_hash IS 'SHA256 hash of URL for deduplication';
COMMENT ON COLUMN monitor_articles.title_normalized IS 'Lowercase, trimmed title for near-duplicate detection';
COMMENT ON COLUMN monitor_articles.embedding IS 'OpenAI ada-002 embedding (1536 dimensions) for semantic search';
COMMENT ON COLUMN monitor_articles.classification_result IS 'Full LLM classification output with reasoning and confidence';
COMMENT ON COLUMN monitor_articles.signals IS 'Array of detected risk signals';
COMMENT ON COLUMN monitor_entities.normalized_name IS 'Lowercase, cleaned entity name for matching';
COMMENT ON COLUMN monitor_settings.ingest_schedule IS 'Cron expression for ingestion schedule';


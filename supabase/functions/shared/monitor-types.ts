// Shared TypeScript types for Cayman Monitor feature

export interface MonitorArticle {
  id: string;
  source_api: 'gdelt' | 'newsapi';
  source_id: string;
  url: string;
  url_hash: string;
  title: string;
  title_normalized: string;
  published_at: string;
  content_raw: string | null;
  content_normalized: string | null;
  content_snippet: string | null;
  language: string;
  embedding: number[] | null;
  source_name: string | null;
  source_domain: string | null;
  author: string | null;
  cayman_relevant: boolean;
  cayman_confidence: number | null;
  cayman_keywords: string[];
  cayman_entities: CaymanEntity[];
  classified: boolean;
  classification_result: ClassificationResult | null;
  signals: string[];
  signal_financial_decline: boolean;
  signal_fraud: boolean;
  signal_misstated_financials: boolean;
  signal_shareholder_dispute: boolean;
  signal_director_duties: boolean;
  signal_regulatory_investigation: boolean;
  ingested_at: string;
  classified_at: string | null;
  llm_tokens_used: LLMTokenUsage;
  processing_errors: string[];
  status: 'pending' | 'classified' | 'failed';
  requires_review: boolean;
  duplicate_of: string | null;
  similarity_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface CaymanEntity {
  name: string;
  type: 'ORG' | 'PERSON' | 'GPE' | 'RO_PROVIDER';
  confidence: number;
}

export interface ClassificationResult {
  cayman_reasoning: string;
  summary: string;
  signal_details: Record<string, SignalDetail>;
}

export interface SignalDetail {
  confidence: number;
  evidence: string;
}

export interface LLMTokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  total_cost?: number;
}

export interface MonitorEntity {
  id: string;
  entity_name: string;
  entity_type: 'ORG' | 'PERSON' | 'GPE' | 'RO_PROVIDER';
  normalized_name: string;
  aliases: string[];
  article_count: number;
  first_seen: string;
  last_seen: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MonitorSettings {
  id: string;
  gdelt_enabled: boolean;
  newsapi_key: string | null;
  newsapi_enabled: boolean;
  openai_api_key: string | null;
  ingest_schedule: string;
  lookback_hours: number;
  max_articles_per_run: number;
  cayman_keywords: string[];
  ro_providers: string[];
  classification_enabled: boolean;
  classification_threshold: number;
  batch_size: number;
  newsapi_daily_limit: number;
  newsapi_requests_today: number;
  last_newsapi_reset: string | null;
  enable_embeddings: boolean;
  enable_deduplication: boolean;
  created_at: string;
  updated_at: string;
}

export interface IngestionRun {
  id: string;
  source_api: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  articles_fetched: number;
  articles_new: number;
  articles_duplicate: number;
  articles_cayman_relevant: number;
  errors: string[];
  metadata: Record<string, unknown>;
  triggered_by: string;
  created_at: string;
}

// GDELT API Response Types
export interface GDELTArticle {
  url: string;
  url_mobile?: string;
  title: string;
  seendate: string;
  socialimage?: string;
  domain: string;
  language: string;
  sourcecountry?: string;
}

export interface GDELTResponse {
  articles: GDELTArticle[];
}

// NewsAPI Response Types
export interface NewsAPIArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

export interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

// LLM Classification Types
export interface LLMClassificationRequest {
  title: string;
  content: string;
  ro_providers: string[];
}

export interface LLMClassificationResponse {
  cayman_relevant: boolean;
  cayman_confidence: number;
  cayman_reasoning: string;
  cayman_entities: CaymanEntity[];
  signals_detected: string[];
  signal_details: Record<string, SignalDetail>;
  summary: string;
}

// API Response Types
export interface APIArticleResponse {
  success: boolean;
  count: number;
  total: number;
  offset: number;
  limit: number;
  articles: MonitorArticle[];
  error?: string;
}

export interface APIEntityArticlesResponse {
  success: boolean;
  entity: MonitorEntity;
  count: number;
  total: number;
  articles: Array<{
    id: string;
    title: string;
    url: string;
    published_at: string;
    signals: string[];
    mention_count: number;
    confidence: number;
  }>;
  error?: string;
}

export interface APIStatsResponse {
  success: boolean;
  stats: {
    total_articles: number;
    cayman_relevant: number;
    cayman_percentage: number;
    by_signal: Record<string, number>;
    by_source: Record<string, number>;
    recent_24h: {
      total: number;
      cayman_relevant: number;
      high_priority: number;
    };
    top_entities: Array<{
      id: string;
      name: string;
      type: string;
      article_count: number;
    }>;
    last_ingestion: {
      run_id: string;
      source_api: string;
      completed_at: string;
      articles_new: number;
      articles_cayman_relevant: number;
    } | null;
    classification_health: {
      pending: number;
      classified_today: number;
      avg_confidence: number;
      requires_review: number;
    };
  };
  error?: string;
}

export interface APIIngestionResponse {
  success: boolean;
  run_id: string;
  message: string;
  source: string;
  lookback_hours: number;
  started_at: string;
  estimated_completion: string;
  error?: string;
}


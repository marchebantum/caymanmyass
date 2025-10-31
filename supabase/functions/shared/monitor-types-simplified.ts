export type SignalFlags = {
  financial_decline: boolean;
  fraud: boolean;
  misstated_financials: boolean;
  shareholder_issues: boolean;
  director_duties: boolean;
  enforcement: boolean;
};

export type ArticleDTO = {
  id: string;
  url: string;
  source: string;
  title: string | null;
  excerpt: string | null;
  published_at: string | null;
  cayman_flag: boolean;
  signals: SignalFlags;
  reasons: string[];
  confidence: number | null;
};

export type EntityDTO = {
  id: string;
  name: string;
  canonical_name: string | null;
  type: 'ORG' | 'PERSON' | 'GPE' | 'RO_PROVIDER';
  aliases: string[];
};

export type IngestRunDTO = {
  id: string;
  source: string;
  status: string;
  fetched: number;
  stored: number;
  skipped: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

export type ListArticlesResponse = {
  items: ArticleDTO[];
  next_cursor?: string;
};

export type ListArticlesRequest = {
  signal?: keyof SignalFlags;
  from?: string;
  to?: string;
  q?: string;
  source?: string;
  limit?: number;
  cursor?: string;
};

export type StatsResponse = {
  total_articles: number;
  cayman_relevant: number;
  by_signal: Partial<SignalFlags>;
  by_source: Record<string, number>;
  recent_24h: {
    total: number;
    cayman_relevant: number;
  };
  top_entities: Array<{
    id: string;
    name: string;
    type: string;
    article_count: number;
  }>;
};

export interface ArticleRow {
  id: string;
  url: string;
  url_hash: string;
  source: string;
  title: string | null;
  excerpt: string | null;
  body: string | null;
  published_at: string | null;
  cayman_flag: boolean;
  signals: Record<string, boolean>;
  reasons: string[];
  confidence: number | null;
  embedding: number[] | null;
  meta: Record<string, any>;
  created_at: string;
}

export interface EntityRow {
  id: string;
  name: string;
  canonical_name: string | null;
  type: 'ORG' | 'PERSON' | 'GPE' | 'RO_PROVIDER';
  aliases: string[];
}

export interface ArticleEntityRow {
  article_id: string;
  entity_id: string;
  role: string | null;
}

export interface IngestRunRow {
  id: string;
  source: string;
  status: string;
  fetched: number;
  stored: number;
  skipped: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export function articleRowToDTO(row: ArticleRow): ArticleDTO {
  return {
    id: row.id,
    url: row.url,
    source: row.source,
    title: row.title,
    excerpt: row.excerpt,
    published_at: row.published_at,
    cayman_flag: row.cayman_flag,
    signals: row.signals as SignalFlags,
    reasons: row.reasons,
    confidence: row.confidence,
  };
}

export function entityRowToDTO(row: EntityRow): EntityDTO {
  return {
    id: row.id,
    name: row.name,
    canonical_name: row.canonical_name,
    type: row.type,
    aliases: row.aliases,
  };
}

export function ingestRunRowToDTO(row: IngestRunRow): IngestRunDTO {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    fetched: row.fetched,
    stored: row.stored,
    skipped: row.skipped,
    error: row.error,
    started_at: row.started_at,
    finished_at: row.finished_at,
  };
}
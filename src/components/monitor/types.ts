export type MonitorSignal =
  | 'financial_decline'
  | 'fraud'
  | 'misstated_financials'
  | 'shareholder_issues'
  | 'director_duties'
  | 'enforcement';

export type MonitorArticle = {
  id: string;
  url: string;
  source: string;
  title: string | null;
  excerpt: string | null;
  published_at: string | null;
  cayman_flag: boolean;
  signals: Record<MonitorSignal, boolean>;
  reasons: string[];
  confidence: number | null;
};

export type ArticleEntity = {
  id: string;
  name: string;
  type: 'ORG' | 'PERSON' | 'GPE' | 'RO_PROVIDER';
  role: string | null;
};


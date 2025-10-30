import { ExternalLink, Clock } from 'lucide-react';
import type { MonitorArticle, MonitorSignal } from './monitor/types';

interface MonitorArticleListProps {
  articles: MonitorArticle[];
  loading: boolean;
  onSelect: (article: MonitorArticle) => void;
}

const SIGNAL_META: Record<MonitorSignal, { label: string; classNames: string }> = {
  financial_decline: {
    label: 'Financial Decline',
    classNames: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200',
  },
  fraud: {
    label: 'Fraud',
    classNames: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
  },
  misstated_financials: {
    label: 'Misstated Financials',
    classNames: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
  },
  shareholder_issues: {
    label: 'Shareholder Issues',
    classNames: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
  },
  director_duties: {
    label: 'Director Duties',
    classNames: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200',
  },
  enforcement: {
    label: 'Enforcement',
    classNames: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200',
  },
};

function formatPublishedAt(publishedAt: string | null) {
  if (!publishedAt) return 'Unknown date';
  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) {
    return 'Unknown date';
  }
  return published.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractHostname(url: string) {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getActiveSignals(signals: MonitorArticle['signals']) {
  return (Object.keys(signals) as MonitorSignal[]).filter((key) => Boolean(signals[key]));
}

export function MonitorArticleList({ articles, loading, onSelect }: MonitorArticleListProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading articles...</p>
      </div>
    );
  }

  if (!articles.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
        <p className="text-gray-600 dark:text-gray-400">No articles found. Adjust filters or try another search.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {articles.map((article) => {
        const signals = getActiveSignals(article.signals);
        const hostname = extractHostname(article.url);

        return (
          <article
            key={article.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer"
            onClick={() => onSelect(article)}
          >
            <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {article.title || 'Untitled Article'}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                    {hostname}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200">
                    <Clock className="h-3.5 w-3.5" />
                    {formatPublishedAt(article.published_at)}
                  </span>
                </div>
              </div>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                onClick={(event) => event.stopPropagation()}
              >
                Open source
                <ExternalLink className="h-4 w-4" />
              </a>
            </header>

            {article.excerpt && (
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 line-clamp-3">
                {article.excerpt}
              </p>
            )}

            {signals.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {signals.map((signal) => (
                  <span
                    key={signal}
                    className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${SIGNAL_META[signal].classNames}`}
                  >
                    {SIGNAL_META[signal].label}
                  </span>
                ))}
              </div>
            )}

            {article.reasons?.length ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Cayman Relevance
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  {article.reasons.slice(0, 3).map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                  {article.reasons.length > 3 && (
                    <li className="text-xs text-gray-500 dark:text-gray-400">
                      +{article.reasons.length - 3} more reasons
                    </li>
                  )}
                </ul>
              </div>
            ) : null}

            <footer className="mt-4 flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Confidence: <span className="font-medium text-gray-900 dark:text-white">{article.confidence ? Math.round(article.confidence * 100) : 0}%</span>
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Tap for details
              </span>
            </footer>
          </article>
        );
      })}
    </div>
  );
}


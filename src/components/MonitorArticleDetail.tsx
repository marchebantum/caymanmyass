import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ArticleEntity, MonitorArticle, MonitorSignal } from './monitor/types';

interface MonitorArticleDetailProps {
  article: MonitorArticle | null;
  onClose: () => void;
}

const SIGNAL_LABELS: Record<MonitorSignal, string> = {
  financial_decline: 'Financial Decline',
  fraud: 'Fraud',
  misstated_financials: 'Misstated Financials',
  shareholder_issues: 'Shareholder Issues',
  director_duties: 'Director Duties',
  enforcement: 'Enforcement',
};

export function MonitorArticleDetail({ article, onClose }: MonitorArticleDetailProps) {
  const [entities, setEntities] = useState<ArticleEntity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  useEffect(() => {
    if (!article) {
      setEntities([]);
      return;
    }

    let isActive = true;
    async function loadEntities() {
      try {
        setLoadingEntities(true);
        const { data, error } = await supabase
          .from('article_entities')
          .select('role, entity:entity_id ( id, name, type )')
          .eq('article_id', article.id);

        if (error) {
          console.error('Error loading article entities:', error.message);
          return;
        }

        if (!isActive || !data) return;

        const parsed: ArticleEntity[] = data
          .map((row) => {
            if (!row.entity) return null;
            return {
              id: row.entity.id,
              name: row.entity.name,
              type: row.entity.type,
              role: row.role,
            } satisfies ArticleEntity;
          })
          .filter(Boolean) as ArticleEntity[];

        setEntities(parsed);
      } finally {
        if (isActive) {
          setLoadingEntities(false);
        }
      }
    }

    loadEntities();

    return () => {
      isActive = false;
    };
  }, [article]);

  const isOpen = Boolean(article);
  const signals = useMemo(() => {
    if (!article) return [] as MonitorSignal[];
    return (Object.keys(article.signals) as MonitorSignal[]).filter((key) => Boolean(article.signals[key]));
  }, [article]);

  if (!isOpen || !article) {
    return null;
  }

  const publishedAt = article.published_at
    ? new Date(article.published_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown date';

  const hostname = (() => {
    try {
      return new URL(article.url).hostname.replace(/^www\./, '');
    } catch {
      return article.source;
    }
  })();

  if (typeof document === 'undefined') {
    return null;
  }

  const drawer = (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-gray-900 shadow-xl flex flex-col">
        <header className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{hostname}</p>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Article Details</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            aria-label="Close article detail"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <section>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{article.title || 'Untitled Article'}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                Published: {publishedAt}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                Confidence: {article.confidence ? Math.round(article.confidence * 100) : 0}%
              </span>
            </div>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Open original article
              <ExternalLink className="h-4 w-4" />
            </a>
          </section>

          {article.excerpt && (
            <section>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                Excerpt
              </h4>
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {article.excerpt}
              </p>
            </section>
          )}

          {signals.length ? (
            <section>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                Detected Signals
              </h4>
              <div className="flex flex-wrap gap-2">
                {signals.map((signal) => (
                  <span
                    key={signal}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200"
                  >
                    {SIGNAL_LABELS[signal]}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {article.reasons?.length ? (
            <section>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                Cayman Relevance
              </h4>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                {article.reasons.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
              Extracted Entities
            </h4>
            {loadingEntities ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading entities...</p>
            ) : entities.length ? (
              <ul className="space-y-2">
                {entities.map((entity) => (
                  <li
                    key={entity.id}
                    className="flex items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{entity.name}</span>
                      <span className="ml-2 text-xs uppercase text-gray-500 dark:text-gray-400">{entity.type}</span>
                      {entity.role && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">as {entity.role}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">No entities extracted for this article.</p>
            )}
          </section>
        </div>
      </aside>
    </div>
  );

  return createPortal(drawer, document.body);
}


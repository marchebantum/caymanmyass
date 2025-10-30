import { useCallback, useEffect, useMemo, useState } from 'react';
import { MonitorFilters, MonitorFiltersState } from '../../components/MonitorFilters';
import { MonitorArticleList } from '../../components/MonitorArticleList';
import { MonitorArticleDetail } from '../../components/MonitorArticleDetail';
import { MonitorStatsWidget } from '../../components/MonitorStatsWidget';
import type { MonitorArticle, MonitorSignal } from '../../components/monitor/types';

const PAGE_SIZE = 25;

const createInitialFilters = (): MonitorFiltersState => ({
  query: '',
  signals: [],
  source: 'all',
  from: '',
  to: '',
});

export function MonitorPage() {
  const [draftFilters, setDraftFilters] = useState<MonitorFiltersState>(() => createInitialFilters());
  const [filters, setFilters] = useState<MonitorFiltersState>(() => createInitialFilters());

  const [articles, setArticles] = useState<MonitorArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<MonitorArticle | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const activeSignalFilters = filters.signals;

  const fetchArticles = useCallback(
    async ({ append, cursor }: { append?: boolean; cursor?: string } = {}) => {
      try {
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase environment variables are not configured');
        }

        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsInitialLoading(true);
          setError(null);
        }

        const params = new URLSearchParams({ limit: PAGE_SIZE.toString() });

        if (filters.query.trim()) {
          params.set('q', filters.query.trim());
        }

        if (filters.source !== 'all') {
          params.set('source', filters.source);
        }

        if (filters.from) {
          const fromDate = new Date(filters.from);
          params.set('from', fromDate.toISOString());
        }

        if (filters.to) {
          const toDate = new Date(filters.to);
          toDate.setHours(23, 59, 59, 999);
          params.set('to', toDate.toISOString());
        }

        if (filters.signals.length === 1) {
          params.set('signal', filters.signals[0]);
        }

        if (cursor) {
          params.set('cursor', cursor);
        }

        const requestUrl = `${supabaseUrl}/functions/v1/monitor_api/articles?${params.toString()}`;
        const response = await fetch(requestUrl, {
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data: { items?: MonitorArticle[]; next_cursor?: string } = await response.json();
        console.log('Monitor articles response', data);

        const items = data.items ?? [];
        setArticles((prev) => (append ? [...prev, ...items] : items));
        setNextCursor(data.next_cursor ?? null);
      } catch (err) {
        console.error('Failed to load monitor articles', err);
        setError(err instanceof Error ? err.message : 'Failed to load articles');
      } finally {
        setIsInitialLoading(false);
        setIsLoadingMore(false);
      }
    },
    [filters, supabaseKey, supabaseUrl]
  );

  useEffect(() => {
    fetchArticles({ append: false });
  }, [fetchArticles]);

  const handleApplyFilters = () => {
    setFilters({
      ...draftFilters,
      signals: [...draftFilters.signals],
    });
  };

  const handleResetFilters = () => {
    const reset = createInitialFilters();
    setDraftFilters(reset);
    setFilters(reset);
  };

  const handleLoadMore = () => {
    if (!nextCursor) return;
    fetchArticles({ append: true, cursor: nextCursor });
  };

  const signalFilterNotice = useMemo(() => {
    if (draftFilters.signals.length <= 1) return null;
    return 'Multiple signals selected; currently showing results for the first selected signal.';
  }, [draftFilters.signals]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cayman Monitor</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Monitor global financial news for Cayman Islands entities and risk signals.
        </p>
      </header>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-sm text-red-800 dark:text-red-200 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <MonitorFilters
            value={draftFilters}
            onChange={setDraftFilters}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
            isLoading={isInitialLoading}
          />
        </div>

        <div className="lg:col-span-3 space-y-6">
          <MonitorStatsWidget />

          {signalFilterNotice && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-sm text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
              {signalFilterNotice}
            </div>
          )}

          <MonitorArticleList articles={articles} loading={isInitialLoading} onSelect={setSelectedArticle} />

          {nextCursor && (
            <div className="text-center">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60"
              >
                {isLoadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </div>

      <MonitorArticleDetail article={selectedArticle} onClose={() => setSelectedArticle(null)} />
    </div>
  );
}

export default MonitorPage;


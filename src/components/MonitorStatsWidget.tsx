import { useEffect, useMemo, useState } from 'react';
import { Database, TrendingUp, Globe, Activity } from 'lucide-react';

interface StatsResponse {
  total_articles: number;
  cayman_relevant: number;
  by_signal: Record<string, number>;
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
}

export function MonitorStatsWidget() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadStats() {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/monitor_api/stats`, {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load stats: ${response.status}`);
      }

      const data: StatsResponse = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error loading monitor stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const topSignals = useMemo(() => {
    if (!stats) return [] as Array<{ key: string; count: number }>;
    return Object.entries(stats.by_signal || {})
      .filter(([, count]) => count > 0)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [stats]);

  const topSources = useMemo(() => {
    if (!stats) return [] as Array<{ key: string; count: number }>;
    return Object.entries(stats.by_source || {})
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [stats]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">Unable to load statistics.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Database className="h-5 w-5" /> Cayman Monitor Overview
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Last 30 days
        </span>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <p className="text-xs uppercase font-semibold text-blue-700 dark:text-blue-200">Total articles</p>
          <p className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-200">{stats.total_articles}</p>
        </div>
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/30">
          <p className="text-xs uppercase font-semibold text-green-700 dark:text-green-200">Cayman relevant</p>
          <p className="mt-2 text-2xl font-bold text-green-700 dark:text-green-200">{stats.cayman_relevant}</p>
        </div>
        <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/30">
          <p className="text-xs uppercase font-semibold text-purple-700 dark:text-purple-200">Last 24 hours</p>
          <p className="mt-2 text-2xl font-bold text-purple-700 dark:text-purple-200">
            {stats.recent_24h.cayman_relevant}
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-300">
            {stats.recent_24h.total} articles ingested
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Leading Signals
          </h4>
          {topSignals.length ? (
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              {topSignals.map(({ key, count }) => (
                <li key={key} className="flex items-center justify-between">
                  <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No signals recorded yet.</p>
          )}
        </section>

        <section>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Globe className="h-4 w-4" /> Top Sources
          </h4>
          {topSources.length ? (
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              {topSources.map(({ key, count }) => (
                <li key={key} className="flex items-center justify-between">
                  <span>{key}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No sources recorded yet.</p>
          )}
        </section>
      </div>

      {stats.top_entities.length > 0 && (
        <section>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Prominent Entities
          </h4>
          <div className="flex flex-wrap gap-2">
            {stats.top_entities.slice(0, 5).map((entity) => (
              <span
                key={entity.id}
                className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200"
              >
                {entity.name} · {entity.article_count}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


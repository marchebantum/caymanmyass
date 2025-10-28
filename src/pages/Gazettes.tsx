import { useEffect, useState } from 'react';
import { Download, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { GazetteIssue } from '../lib/database.types';
import { GazetteAnalyzerPanel } from '../components/GazetteAnalyzerPanel';
import { AnalyzedGazettesSection } from '../components/AnalyzedGazettesSection';

export function Gazettes() {
  const [tab, setTab] = useState<'regular' | 'extraordinary'>('regular');
  const [issues, setIssues] = useState<GazetteIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIssues();
  }, [tab]);

  async function loadIssues() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('gazette_issues')
        .select('*')
        .eq('kind', tab)
        .order('issue_date', { ascending: false });

      if (error) throw error;
      setIssues(data || []);
    } catch (error) {
      console.error('Error loading gazette issues:', error);
    } finally {
      setLoading(false);
    }
  }

  function getQualityBadge(score: number | null) {
    if (score === null) return <span className="text-gray-500 dark:text-gray-400">N/A</span>;

    if (score >= 95) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">{score.toFixed(1)}%</span>;
    }
    if (score >= 90) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">{score.toFixed(1)}%</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">{score.toFixed(1)}%</span>;
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gazettes</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Government gazettes and liquidation notices</p>
      </div>

      <GazetteAnalyzerPanel />

      <AnalyzedGazettesSection />

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTab('regular')}
          className={`px-6 py-3 font-medium transition-colors ${
            tab === 'regular'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Regular Gazettes
        </button>
        <button
          onClick={() => setTab('extraordinary')}
          className={`px-6 py-3 font-medium transition-colors ${
            tab === 'extraordinary'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Extraordinary Gazettes
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Loading gazette issues...
          </div>
        ) : issues.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No gazette issues found. Run a scrape job to fetch data.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Issue Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Notices Found
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Quality Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Possible Misses
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {issues.map((issue) => {
                  const possibleMisses = Array.isArray(issue.possible_misses) ? issue.possible_misses.length : 0;

                  return (
                    <tr key={issue.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {issue.issue_number || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(issue.issue_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {issue.parsed_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getQualityBadge(issue.quality_score)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {possibleMisses > 0 ? (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <span className="w-2 h-2 bg-amber-600 dark:bg-amber-400 rounded-full"></span>
                            {possibleMisses}
                          </span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors" title="View report">
                            <Eye size={16} />
                          </button>
                          <button className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors" title="Download PDF">
                            <Download size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Search, Eye, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { RegistryRow } from '../lib/database.types';
import { CaseSummaryRenderer } from '../components/CaseSummaryRenderer';
import { RegistryAnalyzerPanel } from '../components/RegistryAnalyzerPanel';
import { AnalyzedPdfsSection } from '../components/AnalyzedPdfsSection';

export function Registry() {
  const [rows, setRows] = useState<RegistryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<any>(null);

  useEffect(() => {
    loadRows();
  }, [subjectFilter]);

  async function loadRows() {
    try {
      setLoading(true);
      let query = supabase
        .from('registry_rows')
        .select('*')
        .order('filing_date', { ascending: false });

      if (subjectFilter === 'awaiting_pdf') {
        query = query.eq('status', 'awaiting_pdf');
      } else if (subjectFilter !== 'all') {
        query = query.ilike('subject', `%${subjectFilter}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRows(data || []);
    } catch (error) {
      console.error('Error loading registry rows:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = rows.filter(row =>
    row.cause_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function getStatusBadge(status: string) {
    const styles = {
      awaiting_pdf: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
      pdf_captured: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      processing: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
      analyzed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
      needs_manual: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
      expired_link: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }


  async function viewAnalysis(row: RegistryRow) {
    try {
      const { data: caseData, error } = await supabase
        .from('cases')
        .select('id, dashboard_summary, analysis_md, parsed_json, extraction_quality_score, requires_review, fields_extracted, fields_missing, extraction_metadata, llm_tokens_used')
        .eq('registry_row_id', row.id)
        .maybeSingle();

      if (error || !caseData) {
        alert('Case analysis not found');
        return;
      }

      setSelectedCase(caseData);
    } catch (error) {
      console.error('Error loading case:', error);
      alert('Failed to load case analysis');
    }
  }

  function getFieldDisplayName(field: string): string {
    return field.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  }

  function getConfidenceColor(confidence: string): string {
    switch (confidence) {
      case 'high':
        return 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700';
      case 'medium':
        return 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700';
      case 'low':
        return 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700';
      default:
        return 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600';
    }
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Registry Cases</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Judicial public registers - Financial Services</p>
      </div>

      <RegistryAnalyzerPanel />

      <AnalyzedPdfsSection />

      {rows.some(r => r.status === 'awaiting_pdf') && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <Upload className="text-amber-600 dark:text-amber-400 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-bold text-amber-900 dark:text-amber-300 mb-1">Action Required: Manual PDF Upload</h3>
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                New registry cases have been detected. Please visit{' '}
                <a
                  href="https://judicial.ky/public-registers/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100"
                >
                  judicial.ky/public-registers
                </a>
                , filter by Financial Services, download the PDFs for the cases below, and upload them here for analysis.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Cases awaiting upload: {rows.filter(r => r.status === 'awaiting_pdf').length}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Search by cause number or title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSubjectFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                subjectFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSubjectFilter('awaiting_pdf')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                subjectFilter === 'awaiting_pdf'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Awaiting PDF
            </button>
            <button
              onClick={() => setSubjectFilter('winding up-petition')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                subjectFilter === 'winding up-petition'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Winding Up-Petition
            </button>
            <button
              onClick={() => setSubjectFilter('petition')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                subjectFilter === 'petition'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Petition
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Loading registry cases...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No registry cases found. Run a scrape job to fetch data.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cause Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Filing Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {row.cause_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(row.filing_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-md truncate" title={row.title || ''}>
                      {row.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {row.subject}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(row.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        {row.status === 'analyzed' && (
                          <button
                            onClick={() => viewAnalysis(row)}
                            className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                            title="View analysis"
                          >
                            <Eye size={14} />
                            View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredRows.length} of {rows.length} cases
        </p>
      </div>

      {selectedCase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Case Analysis</h2>
                {selectedCase.extraction_quality_score !== null && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Extraction Quality:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            selectedCase.extraction_quality_score >= 80
                              ? 'bg-green-500'
                              : selectedCase.extraction_quality_score >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${selectedCase.extraction_quality_score}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {selectedCase.extraction_quality_score.toFixed(0)}%
                      </span>
                    </div>
                    {selectedCase.requires_review && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                        Needs Review
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {selectedCase.dashboard_summary ? (
                <div className="mb-6">
                  <CaseSummaryRenderer summary={selectedCase.dashboard_summary} />
                </div>
              ) : selectedCase.analysis_md ? (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Case Analysis</h3>
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 dark:text-gray-300">{selectedCase.analysis_md}</pre>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <p>No analysis available for this case</p>
                </div>
              )}

              {selectedCase.fields_extracted && Array.isArray(selectedCase.fields_extracted) && selectedCase.fields_extracted.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Extraction Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedCase.fields_extracted.map((field: string) => {
                      const metadata = selectedCase.extraction_metadata?.[field];
                      const confidence = metadata?.confidence || 'medium';
                      return (
                        <div
                          key={field}
                          className={`px-3 py-2 rounded-lg border ${getConfidenceColor(confidence)}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{getFieldDisplayName(field)}</span>
                            <span className="text-xs capitalize">{confidence}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedCase.fields_missing && Array.isArray(selectedCase.fields_missing) && selectedCase.fields_missing.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">Missing Fields</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCase.fields_missing.map((field: string) => (
                      <span
                        key={field}
                        className="px-2 py-1 text-xs font-medium rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                      >
                        {getFieldDisplayName(field)}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                    These fields could not be automatically extracted and may require manual entry.
                  </p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setSelectedCase(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
              {selectedCase.parsed_json && (
                <button
                  onClick={() => {
                    const dataStr = JSON.stringify(selectedCase.parsed_json, null, 2);
                    const blob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `case-data-${selectedCase.id}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Export Data
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

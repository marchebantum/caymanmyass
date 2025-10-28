import { useEffect, useState } from 'react';
import { Eye, Download, Trash2, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AnalyzedRegistryPdf } from '../lib/database.types';
import { CaseSummaryRenderer } from './CaseSummaryRenderer';

export function AnalyzedPdfsSection() {
  const [analyzedPdfs, setAnalyzedPdfs] = useState<AnalyzedRegistryPdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPdf, setSelectedPdf] = useState<AnalyzedRegistryPdf | null>(null);

  useEffect(() => {
    loadAnalyzedPdfs();

    const handleNewAnalysis = () => {
      loadAnalyzedPdfs();
    };

    window.addEventListener('registry-pdf-analyzed', handleNewAnalysis);

    return () => {
      window.removeEventListener('registry-pdf-analyzed', handleNewAnalysis);
    };
  }, []);

  async function loadAnalyzedPdfs() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('analyzed_registry_pdfs')
        .select('id, cause_number, dashboard_summary, extraction_metadata, extraction_quality_score, llm_tokens_used, uploaded_by, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnalyzedPdfs(data || []);
    } catch (error) {
      console.error('Error loading analyzed PDFs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this analyzed PDF?')) return;

    try {
      const { error } = await supabase
        .from('analyzed_registry_pdfs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadAnalyzedPdfs();
    } catch (error) {
      console.error('Error deleting PDF:', error);
      alert('Failed to delete PDF');
    }
  }

  function handleExport(pdf: AnalyzedRegistryPdf) {
    const dataStr = JSON.stringify(
      {
        cause_number: pdf.cause_number,
        summary: pdf.dashboard_summary,
        tokens_used: pdf.llm_tokens_used,
        created_at: pdf.created_at,
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registry-${pdf.cause_number}-analysis.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const filteredPdfs = analyzedPdfs.filter(pdf =>
    pdf.cause_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Analyzed Registry PDFs</h3>
            <p className="text-sm text-gray-600 mt-1">
              All analyzed case documents stored centrally
            </p>
          </div>
          <div className="text-sm text-gray-600">
            {analyzedPdfs.length} {analyzedPdfs.length === 1 ? 'PDF' : 'PDFs'} analyzed
          </div>
        </div>

        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by cause number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Loading analyzed PDFs...
          </div>
        ) : filteredPdfs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm ? 'No PDFs match your search.' : 'No analyzed PDFs yet. Upload a registry case PDF above to get started.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPdfs.map((pdf) => (
              <div
                key={pdf.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900">{pdf.cause_number}</h4>
                    <p className="text-xs text-gray-500 mt-1">{formatDate(pdf.created_at)}</p>
                  </div>
                  {pdf.extraction_quality_score > 0 && (
                    <div
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        pdf.extraction_quality_score >= 80
                          ? 'bg-green-100 text-green-800'
                          : pdf.extraction_quality_score >= 60
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {pdf.extraction_quality_score.toFixed(0)}%
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedPdf(pdf)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                    title="View analysis"
                  >
                    <Eye size={14} />
                    View
                  </button>
                  <button
                    onClick={() => handleExport(pdf)}
                    className="flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition-colors"
                    title="Export analysis JSON"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(pdf.id)}
                    className="flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-600 text-xs font-medium rounded hover:bg-red-100 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPdf && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedPdf.cause_number}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Analyzed: {formatDate(selectedPdf.created_at)}
                </p>
              </div>
              <button
                onClick={() => setSelectedPdf(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <CaseSummaryRenderer summary={selectedPdf.dashboard_summary} />
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setSelectedPdf(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => handleExport(selectedPdf)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Export Data
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

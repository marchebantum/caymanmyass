import { useEffect, useState } from 'react';
import { Eye, Download, Trash2, Search, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AnalyzedGazettePdf, GazetteLiquidationNotice } from '../lib/database.types';

export function AnalyzedGazettesSection() {
  const [analyzedGazettes, setAnalyzedGazettes] = useState<AnalyzedGazettePdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGazette, setSelectedGazette] = useState<{
    gazette: AnalyzedGazettePdf;
    notices: GazetteLiquidationNotice[];
  } | null>(null);

  useEffect(() => {
    loadAnalyzedGazettes();

    const handleNewAnalysis = () => {
      loadAnalyzedGazettes();
    };

    window.addEventListener('gazette-pdf-analyzed', handleNewAnalysis);

    return () => {
      window.removeEventListener('gazette-pdf-analyzed', handleNewAnalysis);
    };
  }, []);

  async function loadAnalyzedGazettes() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('analyzed_gazette_pdfs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnalyzedGazettes(data || []);
    } catch (error) {
      console.error('Error loading analyzed gazettes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this analyzed gazette? All associated notices will also be deleted.')) return;

    try {
      const { error } = await supabase
        .from('analyzed_gazette_pdfs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadAnalyzedGazettes();
    } catch (error) {
      console.error('Error deleting gazette:', error);
      alert('Failed to delete gazette');
    }
  }

  async function handleView(gazette: AnalyzedGazettePdf) {
    try {
      const { data: notices, error } = await supabase
        .from('gazette_liquidation_notices')
        .select('*')
        .eq('analyzed_gazette_id', gazette.id)
        .order('company_name');

      if (error) throw error;

      setSelectedGazette({
        gazette,
        notices: notices || [],
      });
    } catch (error) {
      console.error('Error loading notices:', error);
      alert('Failed to load liquidation notices');
    }
  }

  function handleExport(gazette: AnalyzedGazettePdf) {
    const dataStr = JSON.stringify(
      {
        gazette_type: gazette.gazette_type,
        issue_number: gazette.issue_number,
        issue_date: gazette.issue_date,
        notices_count: gazette.notices_count,
        full_analysis: gazette.full_analysis,
        tokens_used: gazette.llm_tokens_used,
        created_at: gazette.created_at,
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gazette-${gazette.gazette_type}-${gazette.issue_number || 'analysis'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportNoticesCSV() {
    if (!selectedGazette) return;

    const headers = ['Company Name', 'Appointment Type', 'Appointment Date', 'Liquidator Name', 'Liquidator Contact', 'Confidence'];
    const rows = selectedGazette.notices.map(notice => [
      notice.company_name,
      notice.appointment_type,
      notice.appointment_date || 'N/A',
      notice.liquidator_name || 'N/A',
      notice.liquidator_contact || 'N/A',
      notice.extraction_confidence,
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gazette-${selectedGazette.gazette.issue_number || 'notices'}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatDateTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const filteredGazettes = analyzedGazettes.filter(gazette =>
    (gazette.issue_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    gazette.gazette_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Analyzed Gazette PDFs</h3>
            <p className="text-sm text-gray-600 mt-1">
              All analyzed gazette documents with extracted liquidation notices
            </p>
          </div>
          <div className="text-sm text-gray-600">
            {analyzedGazettes.length} {analyzedGazettes.length === 1 ? 'gazette' : 'gazettes'} analyzed
          </div>
        </div>

        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by issue number or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Loading analyzed gazettes...
          </div>
        ) : filteredGazettes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm ? 'No gazettes match your search.' : 'No analyzed gazettes yet. Upload a gazette PDF above to get started.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGazettes.map((gazette) => (
              <div
                key={gazette.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={18} className="text-gray-600" />
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          gazette.gazette_type === 'regular'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {gazette.gazette_type === 'regular' ? 'Regular' : 'Extraordinary'}
                      </span>
                    </div>
                    <h4 className="font-bold text-gray-900">
                      {gazette.issue_number || 'Unknown Issue'}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(gazette.issue_date)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Analyzed: {formatDateTime(gazette.created_at)}
                    </p>
                  </div>
                </div>

                <div className="mb-3 p-2 bg-gray-50 rounded">
                  <p className="text-sm font-medium text-gray-700">
                    {gazette.notices_count} {gazette.notices_count === 1 ? 'Notice' : 'Notices'} Extracted
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleView(gazette)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                    title="View notices"
                  >
                    <Eye size={14} />
                    View Notices
                  </button>
                  <button
                    onClick={() => handleExport(gazette)}
                    className="flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition-colors"
                    title="Export data"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(gazette.id)}
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

      {selectedGazette && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedGazette.gazette.issue_number || 'Gazette'} - Liquidation Notices
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedGazette.notices.length} {selectedGazette.notices.length === 1 ? 'notice' : 'notices'} from "Voluntary Liquidator and Creditor Notices" section
                </p>
              </div>
              <button
                onClick={() => setSelectedGazette(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Company Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Appointment Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Liquidator
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedGazette.notices.map((notice) => (
                      <tr key={notice.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {notice.company_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {notice.appointment_type}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {formatDate(notice.appointment_date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {notice.liquidator_name || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {notice.liquidator_contact || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setSelectedGazette(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleExportNoticesCSV}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Export as CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

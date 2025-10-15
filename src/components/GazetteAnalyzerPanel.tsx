import { useState } from 'react';
import { Upload, Loader, AlertTriangle, X, CheckCircle } from 'lucide-react';

interface LiquidationNotice {
  company_name: string;
  appointment_type: string;
  appointment_date: string | null;
  liquidator_name: string | null;
  liquidator_contact: string | null;
  raw_notice_text: string;
  confidence: string;
}

export function GazetteAnalyzerPanel() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [notices, setNotices] = useState<LiquidationNotice[]>([]);
  const [tokensUsed, setTokensUsed] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [gazetteType, setGazetteType] = useState<'regular' | 'extraordinary'>('regular');
  const [issueNumber, setIssueNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }

  async function handleFileUpload(file: File) {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file only.');
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      setError('PDF file is too large. Maximum size is 30MB.');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      setNotices([]);
      setTokensUsed(null);

      setProcessingStep('Analyzing Gazette PDF with Claude...');

      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      const analyzeUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-gazette-with-claude`;
      const response = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdf_base64: base64,
          gazette_type: gazetteType,
          issue_number: issueNumber || undefined,
          issue_date: issueDate || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze gazette');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      setNotices(result.notices || []);
      setTokensUsed(result.tokens_used);
      setProcessingStep('Complete!');

      window.dispatchEvent(new CustomEvent('gazette-pdf-analyzed'));
    } catch (err: any) {
      console.error('Gazette analysis error:', err);
      setError(err.message || 'Failed to process gazette PDF. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  }

  function handleClear() {
    setNotices([]);
    setTokensUsed(null);
    setError(null);
    setIssueNumber('');
    setIssueDate('');
  }

  function handleExport() {
    if (notices.length === 0) return;

    const dataStr = JSON.stringify(
      {
        gazette_type: gazetteType,
        issue_number: issueNumber,
        issue_date: issueDate,
        notices_count: notices.length,
        notices: notices,
        tokens_used: tokensUsed,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gazette-${gazetteType}-${issueNumber || 'analysis'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportCSV() {
    if (notices.length === 0) return;

    const headers = ['Company Name', 'Appointment Type', 'Appointment Date', 'Liquidator Name', 'Liquidator Contact', 'Confidence'];
    const rows = notices.map(notice => [
      notice.company_name,
      notice.appointment_type,
      notice.appointment_date || 'N/A',
      notice.liquidator_name || 'N/A',
      notice.liquidator_contact || 'N/A',
      notice.confidence,
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gazette-${gazetteType}-notices-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Gazette Analyzer</h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload a Gazette PDF to extract liquidation notices automatically
          </p>
        </div>
      </div>

      {notices.length === 0 && !isProcessing && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label htmlFor="gazette-type" className="block text-sm font-medium text-gray-700 mb-2">
                Gazette Type
              </label>
              <select
                id="gazette-type"
                value={gazetteType}
                onChange={(e) => setGazetteType(e.target.value as 'regular' | 'extraordinary')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="regular">Regular Gazette</option>
                <option value="extraordinary">Extraordinary Gazette</option>
              </select>
            </div>

            <div>
              <label htmlFor="issue-number" className="block text-sm font-medium text-gray-700 mb-2">
                Issue Number (Optional)
              </label>
              <input
                type="text"
                id="issue-number"
                value={issueNumber}
                onChange={(e) => setIssueNumber(e.target.value)}
                placeholder="e.g., Ga05/2025"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="issue-date" className="block text-sm font-medium text-gray-700 mb-2">
                Issue Date (Optional)
              </label>
              <input
                type="date"
                id="issue-date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-gray-100 rounded-full">
                <Upload size={32} className="text-gray-600" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">
                  Drop Gazette PDF here or click to browse
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Extracts notices from "Voluntary Liquidator and Creditor Notices" section (max 30MB)
                </p>
              </div>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="gazette-pdf-upload-input"
              />
              <label
                htmlFor="gazette-pdf-upload-input"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
              >
                Select Gazette PDF
              </label>
            </div>
          </div>
        </>
      )}

      {isProcessing && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader className="animate-spin text-blue-600" size={48} />
          <p className="text-lg font-medium text-gray-900">{processingStep}</p>
          <p className="text-sm text-gray-500">
            Extracting liquidation notices from the gazette...
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900">Error Processing Gazette</h4>
              <p className="text-sm text-red-800 mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {notices.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-600" size={24} />
              <div>
                <h4 className="font-semibold text-green-900">
                  {notices.length} Liquidation {notices.length === 1 ? 'Notice' : 'Notices'} Extracted
                </h4>
                <p className="text-sm text-green-700">
                  From "Voluntary Liquidator and Creditor Notices" section
                </p>
              </div>
            </div>
            {tokensUsed && (
              <div className="text-sm text-green-700">
                Tokens: {tokensUsed.total_tokens?.toLocaleString()}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                  {notices.map((notice, index) => (
                    <tr key={index} className="hover:bg-gray-50">
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
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={notice.liquidator_contact || ''}>
                        {notice.liquidator_contact || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Export as CSV
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Export as JSON
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Analyze Another Gazette
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

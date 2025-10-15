import { useState } from 'react';
import { Upload, Loader, AlertTriangle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DashboardSummaryDisplay } from './DashboardSummaryDisplay';

export function RegistryAnalyzerPanel() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [dashboardSummary, setDashboardSummary] = useState<string | null>(null);
  const [tokensUsed, setTokensUsed] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractedCauseNumber, setExtractedCauseNumber] = useState<string>('');

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
      setDashboardSummary(null);
      setTokensUsed(null);
      setExtractedCauseNumber('');

      setProcessingStep('Analyzing PDF with Claude...');

      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      const analyzeUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-pdf-with-claude`;
      const response = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pdf_base64: base64 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze PDF');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      const causeNumber = result.cause_number || 'Unknown';
      setExtractedCauseNumber(causeNumber);

      setProcessingStep('Saving to database...');

      const { error: dbError } = await supabase
        .from('analyzed_registry_pdfs')
        .insert({
          cause_number: causeNumber,
          dashboard_summary: result.dashboard_summary,
          extraction_metadata: {},
          extraction_quality_score: 0,
          llm_tokens_used: result.tokens_used,
          uploaded_by: 'user',
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error('Failed to save analysis to database');
      }

      setDashboardSummary(result.dashboard_summary);
      setTokensUsed(result.tokens_used);
      setProcessingStep('Complete!');

      window.dispatchEvent(new CustomEvent('registry-pdf-analyzed'));
    } catch (err: any) {
      console.error('PDF analysis error:', err);
      setError(err.message || 'Failed to process PDF. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  }

  function handleClear() {
    setDashboardSummary(null);
    setTokensUsed(null);
    setError(null);
    setExtractedCauseNumber('');
  }

  function handleExport() {
    if (!dashboardSummary) return;

    const dataStr = JSON.stringify(
      {
        cause_number: extractedCauseNumber,
        summary: dashboardSummary,
        tokens_used: tokensUsed,
        timestamp: new Date().toISOString()
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registry-case-${extractedCauseNumber}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCopyToClipboard() {
    if (!dashboardSummary) return;

    navigator.clipboard.writeText(dashboardSummary);
    alert('Dashboard summary copied to clipboard!');
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Registry Analyzer</h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload a registry case PDF for AI-powered dashboard-ready analysis
          </p>
        </div>
      </div>

      {!dashboardSummary && !isProcessing && (
        <>
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
                  Drop PDF here or click to browse
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Supports both text and scanned PDFs (max 30MB)
                </p>
              </div>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="pdf-upload-input"
              />
              <label
                htmlFor="pdf-upload-input"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
              >
                Select PDF File
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
            This may take a few moments...
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900">Error Processing PDF</h4>
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

      {dashboardSummary && (
        <div className="space-y-4">
          {extractedCauseNumber && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-900">Extracted Cause Number:</span>
                <span className="text-sm font-bold text-blue-900">{extractedCauseNumber}</span>
              </div>
            </div>
          )}
          <DashboardSummaryDisplay
            summary={dashboardSummary}
            tokensUsed={tokensUsed}
            onCopy={handleCopyToClipboard}
            onExport={handleExport}
            onClear={handleClear}
          />
        </div>
      )}
    </div>
  );
}

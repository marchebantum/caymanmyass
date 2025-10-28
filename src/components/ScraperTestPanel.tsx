import { useState } from 'react';
import { PlayCircle, CheckCircle, XCircle, AlertCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TestLog {
  step: string;
  step_number: number;
  status: 'success' | 'warning' | 'error' | 'info';
  message: string;
  data?: any;
  error_message?: string;
  execution_time_ms: number;
}

interface TestResult {
  success: boolean;
  test_run_id: string;
  test_mode: 'dry_run' | 'live';
  summary?: {
    total_entries_found: number;
    winding_up_petitions: number;
    petitions: number;
    new_entries: number;
    new_cause_numbers: number;
    total_execution_time_ms: number;
    successful_steps: number;
    failed_steps: number;
  };
  logs: TestLog[];
  error?: string;
}

export function ScraperTestPanel() {
  const [testing, setTesting] = useState(false);
  const [testMode, setTestMode] = useState<'dry_run' | 'live'>('dry_run');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  async function runTest() {
    try {
      setTesting(true);
      setTestResult(null);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-scraper`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_mode: testMode,
          verbose: true,
        }),
      });

      const result = await response.json();
      setTestResult(result);

      if (result.success) {
        setExpandedLogs(new Set(result.logs.map((_: any, i: number) => i)));
      }
    } catch (error) {
      console.error('Test error:', error);
      setTestResult({
        success: false,
        test_run_id: '',
        test_mode: testMode,
        logs: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setTesting(false);
    }
  }

  function toggleLog(index: number) {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLogs(newExpanded);
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'success':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'error':
        return <XCircle className="text-red-600" size={20} />;
      case 'warning':
        return <AlertCircle className="text-amber-600" size={20} />;
      case 'info':
        return <Clock className="text-blue-600" size={20} />;
      default:
        return <AlertCircle className="text-gray-600" size={20} />;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Scraper Testing & Diagnostics</h2>
        <p className="text-sm text-gray-600">
          Test the registry scraper to see what data is being extracted and diagnose any issues
        </p>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Required API Keys for Testing</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>
            <strong>1. Firecrawl API Key</strong> - Required for scraping judicial.ky website
          </p>
          <p className="ml-4">
            • Get free API key from{' '}
            <a
              href="https://www.firecrawl.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium hover:text-blue-900"
            >
              firecrawl.dev
            </a>
          </p>
          <p className="ml-4">• Add it in the "Firecrawl Web Scraping" section above</p>
          <p className="ml-4">• Enable the "Enable automated web scraping" checkbox</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Test Mode</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="test_mode"
                value="dry_run"
                checked={testMode === 'dry_run'}
                onChange={(e) => setTestMode(e.target.value as 'dry_run')}
                className="text-blue-600"
              />
              <span className="text-sm">
                <strong>Dry Run</strong> - Test only, don't save data
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="test_mode"
                value="live"
                checked={testMode === 'live'}
                onChange={(e) => setTestMode(e.target.value as 'live')}
                className="text-blue-600"
              />
              <span className="text-sm">
                <strong>Live</strong> - Save new entries to database
              </span>
            </label>
          </div>
        </div>

        <button
          onClick={runTest}
          disabled={testing}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          <PlayCircle size={20} />
          {testing ? 'Running Test...' : 'Run Scraper Test'}
        </button>
      </div>

      {testResult && (
        <div className="space-y-4 mt-6">
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Test Results</h3>

            {testResult.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Found</p>
                  <p className="text-2xl font-bold text-gray-900">{testResult.summary.total_entries_found}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-600">Winding Up</p>
                  <p className="text-2xl font-bold text-red-900">{testResult.summary.winding_up_petitions}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-orange-600">Petitions</p>
                  <p className="text-2xl font-bold text-orange-900">{testResult.summary.petitions}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600">New Entries</p>
                  <p className="text-2xl font-bold text-green-900">{testResult.summary.new_entries}</p>
                </div>
              </div>
            )}

            {testResult.error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                <p className="font-semibold text-red-900">Test Failed</p>
                <p className="text-sm text-red-800 mt-1">{testResult.error}</p>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 mb-3">
                Execution Log ({testResult.logs.length} steps)
              </h4>
              {testResult.logs.map((log, index) => (
                <div
                  key={index}
                  className={`border rounded-lg ${getStatusColor(log.status)}`}
                >
                  <button
                    onClick={() => toggleLog(index)}
                    className="w-full flex items-center justify-between p-3 text-left hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(log.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            Step {log.step_number}: {log.step.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({log.execution_time_ms}ms)
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{log.message}</p>
                      </div>
                    </div>
                    {expandedLogs.has(index) ? (
                      <ChevronDown className="text-gray-500" size={20} />
                    ) : (
                      <ChevronRight className="text-gray-500" size={20} />
                    )}
                  </button>

                  {expandedLogs.has(index) && (log.data || log.error_message) && (
                    <div className="border-t border-current/10 p-3 bg-white/50">
                      {log.error_message && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-red-900 mb-1">Error Details:</p>
                          <pre className="text-xs text-red-800 bg-red-50 p-2 rounded overflow-x-auto">
                            {log.error_message}
                          </pre>
                        </div>
                      )}
                      {log.data && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-1">Data:</p>
                          <pre className="text-xs text-gray-600 bg-white p-2 rounded overflow-x-auto max-h-96">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {testResult.summary && (
              <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Execution Time:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {testResult.summary.total_execution_time_ms}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Test Mode:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {testMode === 'dry_run' ? 'Dry Run (No Data Saved)' : 'Live (Data Saved)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Successful Steps:</span>
                    <span className="ml-2 font-medium text-green-900">
                      {testResult.summary.successful_steps}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Failed Steps:</span>
                    <span className="ml-2 font-medium text-red-900">
                      {testResult.summary.failed_steps}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

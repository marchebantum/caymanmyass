import { FormEvent } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import type { MonitorSignal } from './monitor/types';

export type MonitorFiltersState = {
  query: string;
  signals: MonitorSignal[];
  source: 'all' | 'gdelt' | 'newsapi';
  from: string;
  to: string;
};

interface MonitorFiltersProps {
  value: MonitorFiltersState;
  onChange: (value: MonitorFiltersState) => void;
  onApply: () => void;
  onReset: () => void;
  isLoading?: boolean;
}

const SIGNAL_OPTIONS: { key: MonitorSignal; label: string }[] = [
  { key: 'fraud', label: 'Fraud' },
  { key: 'financial_decline', label: 'Financial Decline' },
  { key: 'enforcement', label: 'Enforcement' },
  { key: 'misstated_financials', label: 'Misstated Financials' },
  { key: 'shareholder_issues', label: 'Shareholder Issues' },
  { key: 'director_duties', label: 'Director Duties' },
];

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'gdelt', label: 'GDELT' },
  { value: 'newsapi', label: 'NewsAPI' },
];

export function MonitorFilters({ value, onChange, onApply, onReset, isLoading }: MonitorFiltersProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onApply();
  };

  const toggleSignal = (signal: MonitorSignal) => {
    const exists = value.signals.includes(signal);
    const nextSignals = exists ? value.signals.filter((s) => s !== signal) : [...value.signals, signal];
    onChange({ ...value, signals: nextSignals });
  };

  const updateField = <K extends keyof MonitorFiltersState>(key: K, fieldValue: MonitorFiltersState[K]) => {
    onChange({ ...value, [key]: fieldValue });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Narrow down monitored articles</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          Clear
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="search"
          value={value.query}
          onChange={(event) => updateField('query', event.target.value)}
          placeholder="Search title or excerpt"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Signals */}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Risk Signals</p>
        <div className="grid grid-cols-1 gap-2">
          {SIGNAL_OPTIONS.map((option) => {
            const checked = value.signals.includes(option.key);
            return (
              <label
                key={option.key}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                  checked
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:bg-blue-50/60 dark:hover:border-blue-500'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSignal(option.key)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Source */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Source</label>
        <select
          value={value.source}
          onChange={(event) => updateField('source', event.target.value as MonitorFiltersState['source'])}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Date Range */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">From Date</label>
          <input
            type="date"
            value={value.from}
            max={value.to || undefined}
            onChange={(event) => updateField('from', event.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">To Date</label>
          <input
            type="date"
            value={value.to}
            min={value.from || undefined}
            onChange={(event) => updateField('to', event.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors"
        disabled={isLoading}
      >
        <RefreshCw className={isLoading ? 'animate-spin' : ''} size={18} />
        Apply Filters
      </button>
    </form>
  );
}


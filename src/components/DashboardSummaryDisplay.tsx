import React from 'react';
import { Copy, Download } from 'lucide-react';

interface DashboardSummaryDisplayProps {
  summary: string;
  tokensUsed?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    openai_tokens?: number;
    anthropic_tokens?: number;
    total_cost?: number;
  };
  onCopy: () => void;
  onExport: () => void;
  onClear: () => void;
}

export function DashboardSummaryDisplay({
  summary,
  tokensUsed,
  onCopy,
  onExport,
  onClear,
}: DashboardSummaryDisplayProps) {
  const sections = parseSummary(summary);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Dashboard Summary</h3>
          {tokensUsed && (
            <div className="text-xs text-gray-500">
              <span className="font-medium">Tokens:</span> {tokensUsed.total_tokens || (tokensUsed.openai_tokens || 0) + (tokensUsed.anthropic_tokens || 0)}
              {tokensUsed.total_cost !== undefined && (
                <>
                  {' | '}
                  <span className="font-medium">Cost:</span> ${tokensUsed.total_cost.toFixed(4)}
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCopy}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Copy size={16} />
            Copy
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download size={16} />
            Export
          </button>
          <button
            onClick={onClear}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {sections.companyOverview && (
          <DashboardSection title="Company Overview" content={sections.companyOverview} />
        )}

        {sections.legalDetails && (
          <DashboardSection title="Legal Details" content={sections.legalDetails} />
        )}

        {sections.timeline && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-md font-semibold text-gray-900 mb-3">Key Timeline</h4>
            <div className="overflow-x-auto">
              {renderTimeline(sections.timeline)}
            </div>
          </div>
        )}

        {sections.financialSummary && (
          <DashboardSection title="Financial Summary" content={sections.financialSummary} />
        )}

        {sections.insolvencyPractitioners && (
          <DashboardSection title="Insolvency Practitioners" content={sections.insolvencyPractitioners} />
        )}

        {sections.creditorInformation && (
          <DashboardSection title="Creditor Information" content={sections.creditorInformation} />
        )}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Raw Markdown</h4>
        <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
          {summary}
        </pre>
      </div>
    </div>
  );
}

function DashboardSection({ title, content }: { title: string; content: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h4 className="text-md font-semibold text-gray-900 mb-3">{title}</h4>
      <div className="prose prose-sm max-w-none">
        {content.split('\n').map((line, idx) => {
          const trimmedLine = line.trim();
          if (!trimmedLine) return null;

          if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
            const bulletContent = trimmedLine.startsWith('- ') ? trimmedLine.substring(2) : trimmedLine.substring(2);
            return (
              <div key={idx} className="flex items-start gap-2 mb-2">
                <span className="text-blue-600 mt-1">•</span>
                <span className="text-gray-700 flex-1">{renderMarkdown(bulletContent)}</span>
              </div>
            );
          }

          if (trimmedLine.includes('→')) {
            return (
              <div key={idx} className="flex items-center gap-2 mb-2 bg-blue-50 px-3 py-2 rounded">
                <span className="text-gray-700">{renderMarkdown(trimmedLine)}</span>
              </div>
            );
          }

          return (
            <p key={idx} className="text-gray-700 mb-2">
              {renderMarkdown(trimmedLine)}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function renderMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  let key = 0;

  const boldPattern = /\*\*(.+?)\*\*/g;
  let match;

  const matches: Array<{ start: number; end: number; content: string }> = [];
  while ((match = boldPattern.exec(text)) !== null) {
    matches.push({ start: match.index, end: match.index + match[0].length, content: match[1] });
  }

  if (matches.length === 0) {
    return text;
  }

  for (const m of matches) {
    if (m.start > currentIndex) {
      parts.push(text.substring(currentIndex, m.start));
    }
    parts.push(<strong key={key++} className="font-semibold text-gray-900">{m.content}</strong>);
    currentIndex = m.end;
  }

  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }

  return <>{parts}</>;
}

function renderTimeline(timelineText: string) {
  const lines = timelineText.split('\n').map(l => l.trim()).filter(Boolean);

  const tableRows = lines.filter(line =>
    line.includes('|') && !line.startsWith('|--') && !line.includes('Date')
  );

  if (tableRows.length === 0) {
    return <p className="text-gray-500 text-sm">No timeline data available</p>;
  }

  const rows = tableRows.map(line => {
    const parts = line.split('|').map(p => p.trim()).filter(Boolean);
    return { date: parts[0] || '', event: parts[1] || '' };
  });

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Date
          </th>
          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Event
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {rows.map((row, idx) => (
          <tr key={idx} className="hover:bg-gray-50">
            <td className="px-4 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">
              {row.date}
            </td>
            <td className="px-4 py-2 text-sm text-gray-700">
              {row.event}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function parseSummary(summary: string) {
  return {
    companyOverview: extractSection(summary, 'Company Overview', 'Legal Details') || extractSection(summary, '## Company Overview', '## Legal Details') || extractSection(summary, '1. COMPANY OVERVIEW', '2. LEGAL DETAILS'),
    legalDetails: extractSection(summary, 'Legal Details', 'Key Timeline') || extractSection(summary, '## Legal Details', '## Key Timeline') || extractSection(summary, '2. LEGAL DETAILS', '3. KEY TIMELINE'),
    timeline: extractSection(summary, 'Key Timeline', 'Financial Summary') || extractSection(summary, '## Key Timeline', '## Financial Summary') || extractSection(summary, '3. KEY TIMELINE', '4. FINANCIAL SUMMARY'),
    financialSummary: extractSection(summary, 'Financial Summary', 'Insolvency Practitioners') || extractSection(summary, '## Financial Summary', '## Insolvency Practitioners') || extractSection(summary, '4. FINANCIAL SUMMARY', '5. INSOLVENCY PRACTITIONERS'),
    insolvencyPractitioners: extractSection(summary, 'Insolvency Practitioners', 'Creditor Information') || extractSection(summary, '## Insolvency Practitioners', '## Creditor Information') || extractSection(summary, '5. INSOLVENCY PRACTITIONERS', '6. CREDITOR INFORMATION') || extractSection(summary, '5. INSOLVENCY PRACTITIONERS', '---'),
    creditorInformation: extractSection(summary, 'Creditor Information', '---') || extractSection(summary, '## Creditor Information', '---') || extractSection(summary, '6. CREDITOR INFORMATION', '---'),
  };
}

function extractSection(text: string, startMarker: string, endMarker: string): string {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return '';

  const endIdx = text.indexOf(endMarker, startIdx);
  const section = endIdx === -1 ? text.slice(startIdx) : text.slice(startIdx, endIdx);

  return section.replace(startMarker, '').trim();
}

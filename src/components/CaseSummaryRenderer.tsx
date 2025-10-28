import { FileText, Calendar, DollarSign, Users, Scale, AlertCircle } from 'lucide-react';

interface CaseSummaryRendererProps {
  summary: string;
}

export function CaseSummaryRenderer({ summary }: CaseSummaryRendererProps) {
  const sections = parseSummaryIntoSections(summary);

  return (
    <div className="space-y-6">
      {sections.companyOverview && (
        <SummarySection
          icon={<FileText className="text-blue-600" size={20} />}
          title="Company Overview"
          content={sections.companyOverview}
        />
      )}

      {sections.legalDetails && (
        <SummarySection
          icon={<Scale className="text-purple-600" size={20} />}
          title="Legal Details"
          content={sections.legalDetails}
        />
      )}

      {sections.timeline && (
        <SummarySection
          icon={<Calendar className="text-green-600" size={20} />}
          title="Key Timeline"
          content={sections.timeline}
          isTimeline
        />
      )}

      {sections.financialSummary && (
        <SummarySection
          icon={<DollarSign className="text-emerald-600" size={20} />}
          title="Financial Summary"
          content={sections.financialSummary}
        />
      )}

      {sections.insolvencyPractitioners && (
        <SummarySection
          icon={<Users className="text-orange-600" size={20} />}
          title="Insolvency Practitioners"
          content={sections.insolvencyPractitioners}
        />
      )}

      {sections.creditorInformation && (
        <SummarySection
          icon={<AlertCircle className="text-red-600" size={20} />}
          title="Creditor Information"
          content={sections.creditorInformation}
        />
      )}
    </div>
  );
}

interface SummarySectionProps {
  icon: React.ReactNode;
  title: string;
  content: string;
  isTimeline?: boolean;
}

function SummarySection({ icon, title, content, isTimeline }: SummarySectionProps) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="text-sm text-gray-700">
        {isTimeline ? renderTimeline(content) : renderContent(content)}
      </div>
    </div>
  );
}

function renderContent(content: string) {
  const lines = content.split('\n').filter(line => line.trim());

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        line = line.trim();

        if (line.startsWith('- ') || line.startsWith('• ')) {
          const bulletContent = line.substring(2).trim();
          return (
            <div key={index} className="flex gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>{formatInlineStyles(bulletContent)}</span>
            </div>
          );
        }

        if (line.match(/^\d+\./)) {
          return (
            <div key={index} className="flex gap-2">
              <span className="font-semibold text-gray-600">{line.match(/^\d+\./)?.[0]}</span>
              <span>{formatInlineStyles(line.replace(/^\d+\.\s*/, ''))}</span>
            </div>
          );
        }

        return <p key={index}>{formatInlineStyles(line)}</p>;
      })}
    </div>
  );
}

function renderTimeline(content: string) {
  const lines = content.split('\n').filter(line => line.trim());
  const tableRows: Array<{ date: string; event: string }> = [];
  let inTable = false;

  for (const line of lines) {
    if (line.includes('|') && !line.includes('Date') && !line.includes('---')) {
      const parts = line.split('|').map(p => p.trim()).filter(p => p);
      if (parts.length >= 2) {
        tableRows.push({ date: parts[0], event: parts[1] });
        inTable = true;
      }
    } else if (!line.includes('|') && !line.includes('---') && line.trim() && !inTable) {
      return renderContent(content);
    }
  }

  if (tableRows.length === 0) {
    return renderContent(content);
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Event</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {tableRows.map((row, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">{row.date}</td>
              <td className="px-4 py-2 text-sm text-gray-700">{formatInlineStyles(row.event)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatInlineStyles(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  let key = 0;

  const boldPattern = /\*\*(.+?)\*\*/g;
  let match;

  const matches: Array<{ start: number; end: number; content: string }> = [];
  while ((match = boldPattern.exec(text)) !== null) {
    matches.push({ start: match.index, end: match.index + match[0].length, content: match[1] });
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

  return parts.length > 0 ? <>{parts}</> : text;
}

function parseSummaryIntoSections(summary: string): {
  companyOverview?: string;
  legalDetails?: string;
  timeline?: string;
  financialSummary?: string;
  insolvencyPractitioners?: string;
  creditorInformation?: string;
} {
  const sections: any = {};

  const companyMatch = extractSection(summary, /\*\*Company Overview\*\*|## Company Overview|\*\*1\. COMPANY OVERVIEW\*\*|1\. COMPANY OVERVIEW/, /\*\*Legal Details\*\*|## Legal Details|\*\*2\. LEGAL DETAILS\*\*|2\. LEGAL DETAILS/);
  if (companyMatch) sections.companyOverview = companyMatch;

  const legalMatch = extractSection(summary, /\*\*Legal Details\*\*|## Legal Details|\*\*2\. LEGAL DETAILS\*\*|2\. LEGAL DETAILS/, /\*\*Key Timeline\*\*|## Key Timeline|\*\*3\. KEY TIMELINE\*\*|3\. KEY TIMELINE/);
  if (legalMatch) sections.legalDetails = legalMatch;

  const timelineMatch = extractSection(summary, /\*\*Key Timeline\*\*|## Key Timeline|\*\*3\. KEY TIMELINE\*\*|3\. KEY TIMELINE/, /\*\*Financial Summary\*\*|## Financial Summary|\*\*4\. FINANCIAL SUMMARY\*\*|4\. FINANCIAL SUMMARY/);
  if (timelineMatch) sections.timeline = timelineMatch;

  const financialMatch = extractSection(summary, /\*\*Financial Summary\*\*|## Financial Summary|\*\*4\. FINANCIAL SUMMARY\*\*|4\. FINANCIAL SUMMARY/, /\*\*Insolvency Practitioners\*\*|## Insolvency Practitioners|\*\*5\. INSOLVENCY PRACTITIONERS\*\*|5\. INSOLVENCY PRACTITIONERS/);
  if (financialMatch) sections.financialSummary = financialMatch;

  const insolvencyMatch = extractSection(summary, /\*\*Insolvency Practitioners\*\*|## Insolvency Practitioners|\*\*5\. INSOLVENCY PRACTITIONERS\*\*|5\. INSOLVENCY PRACTITIONERS/, /\*\*Creditor Information\*\*|## Creditor Information|\*\*6\. CREDITOR INFORMATION\*\*|6\. CREDITOR INFORMATION|---|\*\*CRITICAL REQUIREMENTS/);
  if (insolvencyMatch) sections.insolvencyPractitioners = insolvencyMatch;

  const creditorMatch = extractSection(summary, /\*\*Creditor Information\*\*|## Creditor Information|\*\*6\. CREDITOR INFORMATION\*\*|6\. CREDITOR INFORMATION/, /---|\*\*CRITICAL REQUIREMENTS|# CRITICAL EXTRACTION/);
  if (creditorMatch) sections.creditorInformation = creditorMatch;

  return sections;
}

function extractSection(text: string, startPattern: RegExp, endPattern: RegExp): string | undefined {
  const startMatch = text.match(startPattern);
  if (!startMatch) return undefined;

  const startIndex = startMatch.index! + startMatch[0].length;
  const remainingText = text.substring(startIndex);

  const endMatch = remainingText.match(endPattern);
  const endIndex = endMatch ? endMatch.index! : remainingText.length;

  const section = remainingText.substring(0, endIndex).trim();
  return section || undefined;
}

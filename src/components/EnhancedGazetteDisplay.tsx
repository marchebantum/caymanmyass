import { useState, useMemo } from 'react';
import { Search, X, Download, FileDown, ChevronDown, ChevronRight, Mail, Scale, Calendar, FileText } from 'lucide-react';

interface SummaryStats {
  totalEntities: number;
  companiesVoluntary: number;
  companiesCourtOrdered: number;
  partnershipsVoluntary: number;
  entitiesWithFinalMeetings: number;
}

interface GazetteMetadata {
  type: string;
  issueNumber: string;
  publicationDate: string;
}

interface LiquidationNotice {
  id: string;
  company_name: string;
  entity_type: string;
  registration_no: string | null;
  liquidation_type: string;
  liquidators: string[] | any;
  contact_emails: string[] | any;
  court_cause_no: string | null;
  liquidation_date: string | null;
  final_meeting_date: string | null;
  notes: string | null;
}

interface EnhancedGazetteDisplayProps {
  notices: LiquidationNotice[];
  summaryStats?: SummaryStats;
  gazetteMetadata?: GazetteMetadata;
  onClose?: () => void;
}

export function EnhancedGazetteDisplay({ notices, summaryStats, gazetteMetadata, onClose }: EnhancedGazetteDisplayProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string[]>([]);
  const [liquidationTypeFilter, setLiquidationTypeFilter] = useState<string[]>([]);
  const [hasFinalMeeting, setHasFinalMeeting] = useState(false);
  const [hasCourtCause, setHasCourtCause] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<string>('company_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Parse liquidators and contact_emails if they're JSONB
  const normalizeNotices = (notices: LiquidationNotice[]): LiquidationNotice[] => {
    return notices.map(notice => ({
      ...notice,
      liquidators: Array.isArray(notice.liquidators) ? notice.liquidators :
                   (typeof notice.liquidators === 'string' ? JSON.parse(notice.liquidators) : []),
      contact_emails: Array.isArray(notice.contact_emails) ? notice.contact_emails :
                      (typeof notice.contact_emails === 'string' ? JSON.parse(notice.contact_emails) : []),
    }));
  };

  const normalizedNotices = normalizeNotices(notices);

  // Filtered and sorted notices
  const filteredNotices = useMemo(() => {
    let filtered = normalizedNotices.filter(notice => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        notice.company_name.toLowerCase().includes(searchLower) ||
        (notice.registration_no?.toLowerCase() || '').includes(searchLower) ||
        notice.liquidators.some((liq: string) => liq.toLowerCase().includes(searchLower));

      const matchesEntityType = entityTypeFilter.length === 0 || entityTypeFilter.includes(notice.entity_type);
      const matchesLiquidationType = liquidationTypeFilter.length === 0 || liquidationTypeFilter.includes(notice.liquidation_type);
      const matchesFinalMeeting = !hasFinalMeeting || notice.final_meeting_date !== null;
      const matchesCourtCause = !hasCourtCause || notice.court_cause_no !== null;

      return matchesSearch && matchesEntityType && matchesLiquidationType && matchesFinalMeeting && matchesCourtCause;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[sortField as keyof LiquidationNotice];
      let bVal: any = b[sortField as keyof LiquidationNotice];

      if (aVal === null) aVal = '';
      if (bVal === null) bVal = '';

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [normalizedNotices, searchTerm, entityTypeFilter, liquidationTypeFilter, hasFinalMeeting, hasCourtCause, sortField, sortDirection]);

  function toggleEntityTypeFilter(type: string) {
    setEntityTypeFilter(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }

  function toggleLiquidationTypeFilter(type: string) {
    setLiquidationTypeFilter(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }

  function clearAllFilters() {
    setSearchTerm('');
    setEntityTypeFilter([]);
    setLiquidationTypeFilter([]);
    setHasFinalMeeting(false);
    setHasCourtCause(false);
  }

  function toggleRowExpansion(id: string) {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  function handleExportCSV() {
    const headers = ['Entity Name', 'Entity Type', 'Registration No', 'Liquidation Type', 'Liquidation Date', 'Final Meeting Date', 'Liquidators', 'Contact Emails', 'Court Cause No', 'Notes'];
    const rows = filteredNotices.map(notice => [
      notice.company_name,
      notice.entity_type,
      notice.registration_no || '',
      notice.liquidation_type,
      notice.liquidation_date || '',
      notice.final_meeting_date || '',
      notice.liquidators.join('; '),
      notice.contact_emails.join('; '),
      notice.court_cause_no || '',
      notice.notes || '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gazette-notices-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportJSON() {
    const dataStr = JSON.stringify(
      {
        gazette_metadata: gazetteMetadata,
        summary: summaryStats,
        notices_count: filteredNotices.length,
        notices: filteredNotices,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gazette-notices-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const activeFilterCount = entityTypeFilter.length + liquidationTypeFilter.length + (hasFinalMeeting ? 1 : 0) + (hasCourtCause ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Summary Stats Dashboard */}
      {summaryStats && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Summary Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-3xl font-bold text-gray-900">{summaryStats.totalEntities}</div>
              <div className="text-xs text-gray-600 mt-2 font-medium">Total Entities</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-3xl font-bold text-green-700">{summaryStats.companiesVoluntary}</div>
              <div className="text-xs text-green-600 mt-2 font-medium">Voluntary (Co.)</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="text-3xl font-bold text-red-700">{summaryStats.companiesCourtOrdered}</div>
              <div className="text-xs text-red-600 mt-2 font-medium">Court-Ordered</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-3xl font-bold text-blue-700">{summaryStats.partnershipsVoluntary}</div>
              <div className="text-xs text-blue-600 mt-2 font-medium">Partnerships</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-3xl font-bold text-orange-700">{summaryStats.entitiesWithFinalMeetings}</div>
              <div className="text-xs text-orange-600 mt-2 font-medium">Final Meetings</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Filters & Search</h3>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear All ({activeFilterCount})
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by entity name, registration no, or liquidator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Filter Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Entity Type</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={entityTypeFilter.includes('Company')}
                  onChange={() => toggleEntityTypeFilter('Company')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Companies</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={entityTypeFilter.includes('Partnership')}
                  onChange={() => toggleEntityTypeFilter('Partnership')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Partnerships</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Liquidation Type</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={liquidationTypeFilter.includes('Voluntary')}
                  onChange={() => toggleLiquidationTypeFilter('Voluntary')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Voluntary</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={liquidationTypeFilter.includes('Court-Ordered')}
                  onChange={() => toggleLiquidationTypeFilter('Court-Ordered')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Court-Ordered</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Special Filters</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={hasFinalMeeting}
                  onChange={() => setHasFinalMeeting(!hasFinalMeeting)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Has Final Meeting</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={hasCourtCause}
                  onChange={() => setHasCourtCause(!hasCourtCause)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Has Court Cause No</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Export</label>
            <div className="space-y-2">
              <button
                onClick={handleExportCSV}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
              >
                <FileDown size={16} />
                CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
              >
                <Download size={16} />
                JSON
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                Search: "{searchTerm}"
                <button onClick={() => setSearchTerm('')} className="hover:bg-blue-200 rounded-full p-0.5">
                  <X size={14} />
                </button>
              </span>
            )}
            {entityTypeFilter.map(type => (
              <span key={type} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                {type}
                <button onClick={() => toggleEntityTypeFilter(type)} className="hover:bg-blue-200 rounded-full p-0.5">
                  <X size={14} />
                </button>
              </span>
            ))}
            {liquidationTypeFilter.map(type => (
              <span key={type} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                {type}
                <button onClick={() => toggleLiquidationTypeFilter(type)} className="hover:bg-blue-200 rounded-full p-0.5">
                  <X size={14} />
                </button>
              </span>
            ))}
            {hasFinalMeeting && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                Has Final Meeting
                <button onClick={() => setHasFinalMeeting(false)} className="hover:bg-blue-200 rounded-full p-0.5">
                  <X size={14} />
                </button>
              </span>
            )}
            {hasCourtCause && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                Has Court Cause No
                <button onClick={() => setHasCourtCause(false)} className="hover:bg-blue-200 rounded-full p-0.5">
                  <X size={14} />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Liquidation Notices</h3>
            <p className="text-sm text-gray-600 mt-1">
              Showing {filteredNotices.length} of {normalizedNotices.length} {filteredNotices.length === 1 ? 'notice' : 'notices'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-8"></th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('company_name')}
                >
                  Entity Name {sortField === 'company_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('entity_type')}
                >
                  Type {sortField === 'entity_type' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('liquidation_type')}
                >
                  Liquidation {sortField === 'liquidation_type' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('liquidation_date')}
                >
                  Date {sortField === 'liquidation_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Indicators
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredNotices.map((notice) => (
                <>
                  <tr key={notice.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRowExpansion(notice.id)}>
                    <td className="px-2 py-3">
                      {expandedRows.has(notice.id) ? <ChevronDown size={16} className="text-gray-600" /> : <ChevronRight size={16} className="text-gray-600" />}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {notice.company_name}
                      {notice.registration_no && (
                        <div className="text-xs text-gray-500 mt-0.5">{notice.registration_no}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        notice.entity_type === 'Partnership' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {notice.entity_type === 'Partnership' ? 'Partnership' : 'Company'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        notice.liquidation_type === 'Voluntary' ? 'bg-green-100 text-green-800' :
                        notice.liquidation_type === 'Court-Ordered' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {notice.liquidation_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(notice.liquidation_date)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        {notice.court_cause_no && (
                          <span className="inline-flex items-center text-red-600" title={`Court Cause: ${notice.court_cause_no}`}>
                            <Scale size={16} />
                          </span>
                        )}
                        {notice.final_meeting_date && (
                          <span className="inline-flex items-center text-orange-600" title={`Final Meeting: ${formatDate(notice.final_meeting_date)}`}>
                            <Calendar size={16} />
                          </span>
                        )}
                        {notice.contact_emails.length > 0 && (
                          <span className="inline-flex items-center text-blue-600" title="Has contact emails">
                            <Mail size={16} />
                          </span>
                        )}
                        {notice.notes && (
                          <span className="inline-flex items-center text-gray-600" title="Has additional notes">
                            <FileText size={16} />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Row Details */}
                  {expandedRows.has(notice.id) && (
                    <tr key={`${notice.id}-expanded`}>
                      <td colSpan={6} className="px-4 py-4 bg-gray-50">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">Entity Information</h4>
                            <dl className="space-y-2">
                              <div>
                                <dt className="text-gray-600 font-medium">Full Name:</dt>
                                <dd className="text-gray-900">{notice.company_name}</dd>
                              </div>
                              <div>
                                <dt className="text-gray-600 font-medium">Registration No:</dt>
                                <dd className="text-gray-900">{notice.registration_no || 'N/A'}</dd>
                              </div>
                              <div>
                                <dt className="text-gray-600 font-medium">Entity Type:</dt>
                                <dd className="text-gray-900">{notice.entity_type}</dd>
                              </div>
                              <div>
                                <dt className="text-gray-600 font-medium">Liquidation Type:</dt>
                                <dd className="text-gray-900">{notice.liquidation_type}</dd>
                              </div>
                            </dl>
                          </div>

                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">Liquidation Details</h4>
                            <dl className="space-y-2">
                              <div>
                                <dt className="text-gray-600 font-medium">Liquidation Date:</dt>
                                <dd className="text-gray-900">{formatDate(notice.liquidation_date)}</dd>
                              </div>
                              <div>
                                <dt className="text-gray-600 font-medium">Court Cause No:</dt>
                                <dd className="text-gray-900">{notice.court_cause_no || 'N/A'}</dd>
                              </div>
                              <div>
                                <dt className="text-gray-600 font-medium">Final Meeting Date:</dt>
                                <dd className="text-gray-900">{formatDate(notice.final_meeting_date)}</dd>
                              </div>
                            </dl>
                          </div>

                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">Liquidators</h4>
                            <ul className="list-disc list-inside space-y-1 text-gray-900">
                              {notice.liquidators.map((liq: string, i: number) => (
                                <li key={i}>{liq}</li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">Contact Information</h4>
                            {notice.contact_emails.length > 0 ? (
                              <ul className="space-y-1">
                                {notice.contact_emails.map((email: string, i: number) => (
                                  <li key={i}>
                                    <a href={`mailto:${email}`} className="text-blue-600 hover:underline flex items-center gap-1">
                                      <Mail size={14} />
                                      {email}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-gray-500">No contact emails provided</p>
                            )}
                          </div>

                          {notice.notes && (
                            <div className="col-span-2">
                              <h4 className="font-semibold text-gray-900 mb-2">Additional Notes</h4>
                              <p className="text-gray-700 text-sm">{notice.notes}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {filteredNotices.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No notices match your current filters.
            </div>
          )}
        </div>
      </div>

      {onClose && (
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

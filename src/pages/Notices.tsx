import { useEffect, useState } from 'react';
import { Search, Copy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { GazetteNotice, Liquidator } from '../lib/database.types';

export function Notices() {
  const [notices, setNotices] = useState<GazetteNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [appointmentTypeFilter, setAppointmentTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadNotices();
  }, []);

  async function loadNotices() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('gazette_notices')
        .select('*')
        .order('appointment_date', { ascending: false });

      if (error) throw error;
      setNotices(data || []);
    } catch (error) {
      console.error('Error loading notices:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredNotices = notices.filter(notice => {
    const matchesSearch = notice.company_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = appointmentTypeFilter === 'all' || notice.appointment_type?.toLowerCase().includes(appointmentTypeFilter.toLowerCase());
    return matchesSearch && matchesType;
  });

  function formatDate(dateString: string | null) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getLiquidatorName(liquidators: any): string {
    if (!liquidators || !Array.isArray(liquidators) || liquidators.length === 0) {
      return 'N/A';
    }
    const first = liquidators[0] as Liquidator;
    return first.name || 'N/A';
  }

  function getLiquidatorContact(liquidators: any): string {
    if (!liquidators || !Array.isArray(liquidators) || liquidators.length === 0) {
      return 'N/A';
    }
    const first = liquidators[0] as Liquidator;
    const parts = [];
    if (first.phones && first.phones.length > 0) {
      parts.push(first.phones[0]);
    }
    if (first.emails && first.emails.length > 0) {
      parts.push(first.emails[0]);
    }
    return parts.length > 0 ? parts.join(' • ') : 'N/A';
  }

  function copyContact(liquidators: any) {
    if (!liquidators || !Array.isArray(liquidators)) return;

    const contactInfo = liquidators.map((liq: Liquidator) => {
      const parts = [
        liq.name,
        liq.firm,
        ...(liq.phones || []),
        ...(liq.emails || []),
        liq.address
      ].filter(Boolean);
      return parts.join('\n');
    }).join('\n\n');

    navigator.clipboard.writeText(contactInfo);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Liquidation Notices</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Companies in liquidation from gazette notices</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Search by company name or liquidator..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          <select
            value={appointmentTypeFilter}
            onChange={(e) => setAppointmentTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Types</option>
            <option value="voluntary liquidation">Voluntary Liquidation</option>
            <option value="official liquidation">Official Liquidation</option>
            <option value="receivership">Receivership</option>
            <option value="creditor notice">Creditor Notice</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Loading notices...
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No notices found. Run a gazette scrape to fetch data.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Appointment Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Liquidator
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredNotices.map((notice) => (
                  <tr key={notice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {notice.company_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {notice.appointment_type || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(notice.appointment_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {getLiquidatorName(notice.liquidators)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {getLiquidatorContact(notice.liquidators)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => copyContact(notice.liquidators)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                        title="Copy contact info"
                      >
                        <Copy size={16} />
                      </button>
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
          Showing {filteredNotices.length} of {notices.length} notices
        </p>
      </div>
    </div>
  );
}

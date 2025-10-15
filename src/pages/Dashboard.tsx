import { useEffect, useState } from 'react';
import { FileText, BookOpen, AlertTriangle, PlayCircle, Bell, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Notification } from '../lib/database.types';

export function Dashboard() {
  const [stats, setStats] = useState({
    totalRegistryCases: 0,
    newNoticesThisWeek: 0,
    awaitingPdfs: 0,
    loading: true,
    error: null as string | null,
  });

  const [jobs, setJobs] = useState({
    lastRegistryRun: null as string | null,
    lastGazetteRegularRun: null as string | null,
    lastGazetteExtraordinaryRun: null as string | null,
  });

  const [runningJob, setRunningJob] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [newCaseNotification, setNewCaseNotification] = useState<{
    show: boolean;
    count: number;
    cases: string[];
  }>({ show: false, count: 0, cases: [] });

  useEffect(() => {
    loadStats();
    loadJobStatus();
    loadNotifications();

    const notificationsChannel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    const registryChannel = supabase
      .channel('registry_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registry_rows' },
        () => {
          loadStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(registryChannel);
    };
  }, []);

  async function loadStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [registryResult, noticesResult, awaitingResult] = await Promise.all([
        supabase
          .from('registry_rows')
          .select('id', { count: 'exact', head: true }),

        supabase
          .from('gazette_notices')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', weekAgo.toISOString()),

        supabase
          .from('registry_rows')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'awaiting_pdf'),
      ]);

      setStats({
        totalRegistryCases: registryResult.count || 0,
        newNoticesThisWeek: noticesResult.count || 0,
        awaitingPdfs: awaitingResult.count || 0,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats(prev => ({ ...prev, loading: false, error: error instanceof Error ? error.message : 'Failed to load statistics' }));
    }
  }

  async function loadJobStatus() {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('last_registry_run, last_gazette_regular_run, last_gazette_extraordinary_run')
        .maybeSingle();

      if (data) {
        setJobs({
          lastRegistryRun: data.last_registry_run,
          lastGazetteRegularRun: data.last_gazette_regular_run,
          lastGazetteExtraordinaryRun: data.last_gazette_extraordinary_run,
        });
      }
    } catch (error) {
      console.error('Error loading job status:', error);
    }
  }

  async function loadNotifications() {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }

  async function dismissNotification(id: string) {
    try {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);

      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  }

  function formatLastRun(timestamp: string | null): string {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  }

  async function runRegistryJob() {
    try {
      setRunningJob(true);
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-registry`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to run registry monitoring');

      const result = await response.json();

      await loadJobStatus();
      await loadStats();

      if (result.success && result.new_rows > 0) {
        setNewCaseNotification({
          show: true,
          count: result.new_rows,
          cases: result.new_cause_numbers || [],
        });
      } else if (result.success) {
        alert(`Registry monitoring completed. No new cases found.\n\nTotal petition entries: ${result.total_rows}`);
      }
    } catch (error) {
      console.error('Error running registry job:', error);
      alert('Failed to run registry monitoring. Please check the console for details.');
    } finally {
      setRunningJob(false);
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'critical':
        return 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-900 dark:text-red-300';
      case 'high':
        return 'bg-orange-50 dark:bg-orange-900/30 border-orange-500 text-orange-900 dark:text-orange-300';
      case 'medium':
        return 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-900 dark:text-blue-300';
      default:
        return 'bg-gray-50 dark:bg-gray-700 border-gray-500 text-gray-900 dark:text-gray-300';
    }
  }

  return (
    <div className="space-y-8">
      {stats.error && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-600 dark:text-red-400 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 dark:text-red-300 mb-1">Connection Error</h4>
              <p className="text-sm text-red-800 dark:text-red-200">{stats.error}</p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-2">Please check your Supabase configuration and ensure the database is accessible.</p>
            </div>
          </div>
        </div>
      )}
      {notifications.length > 0 && (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`border-l-4 p-4 rounded-lg ${getPriorityColor(notification.priority)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell size={20} />
                    <h3 className="font-bold">{notification.title}</h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-white dark:bg-gray-800 bg-opacity-50">
                      {notification.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm mb-2">{notification.message}</p>
                  {notification.data && typeof notification.data === 'object' && 'cause_numbers' in notification.data && (
                    <div className="text-sm">
                      <strong>Cases:</strong> {(notification.data.cause_numbers as string[]).join(', ')}
                    </div>
                  )}
                  <p className="text-xs mt-2 opacity-75 dark:opacity-60">
                    {new Date(notification.sent_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => dismissNotification(notification.id)}
                  className="hover:opacity-70 ml-4 text-current"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {newCaseNotification.show && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="text-blue-600" size={20} />
                <h3 className="font-bold text-blue-900 dark:text-blue-300">
                  {newCaseNotification.count} New Registry {newCaseNotification.count === 1 ? 'Case' : 'Cases'} Found!
                </h3>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                New petition entries have been detected. Please download the PDFs manually from the judicial.ky website and upload them in the Registry page.
              </p>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Cause Numbers:</strong> {newCaseNotification.cases.join(', ')}
              </div>
            </div>
            <button
              onClick={() => setNewCaseNotification({ show: false, count: 0, cases: [] })}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 ml-4"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Monitor Cayman Islands legal proceedings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Registry Cases</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.loading ? '...' : stats.totalRegistryCases}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Financial Services</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <FileText className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">New Gazette Notices</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.loading ? '...' : stats.newNoticesThisWeek}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This week</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <BookOpen className="text-green-600 dark:text-green-400" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Cases Awaiting PDFs</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.loading ? '...' : stats.awaitingPdfs}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Need attention</p>
            </div>
            <div className={`p-3 rounded-lg ${stats.awaitingPdfs > 5 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-amber-50 dark:bg-amber-900/30'}`}>
              <AlertTriangle className={stats.awaitingPdfs > 5 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'} size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Scheduled Jobs</h2>
          <button
            onClick={runRegistryJob}
            disabled={runningJob}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors"
          >
            <PlayCircle size={20} />
            {runningJob ? 'Checking...' : 'Check for New Cases'}
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Registry Monitor</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Check for new petition entries</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Last run</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{formatLastRun(jobs.lastRegistryRun)}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Active</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Gazette Regular</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Every 2 weeks on Monday 09:00 AM</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Last run</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{formatLastRun(jobs.lastGazetteRegularRun)}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Active</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Gazette Extraordinary</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Every Friday at 09:05 AM</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Last run</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{formatLastRun(jobs.lastGazetteExtraordinaryRun)}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Active</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">System Health & Automation</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Daily Automation</p>
            <div className="flex items-baseline gap-2 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">Active</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Runs daily at 7:00 AM</p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Next Scheduled Run</p>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {(() => {
                  const now = new Date();
                  const next = new Date(now);
                  next.setHours(7, 0, 0, 0);
                  if (next < now) {
                    next.setDate(next.getDate() + 1);
                  }
                  return next.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  });
                })()}
              </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cayman time (UTC-5)</p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Notifications</p>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{notifications.length}</p>
              <span className="text-xs text-gray-500 dark:text-gray-400">Unread</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Dashboard alerts active</p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
          <div className="flex items-start gap-3">
            <Bell className="text-blue-600 dark:text-blue-400 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Automated Monitoring Active</h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                The system automatically checks for new registry cases every day at 7:00 AM Cayman time.
                When new cases are detected, you'll see notifications here on the dashboard.
                No manual checking required.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

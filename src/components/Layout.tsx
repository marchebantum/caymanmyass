import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, FileText, BookOpen, Bell, Settings, AlertTriangle } from 'lucide-react';
import { DarkModeToggle } from './DarkModeToggle';

export function Layout() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/registry', icon: FileText, label: 'Registry' },
    { path: '/gazettes', icon: BookOpen, label: 'Gazettes' },
    { path: '/notices', icon: Bell, label: 'Notices' },
    { path: '/review', icon: AlertTriangle, label: 'Review Queue' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CAYMAN MY.ASS</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Legal Monitoring System</p>
          </div>
          <DarkModeToggle />
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>System Online</span>
            </div>
            <div>Version 1.0.0</div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

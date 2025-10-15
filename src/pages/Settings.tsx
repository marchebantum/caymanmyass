import { useEffect, useState } from 'react';
import { Save, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AppSettings } from '../lib/database.types';
import { ScraperTestPanel } from '../components/ScraperTestPanel';

export function Settings() {
  const [settings, setSettings] = useState<Partial<AppSettings>>({
    ocr_provider: 'pdfrest',
    ocr_api_key: '',
    firecrawl_api_key: '',
    firecrawl_enabled: false,
    automation_enabled: true,
    alert_email: '',
    slack_webhook: '',
    show_only_new: true,
    registry_schedule_time: '07:00',
    gazette_regular_schedule: 'biweekly_monday_0900',
    gazette_extraordinary_schedule: 'weekly_friday_0905',
    timezone: 'America/Cayman',
    notification_enabled: true,
    lookback_days: 7,
    openai_api_key: '',
    anthropic_api_key: '',
  });
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .single();

      if (error) throw error;
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setMessage(null);

      const { error } = await supabase
        .from('app_settings')
        .update(settings as any)
        .eq('id', '00000000-0000-0000-0000-000000000001');

      if (error) throw error;

      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Configure system preferences and integrations</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Automation Settings</h2>

          <div className="space-y-4">
            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
              <p className="text-sm text-green-800">
                <strong>Daily automation is active!</strong> The system automatically checks for new registry cases every day at {settings.registry_schedule_time} Cayman time.
                You'll receive dashboard notifications when new cases are detected.
              </p>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="automation_enabled"
                checked={settings.automation_enabled ?? true}
                onChange={(e) => setSettings({ ...settings, automation_enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="automation_enabled" className="text-sm font-medium text-gray-700">
                Enable daily automated monitoring
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Daily Check Time (Cayman Time)
              </label>
              <input
                type="time"
                value={settings.registry_schedule_time || '07:00'}
                onChange={(e) => setSettings({ ...settings, registry_schedule_time: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Note: Schedule changes require system restart to take effect
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Firecrawl Web Scraping</h2>

          <div className="space-y-4">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
              <p className="text-sm text-blue-800">
                Enable Firecrawl to automatically scrape the judicial.ky website for new cases. Get your API key from{' '}
                <a
                  href="https://www.firecrawl.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium hover:text-blue-900"
                >
                  firecrawl.dev
                </a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Firecrawl API Key
              </label>
              <input
                type="password"
                value={settings.firecrawl_api_key || ''}
                onChange={(e) => setSettings({ ...settings, firecrawl_api_key: e.target.value })}
                placeholder="fc-your-api-key"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                API key is securely stored in the database
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lookback Period (Days)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={settings.lookback_days || 7}
                onChange={(e) => setSettings({ ...settings, lookback_days: parseInt(e.target.value) || 7 })}
                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                How many days back to search for new cases (1-90 days)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="firecrawl_enabled"
                checked={settings.firecrawl_enabled || false}
                onChange={(e) => setSettings({ ...settings, firecrawl_enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="firecrawl_enabled" className="text-sm font-medium text-gray-700">
                Enable automated web scraping with Firecrawl
              </label>
            </div>

            <p className="text-xs text-gray-600">
              When enabled, the system will automatically scrape judicial.ky and detect new Financial Services petition and winding up cases from the last {settings.lookback_days || 7} days.
            </p>
          </div>
        </div>

        <hr className="border-gray-200" />

        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">LLM Configuration</h2>

          <div className="space-y-4">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
              <p className="text-sm text-blue-800">
                Configure AI providers for dashboard-ready case analysis. The system uses OpenAI for chunking and Anthropic Claude for final consolidation.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OpenAI API Key
              </label>
              <div className="relative">
                <input
                  type={showOpenAIKey ? 'text' : 'password'}
                  value={settings.openai_api_key || ''}
                  onChange={(e) => setSettings({ ...settings, openai_api_key: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showOpenAIKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Get your API key from{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-700"
                >
                  platform.openai.com/api-keys
                </a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Anthropic API Key
              </label>
              <div className="relative">
                <input
                  type={showAnthropicKey ? 'text' : 'password'}
                  value={settings.anthropic_api_key || ''}
                  onChange={(e) => setSettings({ ...settings, anthropic_api_key: e.target.value })}
                  placeholder="sk-ant-..."
                  className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showAnthropicKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Get your API key from{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-700"
                >
                  console.anthropic.com/settings/keys
                </a>
              </p>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-4">
              <p className="text-xs text-amber-800">
                <strong>Cost Estimate:</strong> Processing a typical 10-page PDF costs approximately $0.05-$0.15 depending on content density. Token usage is tracked per case.
              </p>
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">OCR Settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OCR Provider
              </label>
              <select
                value={settings.ocr_provider}
                onChange={(e) => setSettings({ ...settings, ocr_provider: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="pdfrest">pdfRest OCR</option>
                <option value="convertapi">ConvertAPI OCR</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OCR API Key
              </label>
              <input
                type="password"
                value={settings.ocr_api_key || ''}
                onChange={(e) => setSettings({ ...settings, ocr_api_key: e.target.value })}
                placeholder="Enter your OCR API key"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                API key is encrypted before storage
              </p>
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Notifications</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alert Email
              </label>
              <input
                type="email"
                value={settings.alert_email || ''}
                onChange={(e) => setSettings({ ...settings, alert_email: e.target.value })}
                placeholder="email@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Slack Webhook URL
              </label>
              <input
                type="url"
                value={settings.slack_webhook || ''}
                onChange={(e) => setSettings({ ...settings, slack_webhook: e.target.value })}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="notification_enabled"
                checked={settings.notification_enabled || false}
                onChange={(e) => setSettings({ ...settings, notification_enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="notification_enabled" className="text-sm font-medium text-gray-700">
                Enable notifications
              </label>
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Scheduling</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Registry Monitor Time
              </label>
              <input
                type="time"
                value={settings.registry_schedule_time || '07:00'}
                onChange={(e) => setSettings({ ...settings, registry_schedule_time: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Runs daily at this time</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timezone
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="America/Cayman">America/Cayman</option>
                <option value="America/New_York">America/New York</option>
                <option value="Europe/London">Europe/London</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="show_only_new"
                checked={settings.show_only_new || false}
                onChange={(e) => setSettings({ ...settings, show_only_new: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="show_only_new" className="text-sm font-medium text-gray-700">
                Only show new items since last run
              </label>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            <Save size={20} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <ScraperTestPanel />
    </div>
  );
}

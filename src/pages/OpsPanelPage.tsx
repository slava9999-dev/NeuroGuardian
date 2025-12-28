import { useState, useEffect } from 'react';

// Types for API responses
interface OpsEvent {
  id: string;
  event_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  entity_type: string;
  payload: any;
  created_at: string;
}

interface OpsMetric {
  totalEvents: number;
  totalAuditLogs: number;
  errorRate: number;
}

interface OpsDashboardResponse {
  metrics: OpsMetric;
  alerts: OpsEvent[];
}

export function OpsPanelPage({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'events' | 'audit' | 'chat'>(
    'dashboard'
  );
  const [metrics, setMetrics] = useState<OpsMetric | null>(null);
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([
    {
      role: 'assistant',
      content: '💬 Привет! Я системный администратор NeuroGUARDIAN. Чем могу помочь?',
    },
  ]);
  const [input, setInput] = useState('');

  // Admin Key storage (temporary input for MVP)
  const [adminKey, setAdminKey] = useState(localStorage.getItem('admin_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!adminKey);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api?action=ops-dashboard', {
        headers: { 'X-Admin-Key': adminKey },
      });
      if (res.ok) {
        const data: OpsDashboardResponse = await res.json();
        setMetrics(data.metrics);
      } else {
        console.error('Failed to fetch dashboard');
        if (res.status === 401) setIsAuthenticated(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api?action=ops-events&limit=50', {
        headers: { 'X-Admin-Key': adminKey },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api?action=agent-v4', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey,
        },
        body: JSON.stringify({
          message: userMsg.content,
          telegramId: '777000',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `❌ Ошибка: ${data.message || data.error}` },
        ]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Ошибка сети: ${e}` }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'dashboard') fetchDashboard();
      if (activeTab === 'events') fetchEvents();
    }
  }, [activeTab, isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('admin_key', adminKey);
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-200 p-6 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Ops Panel Access</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full max-w-sm">
          <input
            type="password"
            placeholder="Enter Admin API Key"
            value={adminKey}
            onChange={e => setAdminKey(e.target.value)}
            className="p-3 rounded bg-stone-900 border border-stone-800 focus:border-violet-500 outline-none"
          />
          <button type="submit" className="bg-violet-600 p-3 rounded font-bold hover:bg-violet-500">
            Login
          </button>
        </form>
        <button onClick={onBack} className="mt-4 text-stone-500">
          Back to App
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 pb-24">
      {/* Header */}
      <header className="sticky top-0 bg-stone-900/95 backdrop-blur border-b border-stone-800 p-4 z-10 flex justify-between items-center">
        <h1 className="text-xl font-bold text-violet-400">Ops Panel</h1>
        <div className="flex gap-2">
          <button onClick={fetchDashboard} className="p-2 bg-stone-800 rounded">
            ↻
          </button>
          <button onClick={onBack} className="p-2 bg-stone-800 rounded">
            ✕
          </button>
        </div>
      </header>

      <div className="flex p-4 gap-4 border-b border-stone-800 overflow-x-auto">
        {(['dashboard', 'events', 'audit', 'chat'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-violet-600 text-white' : 'bg-stone-900 text-stone-400'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {loading && <div className="text-stone-500 mb-4">Loading...</div>}

        {activeTab === 'dashboard' && metrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <MetricCard label="Total Events" value={metrics.totalEvents} color="blue" />
              <MetricCard label="Errors" value={metrics.errorRate} color="red" />
              <MetricCard label="Audit Logs" value={metrics.totalAuditLogs} color="emerald" />
              <MetricCard label="System Status" value="Online" color="green" />
            </div>

            <h2 className="text-lg font-bold text-stone-300">Live Feed Preview</h2>
            {/* Simple list of recent events would go here */}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-2">
            {events.map(event => (
              <div
                key={event.id}
                className="p-3 bg-stone-900 rounded border border-stone-800 text-sm"
              >
                <div className="flex justify-between mb-1">
                  <span
                    className={`font-mono px-2 py-0.5 rounded text-xs ${
                      event.severity === 'error' || event.severity === 'critical'
                        ? 'bg-red-900/50 text-red-400'
                        : 'bg-blue-900/50 text-blue-400'
                    }`}
                  >
                    {event.event_type}
                  </span>
                  <span className="text-stone-500">
                    {new Date(event.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="text-stone-400 overflow-x-auto text-xs">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-[calc(100vh-200px)]">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-2 bg-stone-900/50 rounded-lg">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-xl text-sm ${
                      m.role === 'user' ? 'bg-violet-600 text-white' : 'bg-stone-800 text-stone-300'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-stone-800 text-stone-500 p-3 rounded-xl text-xs animate-pulse">
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Спроси о логах, ошибках или статусе..."
                className="flex-1 p-3 bg-stone-800 border-stone-700 border rounded-xl text-white outline-none focus:border-violet-500"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-4 bg-violet-600 rounded-xl font-bold disabled:opacity-50"
              >
                ➤
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div
      className={`p-4 bg-stone-900 rounded-lg border border-stone-800 border-l-4 border-l-${color}-500`}
    >
      <div className="text-stone-500 text-xs uppercase mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// TYPES
// ============================================

interface OpsOverview {
  clients: {
    total: number;
    active: number;
    newToday: number;
  };
  integrations: {
    wb: { status: string; latency: number };
    ozon: { status: string; latency: number };
    n8n: { status: string; workflows_active: number };
    security: { status: string; policy_version: string };
  };
  recent_events: OpsEvent[];
}

interface OpsEvent {
  id: number; // Changed to number to match DB
  event_type: string;
  payload: any;
  created_at: string;
  user_id?: number;
}

interface ClientUser {
  id: number;
  first_name: string;
  username: string;
  is_active: boolean;
  subscription_plan: string;
  total_products: number;
  created_at: string;
  platforms: string[];
}

// ============================================
// COMPONENT
// ============================================

export function OpsPanelPage({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'audit' | 'n8n'>('overview');
  const [loading, setLoading] = useState(false);

  // Data State
  const [overview, setOverview] = useState<OpsOverview | null>(null);
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [events, setEvents] = useState<OpsEvent[]>([]);

  // Auth State
  const [adminKey, setAdminKey] = useState(localStorage.getItem('admin_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!adminKey);

  // Pagination for clients
  const [clientsPage, setClientsPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // ============================================
  // API CALLS
  // ============================================

  const apiFetch = async (endpoint: string) => {
    const res = await fetch(endpoint, {
      headers: { 'X-Admin-Key': adminKey },
    });
    if (res.status === 401 || res.status === 403) {
      setIsAuthenticated(false);
      throw new Error('Unauthorized');
    }
    return res.json();
  };

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api?action=ops-overview');
      if (data.success) setOverview(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api?action=ops-clients&page=${clientsPage}&limit=20`);
      if (data.success) setClients(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAudit = async () => {
    setLoading(true);
    try {
      // Re-using ops-events for now, or ops-audit endpoint
      const data = await apiFetch('/api?action=ops-events&type=recent&limit=50');
      if (data.success) setEvents(data.events);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (!isAuthenticated) return;

    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'clients') fetchClients();
    if (activeTab === 'audit') fetchAudit();

    // Auto-refresh for overview every 30s
    if (activeTab === 'overview') {
      const interval = setInterval(fetchOverview, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab, isAuthenticated, clientsPage]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('admin_key', adminKey);
    setIsAuthenticated(true);
  };

  const handleAction = async (action: string, userId: number) => {
    if (!confirm(`Вы уверены, что хотите запустить ${action} для пользователя #${userId}?`)) return;

    setActionLoading(userId);
    try {
      const res = await fetch('/api?action=ops-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({ action, userId }),
      });
      const data = await res.json();
      if (data.success) {
        // Ideally use a toast here
        console.log(`Success: ${data.message}`);
      } else {
        console.error(`Error: ${data.error}`);
        alert(`Ошибка: ${data.error}`);
      }
    } catch (e) {
      alert('Ошибка сети или сервера');
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================
  // RENDER: LOGIN
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-200 p-6 flex flex-col items-center justify-center font-sans">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent mb-2">
              Админ Панель
            </h1>
            <p className="text-stone-500 text-sm">Вход только для авторизованных операторов</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="Admin Security Key"
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
              className="p-3 rounded-xl bg-stone-900 border border-stone-800 focus:border-violet-500 outline-none transition-colors"
            />
            <button
              type="submit"
              className="bg-violet-600 p-3 rounded-xl font-bold hover:bg-violet-500 transition-colors shadow-lg shadow-violet-900/20"
            >
              Войти в консоль
            </button>
          </form>
          <button
            onClick={onBack}
            className="mt-6 w-full text-stone-600 hover:text-stone-400 text-sm"
          >
            ← Вернуться в приложение
          </button>
        </motion.div>
      </div>
    );
  }

  // ============================================
  // RENDER: DASHBOARD
  // ============================================

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 pb-24 font-sans">
      {/* HEADER */}
      <header className="sticky top-0 bg-stone-950/80 backdrop-blur-md border-b border-stone-800 p-4 z-20 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-white">
            N
          </div>
          <h1 className="text-lg font-bold text-stone-200">Админ Панель</h1>
          <span className="px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 text-xs border border-emerald-800">
            • Онлайн
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              activeTab === 'overview'
                ? fetchOverview()
                : activeTab === 'clients'
                  ? fetchClients()
                  : fetchAudit()
            }
            className="p-2 hover:bg-stone-800 rounded-lg transition-colors text-stone-400"
          >
            <RefreshIcon className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onBack}
            className="p-2 hover:bg-stone-800 rounded-lg transition-colors text-stone-400"
          >
            ✕
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className="p-4 border-b border-stone-800 overflow-x-auto no-scrollbar">
        <div className="flex gap-2">
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            icon="📊"
            label="Обзор"
          />
          <TabButton
            active={activeTab === 'clients'}
            onClick={() => setActiveTab('clients')}
            icon="👥"
            label="Клиенты"
          />
          <TabButton
            active={activeTab === 'audit'}
            onClick={() => setActiveTab('audit')}
            icon="🛡️"
            label="Аудит"
          />
          <TabButton
            active={activeTab === 'n8n'}
            onClick={() => setActiveTab('n8n')}
            icon="⚡"
            label="n8n"
          />
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="p-4 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && overview && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Top Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Всего клиентов"
                  value={overview.clients.total}
                  trend={`+${overview.clients.newToday}`}
                  trendUp={true}
                />
                <StatCard
                  label="Активных"
                  value={overview.clients.active}
                  subvalue={`${Math.round((overview.clients.active / overview.clients.total) * 100)}% активны`}
                  color="purple"
                />
                <StatusCard
                  label="Интеграции"
                  status={overview.integrations.wb.status === 'ok' ? 'healthy' : 'warning'}
                  detail={`WB ${overview.integrations.wb.latency}ms`}
                />
                <StatusCard
                  label="Движок n8n"
                  status={overview.integrations.n8n.status === 'active' ? 'healthy' : 'error'}
                  detail={`${overview.integrations.n8n.workflows_active} сценариев`}
                />
              </div>

              {/* Recent Activity Feed */}
              <div className="bg-stone-900/50 rounded-2xl border border-stone-800 overflow-hidden">
                <div className="p-4 border-b border-stone-800 flex justify-between items-center">
                  <h3 className="font-bold text-stone-300">Лента операций</h3>
                  <span className="text-xs text-stone-500">Последние 5</span>
                </div>
                <div className="divide-y divide-stone-800">
                  {overview.recent_events.map(evt => (
                    <EventRow key={evt.id} event={evt} compact />
                  ))}
                  {overview.recent_events.length === 0 && (
                    <div className="p-8 text-center text-stone-600 text-sm">Нет событий</div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* CLIENTS TAB (Ops Console) */}
          {activeTab === 'clients' && (
            <motion.div
              key="clients"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="bg-stone-900/50 rounded-2xl border border-stone-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-900 text-stone-500 text-xs uppercase tracking-wider">
                        <th className="p-4 font-medium">Магазин / Клиент</th>
                        <th className="p-4 font-medium">Статус</th>
                        <th className="p-4 font-medium">Платформы</th>
                        <th className="p-4 font-medium">Подписка</th>
                        <th className="p-4 font-medium">Товары</th>
                        <th className="p-4 font-medium">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800 text-sm">
                      {clients.map(client => (
                        <tr key={client.id} className="hover:bg-stone-800/50 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-white max-w-[150px] truncate">
                              {client.first_name || 'User'}
                            </div>
                            <div className="text-stone-500 text-xs">@{client.username}</div>
                          </td>
                          <td className="p-4">
                            <Badge status={client.is_active ? 'active' : 'inactive'} />
                          </td>
                          <td className="p-4">
                            <div className="flex gap-1">
                              {client.platforms.includes('wb') && <PlatformIcon name="WB" />}
                              {client.platforms.includes('ozon') && <PlatformIcon name="OZ" />}
                            </div>
                          </td>
                          <td className="p-4 text-stone-300">{client.subscription_plan}</td>
                          <td className="p-4 text-stone-300">{client.total_products}</td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAction('sync_products', client.id)}
                                disabled={actionLoading === client.id}
                                className="px-3 py-1 bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 rounded text-xs font-medium transition-colors disabled:opacity-50"
                              >
                                {actionLoading === client.id ? '...' : 'Синк'}
                              </button>
                              <button
                                onClick={() => handleAction('retry_onboarding', client.id)}
                                disabled={actionLoading === client.id}
                                className="px-3 py-1 bg-stone-800 text-stone-400 hover:bg-stone-700 rounded text-xs font-medium transition-colors"
                              >
                                Повтор
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination (Simple) */}
                <div className="p-4 border-t border-stone-800 flex justify-center gap-2">
                  <button
                    onClick={() => setClientsPage(p => Math.max(1, p - 1))}
                    disabled={clientsPage === 1}
                    className="px-3 py-1 bg-stone-800 rounded disabled:opacity-50"
                  >
                    ←
                  </button>
                  <span className="sc-stone-500 text-sm py-1">Стр. {clientsPage}</span>
                  <button
                    onClick={() => setClientsPage(p => p + 1)}
                    className="px-3 py-1 bg-stone-800 rounded"
                  >
                    →
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* AUDIT (Deep Dive) */}
          {activeTab === 'audit' && (
            <motion.div
              key="audit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold">Журнал Аудита</h2>
                <span className="text-xs text-stone-500">Неизменяемая запись</span>
              </div>
              <div className="space-y-2">
                {events.map(event => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            </motion.div>
          )}

          {/* N8N STATUS */}
          {activeTab === 'n8n' && (
            <motion.div
              key="n8n"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center p-12 text-center"
            >
              <div className="text-6xl mb-4">⚡</div>
              <h2 className="text-2xl font-bold text-white mb-2">Оркестратор n8n</h2>
              <div className="bg-stone-900 p-6 rounded-xl border border-stone-800 max-w-md w-full">
                <div className="flex justify-between mb-2">
                  <span className="text-stone-400">Статус</span>
                  <span className="text-emerald-400 font-bold">Активен</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-stone-400">Вебхук</span>
                  <span className="text-stone-200 font-mono text-xs max-w-[200px] truncate">
                    {overview?.integrations.n8n.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Активные сценарии</span>
                  <span className="text-stone-200">3</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
        active
          ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20'
          : 'bg-stone-900 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
      }`}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

function StatCard({ label, value, trend, subvalue, trendUp, color = 'blue' }: any) {
  return (
    <div className="p-5 bg-stone-900/50 rounded-2xl border border-stone-800 hover:border-stone-700 transition-colors relative overflow-hidden group">
      <div
        className={`absolute top-0 right-0 w-24 h-24 bg-${color}-500/5 rounded-full blur-2xl group-hover:bg-${color}-500/10 transition-colors -mr-4 -mt-4`}
      />
      <div className="relative z-10">
        <div className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-2">
          {label}
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold text-white">{value}</div>
          {trend && (
            <div
              className={`text-xs font-bold px-1.5 py-0.5 rounded ${trendUp ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}
            >
              {trend}
            </div>
          )}
        </div>
        {subvalue && <div className="text-stone-500 text-xs mt-1">{subvalue}</div>}
      </div>
    </div>
  );
}

function StatusCard({ label, status, detail }: any) {
  const isHealthy = status === 'healthy';
  return (
    <div className="p-5 bg-stone-900/50 rounded-2xl border border-stone-800 hover:border-stone-700 transition-colors">
      <div className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-2">{label}</div>
      <div className="flex items-center gap-2 mb-1">
        <div
          className={`w-2.5 h-2.5 rounded-full ${isHealthy ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-amber-500'}`}
        />
        <div className={`text-lg font-bold ${isHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
          {isHealthy ? 'Норма' : 'Проблемы'}
        </div>
      </div>
      <div className="text-stone-600 text-xs font-mono">{detail}</div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const styles: any = {
    active: 'bg-emerald-900/30 text-emerald-400 border-emerald-800',
    inactive: 'bg-stone-800 text-stone-500 border-stone-700',
    error: 'bg-red-900/30 text-red-400 border-red-800',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${styles[status] || styles.inactive}`}
    >
      {status}
    </span>
  );
}

function PlatformIcon({ name }: { name: string }) {
  const colors: any = {
    WB: 'bg-fuchsia-900/40 text-fuchsia-300 border-fuchsia-800',
    OZ: 'bg-blue-900/40 text-blue-300 border-blue-800',
  };
  return (
    <span
      className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border ${colors[name]}`}
    >
      {name}
    </span>
  );
}

function EventRow({ event, compact }: { event: OpsEvent; compact?: boolean }) {
  return (
    <div className={`p-4 ${compact ? 'py-3' : ''} hover:bg-stone-800/30 transition-colors`}>
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-violet-400 bg-violet-900/20 px-1.5 py-0.5 rounded border border-violet-900/50">
            {event.event_type}
          </span>
          {event.user_id && <span className="text-xs text-stone-500">User #{event.user_id}</span>}
        </div>
        <span className="text-xs text-stone-600 font-mono">
          {new Date(event.created_at).toLocaleTimeString()}
        </span>
      </div>
      {!compact && (
        <pre className="text-[10px] text-stone-500 mt-2 bg-black/20 p-2 rounded overflow-x-auto font-mono">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={`w-5 h-5 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

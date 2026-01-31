import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Users,
  Shield,
  Zap,
  Cpu,
  Settings,
  X,
  Terminal,
  LayoutGrid,
} from 'lucide-react';
import { hapticFeedback } from '../lib/telegram';

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

interface MoEHealth {
  healthy: boolean;
  components: {
    localLLM: { healthy: boolean; latencyMs: number; error?: string };
    chromaDB: { healthy: boolean };
    vercelKV: { healthy: boolean };
    embeddings: { available: boolean };
  };
  config: {
    moeEnabled: boolean;
    forceLocal: boolean;
  };
  latencyMs: number;
}

interface OpsEvent {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  user_id?: string | number;
}

interface ClientUser {
  id: string | number;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'audit' | 'n8n' | 'moe'>(
    'overview'
  );
  const [loading, setLoading] = useState(false);

  // Data State
  const [overview, setOverview] = useState<OpsOverview | null>(null);
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [moeHealth, setMoeHealth] = useState<MoEHealth | null>(null);

  // Auth State
  const [adminKey, setAdminKey] = useState(localStorage.getItem('admin_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!adminKey);

  // Pagination for clients
  const [clientsPage, setClientsPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | number | null>(null);

  // ============================================
  // API CALLS
  // ============================================

  const apiFetch = useCallback(
    async (endpoint: string) => {
      const res = await fetch(endpoint, {
        headers: { 'X-Admin-Key': adminKey },
      });
      if (res.status === 401 || res.status === 403) {
        setIsAuthenticated(false);
        throw new Error('Unauthorized');
      }
      return res.json();
    },
    [adminKey]
  );

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api?action=ops-overview');
      if (data.success) setOverview(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api?action=ops-clients&page=${clientsPage}&limit=20`);
      if (data.success) setClients(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, clientsPage]);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api?action=ops-events&type=recent&limit=50');
      if (data.success) setEvents(data.events);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const fetchMoEHealth = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api?action=moe-health');
      setMoeHealth(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (!isAuthenticated) return;

    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'clients') fetchClients();
    if (activeTab === 'audit') fetchAudit();
    if (activeTab === 'moe') fetchMoEHealth();

    if (activeTab === 'overview') {
      const interval = setInterval(fetchOverview, 30000);
      return () => clearInterval(interval);
    }
    if (activeTab === 'moe') {
      const interval = setInterval(fetchMoEHealth, 15000);
      return () => clearInterval(interval);
    }
  }, [
    activeTab,
    isAuthenticated,
    clientsPage,
    fetchOverview,
    fetchClients,
    fetchAudit,
    fetchMoEHealth,
  ]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    hapticFeedback('medium');
    localStorage.setItem('admin_key', adminKey);
    setIsAuthenticated(true);
  };

  const handleAction = async (action: string, userId: string | number) => {
    if (!confirm(`Вы уверены, что хотите запустить ${action} для пользователя #${userId}?`)) return;

    hapticFeedback('light');
    setActionLoading(userId);
    try {
      const res = await fetch('/api?action=ops-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({ action, userId }),
      });
      const data = await res.json();
      if (data.success) {
        hapticFeedback('success');
      } else {
        alert(`Ошибка: ${data.error}`);
      }
    } catch {
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
      <div className="min-h-full bg-background p-6 flex flex-col items-center justify-center font-display relative">
        <div className="aura-layer" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm fused-card p-8 space-y-8"
        >
          <div className="text-center space-y-2">
            <div className="size-16 rounded-2xl bg-black text-white flex items-center justify-center mx-auto shadow-2xl">
              <Terminal size={32} />
            </div>
            <h1 className="text-2xl font-black italic tracking-tighter uppercase mt-4">
              Ops Console
            </h1>
            <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">
              Authorized Access Only
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-black/40 px-1">
                Security Token
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                className="w-full h-14 px-4 rounded-2xl bg-black/5 border border-black/5 focus:border-primary/30 outline-none font-mono text-sm transition-all"
              />
            </div>
            <button
              type="submit"
              className="w-full h-14 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all"
            >
              Access System
            </button>
          </form>

          <button
            onClick={() => {
              hapticFeedback('light');
              onBack();
            }}
            className="w-full text-center text-[10px] font-black text-black/30 uppercase tracking-widest hover:text-black transition-colors"
          >
            ← Exit Terminal
          </button>
        </motion.div>
      </div>
    );
  }

  // ============================================
  // RENDER: DASHBOARD
  // ============================================

  return (
    <div className="min-h-full bg-background font-display pb-32 relative">
      <div className="aura-layer" />

      {/* HEADER */}
      <header className="sticky top-0 z-40 glass-nav border-b border-black/5 px-4 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-black text-white flex items-center justify-center shadow-lg font-black italic">
              N
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-text-main">Ops Panel</h1>
              <div className="flex items-center gap-1.5 leading-none">
                <div className="size-1.5 rounded-full bg-peace-green animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-black/30">
                  System Online
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                hapticFeedback('light');
                if (activeTab === 'overview') fetchOverview();
                else if (activeTab === 'clients') fetchClients();
                else if (activeTab === 'moe') fetchMoEHealth();
                else fetchAudit();
              }}
              className="size-10 flex items-center justify-center rounded-xl bg-black/5 hover:bg-black/10 transition-colors"
            >
              <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''} text-black/40`} />
            </button>
            <button
              onClick={() => {
                hapticFeedback('light');
                onBack();
              }}
              className="size-10 flex items-center justify-center rounded-xl bg-black text-white shadow-lg active:scale-90 transition-transform"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* TABS */}
      <div className="sticky top-[73px] z-30 glass-nav border-b border-black/5 px-4 py-2 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 max-w-7xl mx-auto">
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            icon={<LayoutGrid size={14} />}
            label="Overview"
          />
          <TabButton
            active={activeTab === 'clients'}
            onClick={() => setActiveTab('clients')}
            icon={<Users size={14} />}
            label="Clients"
          />
          <TabButton
            active={activeTab === 'audit'}
            onClick={() => setActiveTab('audit')}
            icon={<Shield size={14} />}
            label="Security"
          />
          <TabButton
            active={activeTab === 'n8n'}
            onClick={() => setActiveTab('n8n')}
            icon={<Zap size={14} />}
            label="Automata"
          />
          <TabButton
            active={activeTab === 'moe'}
            onClick={() => setActiveTab('moe')}
            icon={<Cpu size={14} />}
            label="Mixture"
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total Nodes"
                  value={overview.clients.total}
                  trend={`+${overview.clients.newToday}`}
                  trendUp={true}
                />
                <StatCard
                  label="Active Flux"
                  value={overview.clients.active}
                  subvalue={`${Math.round((overview.clients.active / overview.clients.total) * 100)}% coverage`}
                  color="primary"
                />
                <StatusCard
                  label="Bridge: WB"
                  status={overview.integrations.wb.status === 'ok' ? 'healthy' : 'warning'}
                  detail={`${overview.integrations.wb.latency}ms ping`}
                />
                <StatusCard
                  label="Engine: n8n"
                  status={overview.integrations.n8n.status === 'active' ? 'healthy' : 'error'}
                  detail={`${overview.integrations.n8n.workflows_active} chains active`}
                />
              </div>

              <div className="fused-card overflow-hidden">
                <div className="p-4 border-b border-black/5 flex justify-between items-center bg-black/3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-black/40">
                    Recent Pulse Events
                  </h3>
                </div>
                <div className="divide-y divide-black/5 bg-white/40">
                  {overview.recent_events.map(evt => (
                    <EventRow key={evt.id} event={evt} compact />
                  ))}
                  {overview.recent_events.length === 0 && (
                    <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-black/20">
                      Zero events detected
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* CLIENTS TAB */}
          {activeTab === 'clients' && (
            <motion.div
              key="clients"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fused-card overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/3 text-[9px] font-black uppercase tracking-widest text-black/40">
                      <th className="p-4">Entity</th>
                      <th className="p-4 text-center">Protocol</th>
                      <th className="p-4">Platforms</th>
                      <th className="p-4">Tier</th>
                      <th className="p-4">Objects</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 text-xs font-bold bg-white/40">
                    {clients.map(client => (
                      <tr key={client.id} className="hover:bg-black/3 transition-colors">
                        <td className="p-4">
                          <div className="font-black text-text-main truncate max-w-[140px]">
                            {client.first_name || 'Anonymous Node'}
                          </div>
                          <div className="text-[9px] font-medium text-black/30">
                            ID: {client.id}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <StatusBadge active={client.is_active} />
                        </td>
                        <td className="p-4">
                          <div className="flex gap-1">
                            {client.platforms.includes('wb') && <PlatformTag name="WB" />}
                            {client.platforms.includes('ozon') && <PlatformTag name="OZ" />}
                          </div>
                        </td>
                        <td className="p-4 uppercase tracking-tighter">
                          {client.subscription_plan}
                        </td>
                        <td className="p-4">{client.total_products}</td>
                        <td className="p-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleAction('sync_products', client.id)}
                              className="size-8 flex items-center justify-center rounded-lg bg-black text-white shadow-lg active:scale-95 transition-all disabled:opacity-30"
                              disabled={actionLoading === client.id}
                            >
                              <RefreshCw
                                size={12}
                                className={actionLoading === client.id ? 'animate-spin' : ''}
                              />
                            </button>
                            <button
                              onClick={() => handleAction('retry_onboarding', client.id)}
                              className="size-8 flex items-center justify-center rounded-lg bg-black/5 hover:bg-black/10 transition-colors"
                            >
                              <Settings size={12} className="text-black/40" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-black/5 flex items-center justify-between bg-black/3">
                <button
                  onClick={() => setClientsPage(p => Math.max(1, p - 1))}
                  className="size-8 flex items-center justify-center rounded-lg bg-white shadow border border-black/5"
                  disabled={clientsPage === 1}
                >
                  ←
                </button>
                <span className="text-[10px] font-black text-black/30 uppercase">
                  Page {clientsPage}
                </span>
                <button
                  onClick={() => setClientsPage(p => p + 1)}
                  className="size-8 flex items-center justify-center rounded-lg bg-white shadow border border-black/5"
                >
                  →
                </button>
              </div>
            </motion.div>
          )}

          {/* AUDIT TAB */}
          {activeTab === 'audit' && (
            <motion.div
              key="audit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-end px-1">
                <div>
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-text-main">
                    Security Log
                  </h2>
                  <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">
                    Immutable Ledger Trace
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {events.map(event => (
                  <div key={event.id} className="fused-card p-4 flex gap-4 items-start bg-white/60">
                    <div className="size-8 rounded-lg bg-black/5 flex items-center justify-center shrink-0">
                      <Terminal size={14} className="text-black/30" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                          {event.event_type}
                        </span>
                        <span className="text-[9px] font-medium text-black/30">
                          {new Date(event.created_at).toLocaleString()}
                        </span>
                      </div>
                      <pre className="text-[10px] font-mono text-black/60 bg-black/3 p-2 rounded-lg overflow-x-auto">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-black/20">
                    Zero security events recorded
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* N8N STATUS */}
          {activeTab === 'n8n' && (
            <motion.div
              key="n8n"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fused-card p-12 flex flex-col items-center justify-center text-center space-y-4"
            >
              <div className="size-20 rounded-3xl bg-black text-white flex items-center justify-center shadow-2xl">
                <Zap size={40} className="fill-current" />
              </div>
              <h2 className="text-2xl font-black italic tracking-tighter uppercase text-text-main">
                Chain Orchestrator
              </h2>
              <div className="space-y-1">
                <div className="flex items-center gap-2 justify-center">
                  <div className="size-2 rounded-full bg-peace-green animate-pulse" />
                  <span className="text-xs font-black text-text-main">Automata Status: Active</span>
                </div>
                <p className="text-[10px] font-medium text-black/30 uppercase tracking-widest">
                  Listening for Webhooks & State Changes
                </p>
              </div>
              <div className="w-full max-w-sm bg-black/3 rounded-2xl p-4 mt-6 border border-black/5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black uppercase text-black/30">
                    Active Chains
                  </span>
                  <span className="text-xs font-black">
                    {overview?.integrations.n8n.workflows_active || 0}
                  </span>
                </div>
                <div className="h-1 bg-black/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '65%' }}
                    className="h-full bg-primary"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* MOE STATUS */}
          {activeTab === 'moe' && (
            <motion.div
              key="moe"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <header className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-text-main">
                    Mixture of Experts
                  </h2>
                  <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">
                    Hybrid Neural Engine Routing
                  </p>
                </div>
                <div
                  className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-colors ${moeHealth?.healthy ? 'bg-peace-green/5 text-peace-green border-peace-green/20' : 'bg-toxic-orange/5 text-toxic-orange border-toxic-orange/20'}`}
                >
                  {moeHealth?.healthy
                    ? '● All Neural Components Functional'
                    : '⚠ Engine Fragmentation Detected'}
                </div>
              </header>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <HealthBlock
                  label="Local LLM"
                  status={moeHealth?.components?.localLLM?.healthy}
                  detail={`${moeHealth?.components?.localLLM?.latencyMs || 0}ms Response`}
                />
                <HealthBlock
                  label="Chroma DB"
                  status={moeHealth?.components?.chromaDB?.healthy}
                  detail="Vector Repository"
                />
                <HealthBlock
                  label="Vercel KV"
                  status={moeHealth?.components?.vercelKV?.healthy}
                  detail="Synaptic Cache"
                />
                <HealthBlock
                  label="Embeddings"
                  status={moeHealth?.components?.embeddings?.available}
                  detail="Logic Mapping"
                />
              </div>

              <div className="fused-card p-6 bg-black text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 size-64 bg-primary/20 blur-3xl -mr-32 -mt-32 animate-pulse" />
                <div className="relative z-10">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-6 text-white/40">
                    Core Neural Config
                  </h3>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                        Routing Logic
                      </span>
                      <div className="text-xl font-black italic">
                        {moeHealth?.config?.moeEnabled ? 'DYN-ENABLED' : 'MANUAL-ONLY'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-white/40 uppercase tracking-widest text-toxic-orange/60">
                        Force Priority
                      </span>
                      <div className="text-xl font-black italic text-toxic-orange">
                        {moeHealth?.config?.forceLocal ? 'LOCAL-CORE' : 'HYBRID-MESH'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <p className="text-[9px] font-mono text-black/20 uppercase tracking-tighter">
                  System Pulse: {moeHealth?.latencyMs || 0}ms latency
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={() => {
        hapticFeedback('light');
        onClick();
      }}
      className={`px-4 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${
        active
          ? 'bg-black text-white shadow-xl shadow-black/20'
          : 'bg-black/5 text-black/30 hover:bg-black/10'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  trend?: string;
  subvalue?: string;
  trendUp?: boolean;
  color?: string;
}

function StatCard({ label, value, trend, subvalue, trendUp, color = 'primary' }: StatCardProps) {
  return (
    <div className="fused-card p-5 relative overflow-hidden group">
      <div
        className={`absolute top-0 right-0 size-20 bg-${color}/5 blur-2xl group-hover:bg-${color}/10 transition-colors -mr-10 -mt-10`}
      />
      <div className="relative z-10">
        <span className="text-[9px] font-black uppercase tracking-widest text-black/30 block mb-3">
          {label}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black italic tracking-tighter">{value}</span>
          {trend && (
            <span
              className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg ${trendUp ? 'bg-peace-green/10 text-peace-green' : 'bg-toxic-orange/10 text-toxic-orange'}`}
            >
              {trend}
            </span>
          )}
        </div>
        {subvalue && (
          <p className="text-[9px] font-medium text-black/20 mt-1 uppercase tracking-tight">
            {subvalue}
          </p>
        )}
      </div>
    </div>
  );
}

interface StatusCardProps {
  label: string;
  status: 'healthy' | 'warning' | 'error';
  detail: string;
}

function StatusCard({ label, status, detail }: StatusCardProps) {
  const isHealthy = status === 'healthy';
  const isWarning = status === 'warning';

  return (
    <div className="fused-card p-5">
      <span className="text-[9px] font-black uppercase tracking-widest text-black/30 block mb-3">
        {label}
      </span>
      <div className="flex items-center gap-2 mb-1">
        <div
          className={`size-2 rounded-full ${isHealthy ? 'bg-peace-green shadow-[0_0_8px_rgba(16,185,129,0.5)]' : isWarning ? 'bg-toxic-orange/50 shadow-[0_0_8px_rgba(255,109,0,0.3)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}
        />
        <span
          className={`text-lg font-black italic uppercase tracking-tighter ${isHealthy ? 'text-text-main' : 'text-toxic-orange'}`}
        >
          {isHealthy ? 'Nominal' : 'Alert'}
        </span>
      </div>
      <p className="text-[9px] font-mono text-black/30 uppercase">{detail}</p>
    </div>
  );
}

function HealthBlock({
  label,
  status,
  detail,
}: {
  label: string;
  status: boolean | undefined;
  detail: string;
}) {
  return (
    <div className="fused-card p-4">
      <span className="text-[9px] font-black uppercase tracking-widest text-black/30 block mb-2">
        {label}
      </span>
      <div className="flex items-center gap-2 mb-1">
        <div className={`size-1.5 rounded-full ${status ? 'bg-peace-green' : 'bg-toxic-orange'}`} />
        <span className="text-xs font-black italic uppercase">
          {status ? 'Core-Up' : 'Disabled'}
        </span>
      </div>
      <p className="text-[9px] font-medium text-black/20 uppercase transition-colors">{detail}</p>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${active ? 'bg-peace-green/5 text-peace-green border-peace-green/20' : 'bg-black/5 text-black/20 border-black/5'}`}
    >
      {active ? 'Active' : 'Offline'}
    </span>
  );
}

function PlatformTag({ name }: { name: string }) {
  const isWB = name === 'WB';
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[8px] font-black ${isWB ? 'bg-[#CB11AB] text-white' : 'bg-[#005BFF] text-white'}`}
    >
      {name}
    </span>
  );
}

function EventRow({ event, compact = false }: { event: OpsEvent; compact?: boolean }) {
  return (
    <div
      className={`p-4 flex items-start gap-4 hover:bg-black/2 transition-colors ${compact ? 'py-3' : ''}`}
    >
      <div className="size-6 rounded-lg bg-black text-white flex items-center justify-center shrink-0 shadow-lg text-[10px] font-black italic">
        {event.event_type.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[10px] font-black uppercase tracking-tight text-text-main truncate pr-2">
            {event.event_type}
          </span>
          <span className="text-[8px] font-medium text-black/20 shrink-0">
            {new Date(event.created_at).toLocaleTimeString()}
          </span>
        </div>
        {!compact && (
          <pre className="text-[9px] font-mono text-black/40 bg-black/3 p-2 rounded mt-2 overflow-x-auto">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

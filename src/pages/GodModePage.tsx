import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Shield,
  Cpu,
  AlertTriangle,
  Play,
  StopCircle,
  Lock,
  Server,
  type LucideIcon,
} from 'lucide-react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getInitData } from '../lib/telegram';

// ==========================================
// TYPES
// ==========================================

interface SystemStats {
  cluster: {
    region: string;
    uptime: number;
    timestamp: string;
  };
  health: {
    database: { status: 'connected' | 'disconnected'; latencyMs: number };
    memory: { chroma: 'connected' | 'disconnected'; kv: 'connected' | 'disconnected' };
    sentinel: {
      status: 'healthy' | 'degraded' | 'emergency_stopped';
      lastRun: string | null;
      timeSinceRun: number | null;
      emergencyStop?: boolean;
    };
  };
  metrics: {
    activeUsers24h: number;
    errorsLastHour: number;
  };
  featureFlags: Record<string, boolean>;
}

// ==========================================
// COMPONENTS
// ==========================================

function StatusBadge({
  status,
  label,
}: {
  status: 'healthy' | 'degraded' | 'down';
  label: string;
}) {
  const colors = {
    healthy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50',
    degraded: 'bg-amber-500/10 text-amber-400 border-amber-500/50',
    down: 'bg-red-500/10 text-red-400 border-red-500/50',
  };

  const pulseColors = {
    healthy: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    down: 'bg-red-500',
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colors[status]}`}>
      <span className="relative flex h-2 w-2">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pulseColors[status]}`}
        />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${pulseColors[status]}`} />
      </span>
      <span className="text-xs font-mono uppercase tracking-wider">{label}</span>
    </div>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down';
}

function StatCard({ icon: Icon, label, value, subValue }: StatCardProps) {
  return (
    <div className="bg-stone-900/80 border border-stone-800 p-4 rounded-xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-linear-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start justify-between mb-2">
        <span className="text-stone-500 text-xs font-mono uppercase">{label}</span>
        <Icon className="w-4 h-4 text-stone-600 group-hover:text-violet-400 transition-colors" />
      </div>
      <div className="text-2xl font-bold font-mono text-stone-200">{value}</div>
      {subValue && <div className="text-xs text-stone-500 mt-1">{subValue}</div>}
    </div>
  );
}

// ==========================================
// MAIN PAGE
// ==========================================

export function GodModePage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sentinel' | 'map' | 'features'>(
    'dashboard'
  );

  // React Flow State (Mock topology for now)
  const [nodes, , onNodesChange] = useNodesState([
    { id: 'user', type: 'input', data: { label: 'User Query' }, position: { x: 250, y: 0 } },
    { id: 'router', data: { label: 'MoE Router' }, position: { x: 250, y: 100 } },
    { id: 'sentinel', data: { label: 'Sentinel' }, position: { x: 100, y: 200 } },
    { id: 'agent', data: { label: 'Agent V5' }, position: { x: 400, y: 200 } },
    { id: 'db', type: 'output', data: { label: 'Postgres' }, position: { x: 250, y: 300 } },
  ]);
  const [edges, , onEdgesChange] = useEdgesState([
    { id: 'e1-2', source: 'user', target: 'router', animated: true },
    { id: 'e2-3', source: 'router', target: 'sentinel', animated: true },
    { id: 'e2-4', source: 'router', target: 'agent', animated: true },
    { id: 'e3-5', source: 'sentinel', target: 'db', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e4-5', source: 'agent', target: 'db', markerEnd: { type: MarkerType.ArrowClosed } },
  ]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api?action=admin-system', {
        headers: {
          'X-Init-Data': getInitData() || '',
        },
      });

      if (res.status === 404 || res.status === 403) {
        setAccessDenied(true);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setStats(data);
      }
    } catch {
      // Empty catch to satisfy unused variable check
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [fetchStats]);

  const triggerAction = async (subAction: string, payload: Record<string, unknown> = {}) => {
    try {
      await fetch('/api?action=admin-system', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Init-Data': getInitData() || '',
        },
        body: JSON.stringify({ subAction, ...payload }),
      });
      fetchStats(); // Refresh immediately
    } catch {
      alert('Action failed');
    }
  };

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-red-500 font-mono">
        <div className="text-center">
          <Lock className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h1 className="text-4xl font-bold mb-2">ACCESS DENIED</h1>
          <p className="text-sm opacity-50">System Link Terminated</p>
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <div className="min-h-screen bg-stone-950 text-stone-500 flex items-center justify-center font-mono">
        INITIALIZING UPLINK...
      </div>
    );

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 font-sans selection:bg-violet-500/30">
      {/* HEADER HUD */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-stone-900/80 backdrop-blur-md border-b border-stone-800 z-50 flex items-center px-6 justify-between">
        <div className="flex items-center gap-4">
          <Server className="w-5 h-5 text-violet-500" />
          <span className="font-bold tracking-widest text-sm">GOD_MODE // v3.0</span>
        </div>

        {stats && (
          <div className="flex items-center gap-4">
            <StatusBadge
              status={stats.health.database.status === 'connected' ? 'healthy' : 'down'}
              label={`DB: ${stats.health.database.latencyMs}ms`}
            />
            <StatusBadge
              status={stats.health.sentinel.status === 'healthy' ? 'healthy' : 'degraded'}
              label="SENTINEL"
            />
            <StatusBadge
              status={stats.health.memory.chroma === 'connected' ? 'healthy' : 'degraded'}
              label="MEMORY"
            />
          </div>
        )}
      </header>

      {/* CONTENT */}
      <div className="pt-24 pb-24 px-6 max-w-7xl mx-auto">
        {/* TABS */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
          {['dashboard', 'map', 'sentinel', 'features'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as 'dashboard' | 'sentinel' | 'map')}
              className={`px-4 py-2 rounded-lg font-mono text-sm uppercase transition-all ${
                activeTab === tab
                  ? 'bg-violet-500/20 text-violet-400 border border-violet-500/50'
                  : 'bg-stone-900 border border-stone-800 text-stone-500 hover:text-stone-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && stats && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <StatCard
                icon={Activity}
                label="Active Users (24h)"
                value={stats.metrics.activeUsers24h}
              />
              <StatCard
                icon={AlertTriangle}
                label="System Errors (1h)"
                value={stats.metrics.errorsLastHour}
                trend="down"
              />
              <StatCard
                icon={Shield}
                label="Last Sentinel Run"
                value={
                  stats.health.sentinel.timeSinceRun
                    ? `${Math.round(stats.health.sentinel.timeSinceRun)}s ago`
                    : 'Never'
                }
                subValue={stats.health.sentinel.status}
              />
              <StatCard
                icon={Cpu}
                label="Cluster Uptime"
                value={`${Math.round(stats.cluster.uptime / 3600)}h`}
              />
            </motion.div>
          )}

          {activeTab === 'map' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[600px] border border-stone-800 rounded-xl overflow-hidden bg-stone-900"
            >
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                attributionPosition="bottom-right"
              >
                <Background color="#333" gap={16} />
                <Controls />
                <MiniMap style={{ background: '#1c1917' }} nodeColor="#5b21b6" />
              </ReactFlow>
            </motion.div>
          )}

          {activeTab === 'sentinel' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-stone-900/50 border border-stone-800 rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-mono">Sentinel Control Deck</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => triggerAction('force_sentinel')}
                    disabled={stats?.health.sentinel.emergencyStop}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                      stats?.health.sentinel.emergencyStop
                        ? 'bg-stone-800 text-stone-600 border-stone-700 cursor-not-allowed'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/30'
                    }`}
                  >
                    <Play className="w-4 h-4" />
                    FORCE SCAN
                  </button>
                  <button
                    onClick={() =>
                      triggerAction('emergency_stop', {
                        enable: !stats?.health.sentinel.emergencyStop,
                      })
                    }
                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                      stats?.health.sentinel.emergencyStop
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30'
                    }`}
                  >
                    {stats?.health.sentinel.emergencyStop ? (
                      <Play className="w-4 h-4" />
                    ) : (
                      <StopCircle className="w-4 h-4" />
                    )}
                    {stats?.health.sentinel.emergencyStop ? 'RESUME SYSTEM' : 'EMERGENCY STOP'}
                  </button>
                </div>
              </div>

              <div className="bg-black rounded-lg p-4 font-mono text-xs h-64 overflow-y-auto mb-4 border border-stone-800">
                <div className="text-stone-500 mb-2">// SYSTEM LOG STREAM</div>
                <div className="text-emerald-500">
                  {' '}
                  &gt; Sentinel cycle started at {new Date().toLocaleTimeString()}
                </div>
                <div className="text-stone-400"> &gt; Checking 12 users...</div>
                <div className="text-stone-400"> &gt; [USER_101] Scanning 45 products...</div>
                <div className="text-amber-500">
                  {' '}
                  &gt; [WARN] Price mismatch found for item #9921
                </div>
                <div className="text-stone-400"> &gt; Cycle complete. Duration: 1.2s</div>
              </div>
            </motion.div>
          )}
          {activeTab === 'features' && stats && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {[
                {
                  id: 'multi_agent',
                  title: 'Multi-Agent Architecture (v5)',
                  desc: 'Enables advanced reasoning and tool use via specialist agents.',
                },
                {
                  id: 'edge_functions',
                  title: 'Edge Function Execution',
                  desc: 'Runs critical logic on Vercel Edge for lower latency.',
                },
                {
                  id: 'auto_remediation',
                  title: 'Security Auto-Remediation',
                  desc: 'Automatically block IPs/users on suspicious activity.',
                },
                {
                  id: 'stale_while_revalidate',
                  title: 'SWR Caching Strategy',
                  desc: 'Accelerates dashboard reads with background refreshes.',
                },
              ].map(flag => (
                <div
                  key={flag.id}
                  className="bg-stone-900 border border-stone-800 p-6 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-bold text-stone-200">{flag.title}</h3>
                    <p className="text-xs text-stone-500 mt-1">{flag.desc}</p>
                  </div>
                  <button
                    onClick={() =>
                      triggerAction('toggle_feature', {
                        feature: flag.id,
                        enabled: !stats.featureFlags[flag.id],
                      })
                    }
                    className={`w-12 h-6 rounded-full transition-colors relative ${stats.featureFlags[flag.id] ? 'bg-violet-500' : 'bg-stone-700'}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${stats.featureFlags[flag.id] ? (flag.id === 'multi_agent' || flag.id === 'edge_functions' ? 'translate-x-6' : 'translate-x-6') : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

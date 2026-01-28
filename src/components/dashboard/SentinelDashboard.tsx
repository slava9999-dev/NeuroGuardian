// ============================================
// NeuroGUARDIAN — Sentinel Dashboard
// Advanced Protection Monitoring UI (V5)
// ============================================

import { useEffect, useState } from 'react';
import { SentinelStatusBadge } from './SentinelStatusBadge';
import { getInitData } from '../../lib/telegram';

// --- Types ---
interface ActiveThreat {
  productId: string;
  productTitle: string;
  marketplace: string;
  threatType: string;
  severity: string;
  message: string;
  currentPrice: number;
  minPrice: number;
  detectedAt: string;
}

interface RecentAction {
  id: number;
  productTitle: string;
  marketplace: string;
  threatType: string;
  action: string;
  detectedPrice: number;
  minPrice: number;
  savedAmount: number;
  success: boolean;
  createdAt: string;
}

interface DashboardStats {
  timeRange: string;
  totalActions: number;
  successfulActions: number;
  successRate: number;
  totalSaved: number;
  uniqueProductsProtected: number;
  threatBreakdown: {
    stopLossTriggers: number;
    erosionAlerts: number;
    marginAlerts: number;
  };
}

interface DashboardData {
  activeThreats: {
    count: number;
    critical: number;
    warning: number;
    items: ActiveThreat[];
  };
  recentActions: RecentAction[];
  stats: DashboardStats;
  monitoredProducts: number;
  lastScanTime: string;
}

// --- Component ---

export function SentinelDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const initData = getInitData();
      const response = await fetch('/api?action=sentinel-dashboard&timeRange=24h', {
        headers: { 'X-Init-Data': initData },
      });
      if (!response.ok) throw new Error('Network response was not ok');
      const json = await response.json();
      if (json.success) {
        setData(json.dashboard);
      } else {
        setError(json.error || 'Failed to load data');
      }
    } catch (e) {
      console.error('Failed to fetch dashboard', e);
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleScanNow = async () => {
    try {
      setIsScanning(true);
      const initData = getInitData();
      await fetch('/api?action=check-prices', {
        method: 'POST',
        headers: { 'X-Init-Data': initData },
      });
      // Refresh data after short delay
      setTimeout(fetchData, 2000);
    } catch (e) {
      console.error('Scan failed', e);
    } finally {
      setIsScanning(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="animate-spin text-4xl mb-2">🛡️</div>
        <div>Загрузка Sentinel V5...</div>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500 bg-red-50 rounded">Ошибка: {error}</div>;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black italic tracking-tighter uppercase flex items-center gap-3 text-slate-900">
            🛡️ Центр Защиты
            <span className="text-[9px] bg-primary text-black font-black px-2 py-0.5 rounded-md tracking-widest">
              LIVE
            </span>
          </h2>
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Мониторинг {data.monitoredProducts} товаров • Сканировано:{' '}
            {formatTime(data.lastScanTime)}
          </div>
        </div>
        <button
          onClick={handleScanNow}
          disabled={isScanning}
          className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-sm
            ${isScanning ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-900 hover:bg-primary hover:text-white border border-slate-200 active:scale-95'}
          `}
        >
          {isScanning ? '🎞️ Сканирование...' : '⚡ Сканировать сейчас'}
        </button>
      </div>

      {/* Main Status Badge */}
      <SentinelStatusBadge />

      {/* Active Threats Warning */}
      {data.activeThreats.count > 0 ? (
        <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-rose-700 font-black italic uppercase tracking-tight flex items-center gap-3">
              🚨 Активные Угрозы ({data.activeThreats.count})
            </h3>
            <span className="text-[9px] text-rose-600 font-black bg-rose-100 px-2 py-1 rounded uppercase tracking-widest">
              Критический статус
            </span>
          </div>
          <div className="space-y-3">
            {data.activeThreats.items.map((threat, idx) => (
              <div
                key={idx}
                className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                        threat.marketplace === 'WB'
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {threat.marketplace}
                    </span>
                    <div className="text-sm font-black italic text-slate-900 uppercase tracking-tight truncate max-w-[150px]">
                      {threat.productTitle}
                    </div>
                  </div>
                  <div className="text-[10px] text-rose-600 font-bold uppercase">
                    {threat.message}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-slate-900">
                    {formatPrice(threat.currentPrice)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                    Мин: {formatPrice(threat.minPrice)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            ✅
          </div>
          <div>
            <div className="font-black italic uppercase text-emerald-700 text-sm tracking-tight">
              Угроз не обнаружено
            </div>
            <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
              Все товары продаются выше минимальной цены
            </div>
          </div>
        </div>
      )}

      {/* Analytics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Сэкономлено (24ч)"
          value={formatPrice(data.stats.totalSaved)}
          icon="💰"
          color="green"
        />
        <StatCard
          label="Успех защиты"
          value={`${data.stats.successRate}%`}
          icon="🎯"
          color={data.stats.successRate > 90 ? 'green' : 'orange'}
        />
        <StatCard
          label="Срабатываний Stop-Loss"
          value={data.stats.threatBreakdown.stopLossTriggers}
          icon="🛑"
          color="red"
        />
        <StatCard
          label="Атаки (Эрозия)"
          value={data.stats.threatBreakdown.erosionAlerts}
          icon="📉"
          color="orange"
        />
      </div>

      {/* Recent Actions List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-black italic uppercase tracking-widest text-[10px] text-slate-600">
            📋 Последние действия
          </h3>
          <span className="text-[9px] font-mono text-slate-500 uppercase">Archive Logs</span>
        </div>
        <div className="max-h-96 overflow-y-auto no-scrollbar">
          {data.recentActions.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-black uppercase text-[10px] tracking-widest bg-slate-50">
              Нет недавних действий
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentActions.map(action => (
                <div
                  key={action.id}
                  className="p-4 hover:bg-slate-50 transition-all flex gap-4 items-center group"
                >
                  <div className="text-2xl group-hover:scale-110 transition-transform">
                    {action.success ? (action.action.includes('Stock') ? '📦' : '🛡️') : '⚠️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black italic text-slate-900 truncate group-hover:text-slate-700 transition-colors">
                      {action.productTitle}
                    </div>
                    <div className="flex gap-2 text-[10px] font-bold uppercase tracking-tight mt-1">
                      <span
                        className={`px-1.5 py-0.5 rounded-md ${
                          action.marketplace === 'WB'
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {action.marketplace}
                      </span>
                      <span className="text-slate-500 group-hover:text-slate-600 transition-colors">
                        {action.threatType}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                      {action.savedAmount > 0 ? `+${formatPrice(action.savedAmount)}` : 'Защищён'}
                    </div>
                    <div className="text-[9px] font-mono text-slate-500 uppercase mt-1">
                      {formatTime(action.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Helpers ---

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    green:
      'text-emerald-600 bg-emerald-50 border-emerald-200 shadow-[0_4px_15px_rgba(16,185,129,0.08)]',
    red: 'text-rose-600 bg-rose-50 border-rose-200 shadow-[0_4px_15px_rgba(244,63,94,0.08)]',
    orange: 'text-amber-600 bg-amber-50 border-amber-200 shadow-[0_4px_15px_rgba(245,158,11,0.08)]',
    blue: 'text-blue-600 bg-blue-50 border-blue-200 shadow-[0_4px_15px_rgba(59,130,246,0.08)]',
  };

  return (
    <div
      className={`p-4 rounded-2xl border transition-all hover:scale-105 hover:shadow-lg ${colorMap[color] || 'bg-white border-slate-200 shadow-sm'}`}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-xl font-black italic tracking-tighter text-slate-900">{value}</div>
      <div className="text-[9px] font-black uppercase tracking-widest text-slate-600 mt-1">
        {label}
      </div>
    </div>
  );
}

function formatPrice(val: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(val);
}

function formatTime(iso: string) {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;

    if (diff < 60) return 'Только что';
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;

    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '---';
  }
}

export default SentinelDashboard;

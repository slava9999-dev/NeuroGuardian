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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            🛡️ Центр Защиты
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">LIVE</span>
          </h2>
          <div className="text-sm text-gray-500">
            Мониторинг {data.monitoredProducts} товаров • Сканировано:{' '}
            {formatTime(data.lastScanTime)}
          </div>
        </div>
        <button
          onClick={handleScanNow}
          disabled={isScanning}
          className={`px-4 py-2 rounded-lg font-medium text-white transition-all
            ${isScanning ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl'}
          `}
        >
          {isScanning ? '⏳ Сканирование...' : '⚡ Сканировать сейчас'}
        </button>
      </div>

      {/* Main Status Badge */}
      <SentinelStatusBadge />

      {/* Active Threats Warning */}
      {data.activeThreats.count > 0 ? (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg animate-pulse-subtle">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-red-800 font-bold flex items-center gap-2">
              🚨 Активные Угрозы ({data.activeThreats.count})
            </h3>
            <span className="text-xs text-red-600 font-medium bg-red-100 px-2 py-1 rounded">
              Требуют внимания
            </span>
          </div>
          <div className="space-y-2">
            {data.activeThreats.items.map((threat, idx) => (
              <div
                key={idx}
                className="bg-white p-3 rounded shadow-sm border border-red-100 flex justify-between items-center"
              >
                <div>
                  <div className="text-sm font-medium text-gray-800">{threat.productTitle}</div>
                  <div className="text-xs text-red-500 mt-0.5">{threat.message}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">
                    {formatPrice(threat.currentPrice)}
                  </div>
                  <div className="text-xs text-gray-500">Мин: {formatPrice(threat.minPrice)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-center gap-3">
          <div className="text-2xl">✅</div>
          <div>
            <div className="font-bold text-green-800">Угроз не обнаружено</div>
            <div className="text-sm text-green-600">Все товары продаются выше минимальной цены</div>
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-700">📋 Последние действия</h3>
          <span className="text-xs text-gray-500">Poslednie 50 deystviy</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {data.recentActions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Нет недавних действий</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.recentActions.map(action => (
                <div
                  key={action.id}
                  className="p-3 hover:bg-gray-50 transition-colors flex gap-3 items-center"
                >
                  <div className="text-xl">
                    {action.success ? (action.action.includes('Stock') ? '📦' : '🛡️') : '⚠️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {action.productTitle}
                    </div>
                    <div className="flex gap-2 text-xs text-gray-500">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          action.marketplace === 'WB'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {action.marketplace}
                      </span>
                      <span>{action.threatType}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">
                      {action.savedAmount > 0 ? `+${formatPrice(action.savedAmount)}` : 'Защищён'}
                    </div>
                    <div className="text-xs text-gray-400">{formatTime(action.createdAt)}</div>
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
    green: 'text-green-600 bg-green-50',
    red: 'text-red-600 bg-red-50',
    orange: 'text-orange-600 bg-orange-50',
    blue: 'text-blue-600 bg-blue-50',
  };

  return (
    <div className={`p-4 rounded-xl border border-gray-100 ${colorMap[color] || 'bg-gray-50'}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
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

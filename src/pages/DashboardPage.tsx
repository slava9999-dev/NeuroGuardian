import React from 'react';

// Interfaces for component props
interface StatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  highlight?: boolean;
}

interface SentinelStatus {
  is_active: boolean;
  last_check: string | null;
  next_check: string | null;
  violations_today: number;
  actions_today: number;
  saved_today: number;
  erosion_today: number;
  commission_growth_today: number;
  defense_mode: 'zero_stock' | 'price_correction';
  cron_interval_minutes: number;
  products_stats: {
    total: number;
    marketplace_counts: { marketplace: string; count: number }[];
  };
  event_counts: { event_type: string; count: number }[];
  alerts_count: number;
}

export function DashboardPage() {
  const [sentinelStatus, setSentinelStatus] = React.useState<SentinelStatus | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const initData = (window as any).Telegram?.WebApp?.initData || '';
        const headers = {
          'Content-Type': 'application/json',
          'X-Init-Data': initData,
        };

        const res = await fetch('/api/index?action=sentinel-status', { headers });

        if (res.ok) setSentinelStatus(await res.json());
      } catch (e) {
        console.error('Failed to fetch dashboard data', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-6 text-center">Загрузка данных...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Панель управления NeuroGUARDIAN</h1>

      {/* System Status Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          title="Sentinel 2.0"
          value={sentinelStatus?.is_active ? '🛡️ Активен' : '⏸️ Пауза'}
          subtitle={`Посл. проверка: ${formatTime(sentinelStatus?.last_check)}`}
          highlight={!sentinelStatus?.is_active}
        />
        <StatusCard
          title="Товары под защитой"
          value={sentinelStatus?.products_stats?.total || 0}
          subtitle={sentinelStatus?.products_stats?.marketplace_counts
            .map(p => `${p.marketplace}: ${p.count}`)
            .join(', ')}
        />
        <StatusCard
          title="Сэкономлено сегодня"
          value={`${formatMoney(sentinelStatus?.saved_today || 0)} ₽`}
          subtitle={`Действий защиты: ${sentinelStatus?.actions_today || 0}`}
        />
        <StatusCard
          title="Финансовые угрозы"
          value={
            (sentinelStatus?.erosion_today || 0) + (sentinelStatus?.commission_growth_today || 0)
          }
          subtitle={`Эрозия: ${sentinelStatus?.erosion_today || 0} | Комисии: ${sentinelStatus?.commission_growth_today || 0}`}
          highlight={(sentinelStatus?.erosion_today || 0) > 0}
        />
      </section>

      {/* Activity Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Активность (24ч)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {sentinelStatus?.event_counts?.map((event: { event_type: string; count: number }) => (
            <div
              key={event.event_type}
              className="bg-white p-4 rounded-lg shadow border border-gray-100"
            >
              <div className="text-2xl font-bold">{event.count}</div>
              <div className="text-gray-500 text-sm">{formatEventType(event.event_type)}</div>
            </div>
          ))}
          {(!sentinelStatus?.event_counts || sentinelStatus.event_counts.length === 0) && (
            <div className="text-gray-400 p-4">Нет недавней активности</div>
          )}
        </div>
      </section>

      {/* Quick Actions Placeholder */}
      <section className="bg-blue-50 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Быстрые действия</h2>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Запустить проверку цен
          </button>
          <button className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50">
            Настройки агента
          </button>
        </div>
      </section>
    </div>
  );
}

function StatusCard({ title, value, subtitle, highlight = false }: StatusCardProps) {
  return (
    <div
      className={`bg-white p-4 rounded-lg shadow border ${highlight ? 'border-orange-500 bg-orange-50' : 'border-gray-100'}`}
    >
      <div className="text-gray-500 text-sm font-medium">{title}</div>
      <div className="text-xl font-bold mt-1 truncate" title={String(value)}>
        {value}
      </div>
      {subtitle && <div className="text-gray-400 text-xs mt-1">{subtitle}</div>}
    </div>
  );
}

function formatTime(isoString: string | undefined | null): string {
  if (!isoString) return 'Ждем...';
  try {
    return new Date(isoString).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '---';
  }
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(amount));
}

function formatEventType(type: string): string {
  const map: Record<string, string> = {
    price_update_completed: 'Обновления цен',
    price_alert: 'Алерты цены',
    notification_sent: 'Уведомления',
    price_protection_run: 'Сканирования',
    product_sync: 'Синхронизации',
    system_error: 'Ошибки',
  };
  return map[type] || type.replace(/_/g, ' ');
}

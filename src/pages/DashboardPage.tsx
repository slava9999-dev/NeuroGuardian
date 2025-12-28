import React from 'react';

// Interfaces for component props
interface StatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  highlight?: boolean;
}

interface EventItem {
  event_type: string;
  count: string | number;
}

interface ProductStat {
  marketplace: string;
  count: string | number;
}

interface DashboardData {
  products: ProductStat[];
  eventsLast24h: EventItem[];
  pendingAlerts: number;
}

interface AgentStatusData {
  lastRun: { created_at: string; payload: any } | null;
  systemHealth: { status: string; checks: any };
  nextScheduledRun: string;
}

export function DashboardPage() {
  const [overview, setOverview] = React.useState<DashboardData | null>(null);
  const [agentStatus, setAgentStatus] = React.useState<AgentStatusData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewRes, statusRes] = await Promise.all([
          fetch('/api/dashboard/overview'),
          fetch('/api/dashboard/agent-status'),
        ]);

        if (overviewRes.ok) setOverview(await overviewRes.json());
        if (statusRes.ok) setAgentStatus(await statusRes.json());
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
          title="Статус агента"
          value={agentStatus?.systemHealth?.status === 'ok' ? '✅ Активен' : '⚠️ Проблемы'}
          subtitle={`Посл. запуск: ${formatTime(agentStatus?.lastRun?.created_at)}`}
        />
        <StatusCard
          title="Товары под защитой"
          value={overview?.products?.reduce((sum, p) => sum + Number(p.count), 0) || 0}
          subtitle={overview?.products?.map(p => `${p.marketplace}: ${p.count}`).join(', ')}
        />
        <StatusCard
          title="Активные уведомления"
          value={overview?.pendingAlerts || 0}
          subtitle="Требуют внимания"
          highlight={(overview?.pendingAlerts || 0) > 0}
        />
      </section>

      {/* Activity Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Активность (24ч)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {overview?.eventsLast24h?.map((event: EventItem) => (
            <div
              key={event.event_type}
              className="bg-white p-4 rounded-lg shadow border border-gray-100"
            >
              <div className="text-2xl font-bold">{event.count}</div>
              <div className="text-gray-500 text-sm">{formatEventType(event.event_type)}</div>
            </div>
          ))}
          {(!overview?.eventsLast24h || overview.eventsLast24h.length === 0) && (
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
      <div className="text-2xl font-bold mt-1">{value}</div>
      {subtitle && <div className="text-gray-400 text-xs mt-1">{subtitle}</div>}
    </div>
  );
}

function formatTime(isoString: string | undefined | null): string {
  if (!isoString) return 'Никогда';
  try {
    return new Date(isoString).toLocaleString('ru-RU');
  } catch {
    return 'Ошибка даты';
  }
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

// ============================================
// NeuroGUARDIAN — Sentinel Status Badge
// Real-time protection status indicator
// ============================================

import { useEffect, useState } from 'react';

interface SentinelStatus {
  is_active: boolean;
  last_check: string | null;
  next_check: string | null;
  violations_today: number;
  actions_today: number;
  saved_today: number;
  defense_mode: 'zero_stock' | 'price_correction';
  cron_interval_minutes: number;
}

interface SentinelStatusBadgeProps {
  className?: string;
  compact?: boolean;
}

export function SentinelStatusBadge({ className = '', compact = false }: SentinelStatusBadgeProps) {
  const [status, setStatus] = useState<SentinelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeUntilNext, setTimeUntilNext] = useState<string>('');

  // Fetch status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const initData = window.Telegram?.WebApp?.initData || '';
        const response = await fetch('/api?action=sentinel-status', {
          headers: { 'X-Init-Data': initData },
        });
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error('Failed to fetch sentinel status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();

    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate countdown
  useEffect(() => {
    if (!status?.next_check) return;

    const updateCountdown = () => {
      const nextCheck = new Date(status.next_check!);
      const now = new Date();
      const diffMs = nextCheck.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeUntilNext('сейчас');
      } else {
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        setTimeUntilNext(mins > 0 ? `${mins} мин` : `${secs} сек`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [status?.next_check]);

  if (loading) {
    return (
      <div className={`sentinel-status-badge loading ${className}`}>
        <div className="pulse-dot" />
        <span>Загрузка...</span>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  // Compact version for header
  if (compact) {
    return (
      <div className={`sentinel-status-badge compact ${className}`}>
        <div className={`status-dot ${status.is_active ? 'active' : 'inactive'}`} />
        <span>{status.is_active ? <>🛡️ {timeUntilNext}</> : '⏸️ Выкл'}</span>
      </div>
    );
  }

  // Full version
  return (
    <div
      className={`sentinel-status-badge full ${status.is_active ? 'active' : 'inactive'} ${className}`}
    >
      {/* Header */}
      <div className="status-header">
        <div className={`status-indicator ${status.is_active ? 'active' : 'inactive'}`}>
          <div className="pulse-dot" />
          <span className="status-text">
            {status.is_active ? 'Защита активна' : 'Защита отключена'}
          </span>
        </div>
        {status.is_active && timeUntilNext && (
          <div className="next-check">Проверка через {timeUntilNext}</div>
        )}
      </div>

      {/* Stats */}
      {status.is_active && (
        <div className="status-stats">
          <div className="stat">
            <span className="stat-value">{status.violations_today}</span>
            <span className="stat-label">Нарушений</span>
          </div>
          <div className="stat">
            <span className="stat-value">{status.actions_today}</span>
            <span className="stat-label">Защит</span>
          </div>
          <div className="stat">
            <span className="stat-value">{status.saved_today}₽</span>
            <span className="stat-label">Сохранено</span>
          </div>
        </div>
      )}

      {/* Defense Mode */}
      <div className="defense-mode">
        <span className="mode-icon">{status.defense_mode === 'zero_stock' ? '📦' : '💰'}</span>
        <span className="mode-text">
          {status.defense_mode === 'zero_stock' ? 'Обнуление остатков' : 'Коррекция цены'}
        </span>
      </div>

      <style>{`
        .sentinel-status-badge {
          background: var(--card-bg, #1a1a2e);
          border-radius: 12px;
          padding: 12px 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .sentinel-status-badge.compact {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.1);
          font-size: 14px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.active {
          background: #22c55e;
          box-shadow: 0 0 8px #22c55e;
          animation: pulse 2s ease-in-out infinite;
        }

        .status-dot.inactive {
          background: #6b7280;
        }

        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pulse-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #22c55e;
        }

        .sentinel-status-badge.active .pulse-dot {
          animation: pulse 2s ease-in-out infinite;
        }

        .sentinel-status-badge.inactive .pulse-dot {
          background: #6b7280;
          animation: none;
        }

        .status-text {
          font-weight: 600;
          color: #fff;
        }

        .next-check {
          font-size: 12px;
          color: #9ca3af;
        }

        .status-stats {
          display: flex;
          justify-content: space-around;
          margin: 16px 0;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
        }

        .stat {
          text-align: center;
        }

        .stat-value {
          display: block;
          font-size: 20px;
          font-weight: 700;
          color: #22c55e;
        }

        .stat-label {
          font-size: 11px;
          color: #9ca3af;
        }

        .defense-mode {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #d1d5db;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .loading {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}

export default SentinelStatusBadge;

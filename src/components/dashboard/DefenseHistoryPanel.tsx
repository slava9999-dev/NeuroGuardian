// ============================================
// NeuroGUARDIAN — Defense History Panel
// Shows recent protection actions
// ============================================

import { useEffect, useState } from 'react';

interface DefenseLog {
  id: number;
  timestamp: string;
  product_id: string;
  product_title: string;
  detected_price: number;
  min_price: number;
  defense_action: string;
  saved_amount: number;
  marketplace: string;
  success: boolean;
}

interface DefenseHistoryPanelProps {
  limit?: number;
  className?: string;
}

export function DefenseHistoryPanel({ limit = 5, className = '' }: DefenseHistoryPanelProps) {
  const [logs, setLogs] = useState<DefenseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'WB' | 'Ozon'>('all');

  // Fetch history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const initData = window.Telegram?.WebApp?.initData || '';
        const url =
          filter === 'all'
            ? `/api?action=defense-history&limit=${limit}`
            : `/api?action=defense-history&limit=${limit}&marketplace=${filter}`;

        const response = await fetch(url, {
          headers: { 'X-Init-Data': initData },
        });
        const data = await response.json();
        setLogs(data.logs || []);
      } catch (error) {
        console.error('Failed to fetch defense history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [limit, filter]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    return date.toLocaleDateString('ru-RU');
  };

  if (loading) {
    return (
      <div className={`defense-history-panel loading ${className}`}>
        <div className="skeleton-loader" />
      </div>
    );
  }

  return (
    <div className={`defense-history-panel ${className}`}>
      {/* Header */}
      <div className="panel-header">
        <h3>📋 История защиты</h3>
        <div className="filter-buttons">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            Все
          </button>
          <button className={filter === 'WB' ? 'active' : ''} onClick={() => setFilter('WB')}>
            🟣 WB
          </button>
          <button className={filter === 'Ozon' ? 'active' : ''} onClick={() => setFilter('Ozon')}>
            🔵 Ozon
          </button>
        </div>
      </div>

      {/* List */}
      {logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🛡️</div>
          <p>Нет записей о защите</p>
          <span>Когда сработает защита, здесь появится история</span>
        </div>
      ) : (
        <div className="log-list">
          {logs.map(log => (
            <div key={log.id} className={`log-item ${log.success ? 'success' : 'failed'}`}>
              <div className="log-icon">{log.marketplace === 'WB' ? '🟣' : '🔵'}</div>
              <div className="log-content">
                <div className="log-title">
                  {log.product_title.substring(0, 30)}
                  {log.product_title.length > 30 ? '...' : ''}
                </div>
                <div className="log-action">
                  {log.defense_action === 'Zero Stock' ? '📦 Остатки обнулены' : '💰 Цена повышена'}
                </div>
                <div className="log-price">
                  <span className="old-price">{log.detected_price}₽</span>
                  <span className="arrow">→</span>
                  <span className="new-price">{log.min_price}₽</span>
                  {log.saved_amount > 0 && <span className="saved">+{log.saved_amount}₽</span>}
                </div>
              </div>
              <div className="log-time">{formatTime(log.timestamp)}</div>
              <div className={`log-status ${log.success ? 'success' : 'failed'}`}>
                {log.success ? '✅' : '❌'}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .defense-history-panel {
          background: var(--card-bg, #1a1a2e);
          border-radius: 16px;
          padding: 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #fff;
        }

        .filter-buttons {
          display: flex;
          gap: 4px;
        }

        .filter-buttons button {
          padding: 4px 10px;
          border: none;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.1);
          color: #9ca3af;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-buttons button.active {
          background: #22c55e;
          color: #fff;
        }

        .filter-buttons button:hover:not(.active) {
          background: rgba(255, 255, 255, 0.2);
        }

        .log-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .log-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          border-left: 3px solid #22c55e;
        }

        .log-item.failed {
          border-left-color: #ef4444;
        }

        .log-icon {
          font-size: 20px;
        }

        .log-content {
          flex: 1;
          min-width: 0;
        }

        .log-title {
          font-weight: 500;
          color: #fff;
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .log-action {
          font-size: 12px;
          color: #9ca3af;
          margin: 2px 0;
        }

        .log-price {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
        }

        .old-price {
          color: #ef4444;
          text-decoration: line-through;
        }

        .arrow {
          color: #6b7280;
        }

        .new-price {
          color: #22c55e;
          font-weight: 600;
        }

        .saved {
          color: #22c55e;
          font-size: 11px;
          background: rgba(34, 197, 94, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 4px;
        }

        .log-time {
          font-size: 11px;
          color: #6b7280;
          white-space: nowrap;
        }

        .log-status {
          font-size: 16px;
        }

        .empty-state {
          text-align: center;
          padding: 32px;
          color: #9ca3af;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
          opacity: 0.5;
        }

        .empty-state p {
          margin: 0 0 4px;
          font-weight: 500;
          color: #fff;
        }

        .empty-state span {
          font-size: 13px;
        }

        .skeleton-loader {
          height: 200px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

export default DefenseHistoryPanel;

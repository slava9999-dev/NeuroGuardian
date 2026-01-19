// ============================================
// NeuroGUARDIAN — LogConsole Component
// Real-time event log panel
// ============================================

import { useRef, useEffect } from 'react';
import { useLogsStore } from '../../stores';
import type { LogEntry, LogType } from '../../types';

const logTypeConfig: Record<LogType, { icon: string; color: string; bg: string }> = {
  price_drop: {
    icon: '📉',
    color: 'text-red-400',
    bg: 'bg-rose-50',
  },
  defense_triggered: {
    icon: '🛡️',
    color: 'text-amber-400',
    bg: 'bg-amber-50',
  },
  sync: {
    icon: '🔄',
    color: 'text-blue-400',
    bg: 'bg-blue-50',
  },
  error: {
    icon: '❌',
    color: 'text-red-500',
    bg: 'bg-rose-50',
  },
  info: {
    icon: 'ℹ️',
    color: 'text-slate-400',
    bg: 'bg-slate-50',
  },
};

function LogItem({ log, onMarkRead }: { log: LogEntry; onMarkRead: () => void }) {
  const config = logTypeConfig[log.type];

  return (
    <div
      onClick={onMarkRead}
      className={`
        relative p-3 rounded-xl cursor-pointer transition-all
        ${config.bg} ${!log.isRead ? 'border-l-2 border-amber-500' : ''}
        hover:bg-slate-100
      `}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className="text-lg">{config.icon}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-medium ${config.color}`}>{log.title}</span>
            {!log.isRead && <span className="w-2 h-2 bg-amber-500 rounded-full" />}
          </div>
          <p className="text-sm text-slate-500 line-clamp-2">{log.message}</p>

          {/* Metadata */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {log.metadata.oldPrice !== undefined && log.metadata.newPrice !== undefined && (
                <span className="text-xs px-2 py-0.5 bg-slate-100 rounded-full text-slate-500">
                  {log.metadata.oldPrice} → {log.metadata.newPrice} ₽
                </span>
              )}
              {log.metadata.marketplace && (
                <span
                  className={`
                  text-xs px-2 py-0.5 rounded-full
                  ${
                    log.metadata.marketplace === 'WB'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }
                `}
                >
                  {log.metadata.marketplace}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Time */}
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {formatTime(log.createdAt)}
        </span>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'Только что';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч`;

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function LogConsole() {
  const { logs, isConsoleOpen, unreadCount, toggleConsole, markAsRead, markAllAsRead } =
    useLogsStore();
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top on new logs
  useEffect(() => {
    if (listRef.current && isConsoleOpen) {
      listRef.current.scrollTop = 0;
    }
  }, [logs.length, isConsoleOpen]);

  return (
    <>
      {/* Toggle button (floating) */}
      <button
        onClick={toggleConsole}
        className={`
          fixed bottom-6 right-6 z-40
          flex items-center gap-2 px-4 py-3 rounded-full
          shadow-lg transition-all
          ${
            isConsoleOpen
              ? 'bg-amber-500 text-white'
              : 'bg-white text-slate-700 border border-slate-200'
          }
        `}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        <span className="font-medium">Лог</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full text-xs text-white flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Console panel (slide up) */}
      {isConsoleOpen && (
        <>
          {/* Backdrop */}
          <div onClick={toggleConsole} className="fixed inset-0 bg-slate-900/30 z-40" />

          {/* Panel */}
          <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] bg-white rounded-t-3xl overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Журнал событий</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-sm rounded-full">
                    {unreadCount} новых
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    Прочитать все
                  </button>
                )}
                <button
                  onClick={toggleConsole}
                  className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Log list */}
            <div ref={listRef} className="overflow-y-auto max-h-[calc(70vh-80px)] p-4 space-y-2">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <svg
                    className="w-12 h-12 mb-3 opacity-50"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <p>Журнал пуст</p>
                </div>
              ) : (
                <>
                  {logs.map(log => (
                    <LogItem key={log.id} log={log} onMarkRead={() => markAsRead(log.id)} />
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

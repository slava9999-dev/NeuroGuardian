// ============================================
// NeuroGUARDIAN — Sentinel Log History
// Shows recent protection triggers with details
// ============================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hapticFeedback } from '../../lib/telegram';

interface SentinelLog {
  id: number;
  productId: string;
  productTitle: string;
  detectedPrice: number;
  minPrice: number;
  defenseAction: string;
  savedAmount: number;
  marketplace: string;
  createdAt: string;
}

interface LogSummary {
  totalTriggers: number;
  totalSaved: number;
  uniqueProducts: number;
}

interface LogHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

const PERIOD_OPTIONS = [
  { value: 7, label: '7 дней' },
  { value: 14, label: '14 дней' },
  { value: 30, label: '30 дней' },
];

export function LogHistory({ isOpen, onClose }: LogHistoryProps) {
  const [logs, setLogs] = useState<SentinelLog[]>([]);
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(7);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, selectedPeriod]);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api?action=sentinel-logs&days=${selectedPeriod}&limit=50`, {
        headers: {
          'x-init-data': window.Telegram?.WebApp?.initData || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Error fetching sentinel logs:', err);
      setError('Не удалось загрузить историю');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;

    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'zero_stock':
        return { icon: '🛑', color: 'text-red-400', bg: 'bg-red-500/20' };
      case 'price_correction':
        return { icon: '💰', color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
      default:
        return { icon: '⚡', color: 'text-amber-400', bg: 'bg-amber-500/20' };
    }
  };

  const getMarketplaceColor = (marketplace: string) => {
    return marketplace === 'WB' ? 'text-purple-400' : 'text-blue-400';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] bg-stone-900 rounded-t-3xl sm:rounded-3xl border border-stone-700/50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 pb-4 border-b border-stone-800 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <span className="text-2xl">📊</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">История защиты</h2>
                    <p className="text-sm text-stone-400">Срабатывания Sentinel</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center hover:bg-stone-700 transition-colors"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-stone-400"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Period selector */}
              <div className="flex gap-2">
                {PERIOD_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSelectedPeriod(option.value);
                      hapticFeedback('light');
                    }}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedPeriod === option.value
                        ? 'bg-violet-500 text-white'
                        : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            {summary && !isLoading && (
              <div className="px-6 py-4 border-b border-stone-800 flex-shrink-0">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-xl bg-stone-800/50">
                    <div className="text-xl font-bold text-violet-400">{summary.totalTriggers}</div>
                    <div className="text-xs text-stone-500">Срабатываний</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-stone-800/50">
                    <div className="text-xl font-bold text-emerald-400">
                      {summary.totalSaved > 0 ? `${(summary.totalSaved / 1000).toFixed(1)}k` : '0'}
                    </div>
                    <div className="text-xs text-stone-500">Спасено ₽</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-stone-800/50">
                    <div className="text-xl font-bold text-amber-400">{summary.uniqueProducts}</div>
                    <div className="text-xs text-stone-500">Товаров</div>
                  </div>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <motion.div
                    className="w-10 h-10 border-3 border-violet-500/30 border-t-violet-500 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  <p className="text-stone-400 mt-4">Загрузка...</p>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <span className="text-4xl mb-4 block">⚠️</span>
                  <p className="text-red-400">{error}</p>
                  <button
                    onClick={fetchLogs}
                    className="mt-4 px-4 py-2 rounded-xl bg-stone-800 text-stone-300 hover:bg-stone-700 transition-colors"
                  >
                    Попробовать снова
                  </button>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-4xl mb-4 block">🛡️</span>
                  <p className="text-stone-400 font-medium">Пока нет срабатываний</p>
                  <p className="text-stone-500 text-sm mt-2">
                    Sentinel отслеживает цены ваших товаров
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log, index) => {
                    const actionStyle = getActionIcon(log.defenseAction);
                    return (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 rounded-xl bg-stone-800/50 border border-stone-700/30"
                      >
                        <div className="flex items-start gap-3">
                          {/* Action icon */}
                          <div
                            className={`w-10 h-10 rounded-xl ${actionStyle.bg} flex items-center justify-center flex-shrink-0`}
                          >
                            <span className="text-lg">{actionStyle.icon}</span>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-white truncate">
                                {log.productTitle || log.productId}
                              </p>
                              <span
                                className={`text-xs font-medium ${getMarketplaceColor(log.marketplace)}`}
                              >
                                {log.marketplace}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-xs">
                              <span className="text-stone-500">Цена:</span>
                              <span className="text-red-400 line-through">
                                {log.detectedPrice.toLocaleString('ru-RU')} ₽
                              </span>
                              <span className="text-stone-500">→</span>
                              <span className="text-amber-400 font-medium">
                                min {log.minPrice.toLocaleString('ru-RU')} ₽
                              </span>
                            </div>

                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-stone-500">
                                {formatDate(log.createdAt)}
                              </span>
                              {log.savedAmount > 0 && (
                                <span className="text-xs font-medium text-emerald-400">
                                  +{log.savedAmount.toLocaleString('ru-RU')} ₽ сохранено
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-stone-800 flex-shrink-0">
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-stone-800 text-stone-300 font-medium hover:bg-stone-700 transition-colors"
              >
                Закрыть
              </button>
            </div>

            {/* Safe area for mobile */}
            <div className="h-4 sm:hidden flex-shrink-0" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

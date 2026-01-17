// ============================================
// NeuroGUARDIAN — Products Page V3.1
// NEURO-UI: Premium Obsidian Design
// ============================================

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Package, History, Upload, Search, Filter, Zap, AlertTriangle } from 'lucide-react';
import { useAppStore, useProductsStore } from '../stores';
import { GlobalSwitch } from '../components/controls/GlobalSwitch';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';
import { BulkStopLossModal } from '../components/dashboard/BulkStopLossModal';
import { BulkUpdateCostsModal } from '../components/dashboard/BulkUpdateCostsModal';
import { LogHistory } from '../components/dashboard/LogHistory';
import { hapticFeedback } from '../lib/telegram';
import { ViktorCore } from '../components/ui/ViktorCore';

// Format money
function formatMoney(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M ₽`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K ₽`;
  return `${amount} ₽`;
}

interface ProductsPageProps {
  onBack: () => void;
}

export function ProductsPage({ onBack }: ProductsPageProps) {
  const user = useAppStore(state => state.user);
  const products = useProductsStore(state => state.products);

  const searchQuery = useProductsStore(state => state.searchQuery);
  const setSearchQuery = useProductsStore(state => state.setSearchQuery);
  const marketplaceFilter = useProductsStore(state => state.marketplaceFilter);
  const setMarketplaceFilter = useProductsStore(state => state.setMarketplaceFilter);
  const statusFilter = useProductsStore(state => state.statusFilter);
  const setStatusFilter = useProductsStore(state => state.setStatusFilter);

  const [showBulkStopLoss, setShowBulkStopLoss] = useState(false);
  const [showBulkCosts, setShowBulkCosts] = useState(false);
  const [showLogHistory, setShowLogHistory] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Calculate stats
  const stats = useMemo(() => {
    const protectedCount = products.filter(p => p.minPrice > 0).length;
    const triggeredCount = products.filter(p => p.status === 'triggered').length;
    const lossCount = products.filter(p => p.costPrice && p.currentPrice < p.costPrice).length;
    return {
      total: products.length,
      protected: protectedCount,
      unprotected: products.length - protectedCount,
      triggered: triggeredCount,
      lossCount,
      savedAmount: user?.savedAmount ?? 0,
    };
  }, [products, user]);

  // Filter products by search - TODO: connect to DashboardGrid
  // const filteredProducts = useMemo(() => {
  //   if (!searchQuery.trim()) return products;
  //   const q = searchQuery.toLowerCase();
  //   return products.filter(p =>
  //     p.title.toLowerCase().includes(q) ||
  //     p.vendorCode?.toLowerCase().includes(q) ||
  //     p.productId.toLowerCase().includes(q)
  //   );
  // }, [products, searchQuery]);

  return (
    <div className="min-h-full pb-24 relative">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Back + Title */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={onBack}
                className="p-2.5 rounded-full hover:bg-white/5 transition-all text-zinc-400 shrink-0"
                aria-label="Назад"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-black italic uppercase tracking-tighter text-white">
                  Товары
                </h1>
                <p className="text-[10px] font-mono text-zinc-500 uppercase">
                  {stats.total} SKU • {stats.protected} ЗАЩИЩЕНО
                </p>
              </div>
            </div>

            {/* Global Switch */}
            <div className="shrink-0">
              <GlobalSwitch compact />
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 px-4 py-6 space-y-6">
        {/* Loss Products Alert */}
        {stats.lossCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-2xl bg-danger/5 border border-danger/20 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-danger uppercase tracking-wide">
                ВНИМАНИЕ: {stats.lossCount} {stats.lossCount === 1 ? 'ТОВАР' : 'ТОВАРОВ'} В УБЫТКЕ
              </p>
              <p className="text-[9px] text-zinc-500 uppercase font-bold mt-0.5">
                Цена продажи ниже себестоимости
              </p>
            </div>
            <button className="text-[10px] font-black underline uppercase text-danger/80 hover:text-danger tracking-wider">
              ОБЗОР
            </button>
          </motion.div>
        )}

        {/* Stats Row - Minimal & Unified */}
        <div className="grid grid-cols-4 gap-2">
          <div className="surface-card p-3 text-center rounded-2xl">
            <p className="text-lg font-black text-white">{stats.total}</p>
            <p className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.2em]">Всего</p>
          </div>
          <div className="surface-card p-3 text-center rounded-2xl border-primary/20 bg-primary/2">
            <p className="text-lg font-black text-primary">{stats.protected}</p>
            <p className="text-[8px] text-primary/40 font-black uppercase tracking-[0.2em]">
              Защита
            </p>
          </div>
          <div className="surface-card p-3 text-center rounded-2xl">
            <p className="text-lg font-black text-zinc-400">{stats.unprotected}</p>
            <p className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.2em]">Без</p>
          </div>
          <div
            className={`surface-card p-3 text-center rounded-2xl ${stats.triggered > 0 ? 'border-danger/30 bg-danger/5' : ''}`}
          >
            <p
              className={`text-lg font-black ${stats.triggered > 0 ? 'text-danger' : 'text-zinc-600'}`}
            >
              {stats.triggered}
            </p>
            <p className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.2em]">Риск</p>
          </div>
        </div>

        {/* Saved Amount */}
        {stats.savedAmount > 0 && (
          <motion.div
            className="p-5 rounded-2xl bg-linear-to-br from-success/10 to-transparent border border-success/20 relative overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-1">
                  СЭКОНОМЛЕНО СИСТЕМОЙ
                </p>
                <p className="text-3xl font-black italic text-success tracking-tighter">
                  {formatMoney(stats.savedAmount)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center border border-success/20">
                <Zap className="w-6 h-6 text-success shadow-[0_0_15px_rgba(52,211,153,0.3)]" />
              </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 blur-[50px] -mr-16 -mt-16 rounded-full" />
          </motion.div>
        )}

        {/* Search + Filter Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию или ID..."
              className="w-full bg-white/2 border border-white/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-zinc-700 focus:border-primary/40 focus:bg-white/5 focus:outline-none transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 rounded-2xl border transition-all ${
              showFilters || marketplaceFilter !== 'all' || statusFilter !== 'all'
                ? 'bg-primary/20 border-primary/40 text-primary'
                : 'bg-white/2 border-white/5 text-zinc-500 hover:text-white'
            }`}
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Panel (collapsed by default) */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 space-y-4">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 font-black">
                    Маркетплейс
                  </p>
                  <div className="flex gap-2">
                    {(['all', 'WB', 'Ozon'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setMarketplaceFilter(m)}
                        className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                          marketplaceFilter === m
                            ? 'bg-primary border-primary text-black'
                            : 'bg-white/2 border-white/5 text-zinc-500 hover:text-white'
                        }`}
                      >
                        {m === 'all' ? 'ВСЕ' : m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 font-black">
                    Статус
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'all', label: 'ВСЕ СТАТУСЫ' },
                        { id: 'active', label: 'АКТИВНЫЕ' },
                        { id: 'protected', label: 'ПОД ЗАЩИТОЙ' },
                        { id: 'triggered', label: 'АТАКИ' },
                      ] as const
                    ).map(s => (
                      <button
                        key={s.id}
                        onClick={() => setStatusFilter(s.id)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                          statusFilter === s.id
                            ? 'bg-primary border-primary text-black'
                            : 'bg-white/2 border-white/5 text-zinc-500 hover:text-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons Row */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              hapticFeedback('medium');
              setShowBulkStopLoss(true);
            }}
            className="flex-1 py-4 btn-premium text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            ЗАЩИТИТЬ ВСЕ
          </button>

          <button
            onClick={() => {
              hapticFeedback('light');
              setShowBulkCosts(true);
            }}
            className="p-4 rounded-2xl bg-white/2 border border-white/5 text-zinc-400 hover:bg-white/5 hover:text-white transition-all"
            title="Загрузить себестоимость"
          >
            <Upload className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              hapticFeedback('light');
              setShowLogHistory(true);
            }}
            className="p-4 rounded-2xl bg-white/2 border border-white/5 text-zinc-400 hover:bg-white/5 hover:text-white transition-all"
            title="История действий"
          >
            <History className="w-5 h-5" />
          </button>
        </div>

        {/* Products Grid */}
        <div className="min-h-[200px]">
          <DashboardGrid />
        </div>

        {/* Empty State */}
        {products.length === 0 && (
          <div className="text-center py-20 border border-white/5 border-dashed rounded-3xl">
            <div className="w-20 h-20 rounded-full bg-white/2 flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-zinc-800" />
            </div>
            <h3 className="text-lg font-black italic uppercase text-white mb-2">Каталог пуст</h3>
            <p className="text-zinc-600 text-sm max-w-[200px] mx-auto font-medium mb-8">
              Подключите API ключи в параметрах для синхронизации товаров.
            </p>
            <button
              onClick={() => onBack()}
              className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline transition-all"
            >
              ПЕРЕЙТИ К НАСТРОЙКАМ
            </button>
          </div>
        )}

        {/* Agent Hint */}
        {products.length > 0 && (
          <motion.div
            className="p-5 rounded-2xl bg-primary/2 border border-primary/10 flex items-center gap-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <ViktorCore size="sm" />
            <div className="flex-1">
              <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">
                СОВЕТ ВИКТОРА
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Попробуйте сказать <span className="text-primary font-bold">"защити всё"</span> на
                вкладке Агента для быстрой настройки системы.
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showBulkStopLoss && (
          <BulkStopLossModal isOpen={showBulkStopLoss} onClose={() => setShowBulkStopLoss(false)} />
        )}
        {showBulkCosts && (
          <BulkUpdateCostsModal isOpen={showBulkCosts} onClose={() => setShowBulkCosts(false)} />
        )}
        {showLogHistory && (
          <LogHistory isOpen={showLogHistory} onClose={() => setShowLogHistory(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProductsPage;

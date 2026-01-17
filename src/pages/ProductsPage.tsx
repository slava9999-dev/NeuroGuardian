// ============================================
// NeuroGUARDIAN — Products Page V3.1
// NEURO-UI: Premium Obsidian Design
// ============================================

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
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

  const [showBulkStopLoss, setShowBulkStopLoss] = useState(false);
  const [showBulkCosts, setShowBulkCosts] = useState(false);
  const [showLogHistory, setShowLogHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
    <div className="min-h-screen pb-24 relative overflow-hidden">
      {/* Cosmic Background Layer (Local override for depth) */}
      <div className="fixed inset-0 bg-cosmic z-[-2]" />
      <div className="fixed inset-0 nebula-glow z-[-1]" />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#02040a]/80 backdrop-blur-2xl border-b border-white/5">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Back + Title */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 shrink-0"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-white">Товары</h1>
                <p className="text-[11px] text-slate-500">
                  {stats.total} • {stats.protected} защищено
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

      <div className="relative z-10 px-4 py-4 space-y-4">
        {/* Loss Products Alert */}
        {stats.lossCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-rose-400">
                {stats.lossCount} товаров в убытке
              </p>
              <p className="text-xs text-slate-400">Цена ниже себестоимости</p>
            </div>
            <button className="text-xs text-rose-400 hover:text-rose-300 font-medium">
              Показать
            </button>
          </motion.div>
        )}

        {/* Stats Row - Minimal & Unified */}
        <div className="grid grid-cols-4 gap-2">
          <motion.div className="surface-card p-3 text-center" whileHover={{ scale: 1.02 }}>
            <p className="text-xl font-bold font-mono text-white">{stats.total}</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Всего</p>
          </motion.div>
          <motion.div
            className="surface-card p-3 text-center border-emerald-500/20 shadow-success-v5"
            whileHover={{ scale: 1.05, translateY: -2 }}
          >
            <p className="text-xl font-bold font-mono text-emerald-400">{stats.protected}</p>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Актив</p>
          </motion.div>
          <motion.div className="surface-card p-3 text-center" whileHover={{ scale: 1.02 }}>
            <p className="text-xl font-bold font-mono text-slate-400">{stats.unprotected}</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Без</p>
          </motion.div>
          <motion.div
            className={`surface-card p-3 text-center ${stats.triggered > 0 ? 'border-rose-500/30' : ''}`}
            whileHover={{ scale: 1.02 }}
          >
            <p
              className={`text-xl font-bold font-mono ${stats.triggered > 0 ? 'text-rose-400' : 'text-slate-500'}`}
            >
              {stats.triggered}
            </p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Триггер</p>
          </motion.div>
        </div>

        {/* Saved Amount */}
        {stats.savedAmount > 0 && (
          <motion.div
            className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Сэкономлено благодаря защите</p>
                <p className="text-2xl font-bold font-mono text-emerald-400">
                  {formatMoney(stats.savedAmount)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-success-v5">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Search + Filter Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск товаров или ID..."
              className="w-full bg-[#0a0c14]/50 border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 focus:outline-none transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-2xl border transition-all ${
              showFilters
                ? 'bg-violet-500/20 border-violet-500/40 text-violet-400 shadow-neon-v5'
                : 'bg-[#0a0c14]/50 border-white/5 text-slate-500 hover:text-white'
            }`}
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Panel (collapsed by default) */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-slate-900/50 border border-white/5 space-y-3"
          >
            <p className="text-xs text-slate-500 uppercase tracking-wider">Фильтры</p>
            <div className="flex flex-wrap gap-2">
              <button className="px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 text-xs">
                Все
              </button>
              <button className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/5 text-slate-400 text-xs hover:text-white">
                Защищённые
              </button>
              <button className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/5 text-slate-400 text-xs hover:text-white">
                Без защиты
              </button>
              <button className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/5 text-slate-400 text-xs hover:text-white">
                В убытке
              </button>
            </div>
          </motion.div>
        )}

        {/* Action Buttons Row */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              hapticFeedback('light');
              setShowBulkStopLoss(true);
            }}
            className="flex-1 py-4 px-4 btn-premium gap-2"
          >
            <Shield className="w-4 h-4" />
            <span className="text-sm">Защитить Все</span>
          </button>

          <button
            onClick={() => {
              hapticFeedback('light');
              setShowBulkCosts(true);
            }}
            className="p-3 rounded-xl bg-slate-800/50 border border-white/5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
            title="Загрузить себестоимость"
          >
            <Upload className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              hapticFeedback('light');
              setShowLogHistory(true);
            }}
            className="p-3 rounded-xl bg-slate-800/50 border border-white/5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
            title="История защиты"
          >
            <History className="w-5 h-5" />
          </button>
        </div>

        {/* Products Grid */}
        <DashboardGrid />

        {/* Empty State */}
        {products.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Нет товаров</h3>
            <p className="text-slate-400 text-sm max-w-xs mx-auto mb-6">
              Подключите API маркетплейса в настройках, чтобы синхронизировать товары
            </p>
            <button onClick={onBack} className="btn-primary px-6 py-3">
              Перейти в настройки
            </button>
          </motion.div>
        )}

        {/* Agent Hint */}
        {products.length > 0 && (
          <motion.div
            className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/20 flex items-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <ViktorCore size="sm" />
            <p className="text-sm text-slate-300 flex-1 leading-relaxed">
              💡 <b>Victor Pulse:</b> Try saying{' '}
              <span className="text-violet-400 font-medium italic">"защити всё"</span> в the Agent
              tab.
            </p>
          </motion.div>
        )}
      </div>

      {/* Modals */}
      <BulkStopLossModal isOpen={showBulkStopLoss} onClose={() => setShowBulkStopLoss(false)} />
      <BulkUpdateCostsModal isOpen={showBulkCosts} onClose={() => setShowBulkCosts(false)} />
      {showLogHistory && (
        <LogHistory isOpen={showLogHistory} onClose={() => setShowLogHistory(false)} />
      )}
    </div>
  );
}

export default ProductsPage;

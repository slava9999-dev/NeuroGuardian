// ============================================
// NeuroGUARDIAN — Products Page V6.0 (Human)
// Aesthetic: Clean, Spacious, Light Mode
// ============================================

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Package,
  History,
  Upload,
  Search,
  Filter,
  ArrowLeft,
  Settings,
  RefreshCcw,
} from 'lucide-react';
import { useProductsStore } from '../stores';
import { productsApi } from '../lib/api';
import { GlobalSwitch } from '../components/controls/GlobalSwitch';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';
import { BulkStopLossModal } from '../components/dashboard/BulkStopLossModal';
import { BulkUpdateCostsModal } from '../components/dashboard/BulkUpdateCostsModal';
import { LogHistory } from '../components/dashboard/LogHistory';
import { hapticFeedback } from '../lib/telegram';
import { ViktorCore } from '../components/ui/ViktorCore';
import type { Product } from '../types';

// Modules
import { ProductSMMModal } from '../components/dashboard/ProductSMMModal';
import { ProductMediaModal } from '../components/dashboard/ProductMediaModal';
import { PriceCalculator } from '../components/dashboard/PriceCalculator';

export function ProductsPage({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate?: (page: string) => void;
}) {
  // const user = useAppStore(state => state.user); // Unused for now
  const {
    products,
    searchQuery,
    setSearchQuery,
    setProducts,
    marketplaceFilter,
    setMarketplaceFilter,
    statusFilter,
    setStatusFilter,
  } = useProductsStore();

  const [isSyncing, setIsSyncing] = useState(false);
  const [showBulkStopLoss, setShowBulkStopLoss] = useState(false);
  const [showBulkCosts, setShowBulkCosts] = useState(false);
  const [showLogHistory, setShowLogHistory] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const refreshProducts = async () => {
    try {
      const res = await productsApi.getProducts();
      if (res.success) {
        setProducts(res.products as unknown as Product[]);
      }
    } catch (e) {
      console.error('Failed to refresh products:', e);
    }
  };

  const [selectedForSMM, setSelectedForSMM] = useState<Product | null>(null);
  const [selectedForCalculator, setSelectedForCalculator] = useState<Product | null>(null);
  const [selectedForMedia, setSelectedForMedia] = useState<Product | null>(null);

  // Calculate stats
  const stats = useMemo(() => {
    const protectedCount = products.filter(p => p.minPrice > 0).length;
    const triggeredCount = products.filter(p => p.status === 'triggered').length;
    return {
      total: products.length,
      protected: protectedCount,
      unprotected: products.length - protectedCount,
      triggered: triggeredCount,
    };
  }, [products]);

  return (
    <div className="min-h-full pb-24 bg-zinc-950 relative overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="bg-cosmic" />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Back + Title */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => {
                  hapticFeedback('light');
                  onBack();
                }}
                className="p-2.5 rounded-full hover:bg-slate-100 transition-all text-slate-500 shrink-0"
                aria-label="Назад"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-white tracking-tight">Товары</h1>
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                  {stats.total} SKU • {stats.protected} Active
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={() => {
                  hapticFeedback('light');
                  onNavigate?.('settings');
                }}
                className="p-2 rounded-full hover:bg-slate-100 transition-all text-slate-400 hover:text-indigo-600"
                aria-label="Настройки"
              >
                <Settings className="w-5 h-5" />
              </button>
              <GlobalSwitch compact />
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 px-4 py-6 space-y-6">
        {/* Helper Hint from Viktor */}
        {products.length > 0 && stats.unprotected > 0 && (
          <motion.div
            className="p-4 rounded-2xl bg-white border border-indigo-100 shadow-sm flex items-start gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="shrink-0 mt-0.5">
              <ViktorCore size="sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-indigo-600 mb-1">Совет</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                У вас {stats.unprotected} товаров без защиты. Нажмите "Защитить все", чтобы
                автоматически рассчитать стоп-лоссы.
              </p>
            </div>
          </motion.div>
        )}

        {/* Search + Filter Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск..."
              className="w-full bg-white/2 border border-white/5 rounded-2xl pl-10 pr-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all shadow-xl"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 rounded-2xl border transition-all shadow-sm ${
              showFilters || marketplaceFilter !== 'all' || statusFilter !== 'all'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
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
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-2 font-bold">
                    Маркетплейс
                  </p>
                  <div className="flex gap-2">
                    {(['all', 'WB', 'Ozon'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setMarketplaceFilter(m)}
                        className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                          marketplaceFilter === m
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {m === 'all' ? 'ВСЕ' : m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-2 font-bold">
                    Статус
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'all', label: 'ВСЕ' },
                        { id: 'active', label: 'АКТИВНЫЕ' },
                        { id: 'protected', label: 'ЗАЩИТА' },
                        { id: 'triggered', label: 'АТАКИ' },
                      ] as const
                    ).map(s => (
                      <button
                        key={s.id}
                        onClick={() => setStatusFilter(s.id)}
                        className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                          statusFilter === s.id
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
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

        {/* Quick Actions Row */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <button
            onClick={() => {
              hapticFeedback('medium');
              setShowBulkStopLoss(true);
            }}
            className="flex-1 min-w-[140px] py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            ЗАЩИТИТЬ ВСЕ
          </button>

          <button
            disabled={isSyncing}
            onClick={async () => {
              hapticFeedback('medium');
              setIsSyncing(true);
              try {
                await productsApi.syncProducts('WB');
                await productsApi.syncProducts('Ozon');
                await refreshProducts(); // Use locally defined refresh
                hapticFeedback('success');
                alert('Синхронизация завершена успешно!');
              } catch (e) {
                console.error(e);
                hapticFeedback('error');
                alert('Ошибка синхронизации. Проверьте настройки API.');
              } finally {
                setIsSyncing(false);
              }
            }}
            className="p-3 min-w-[48px] rounded-xl bg-white/2 border border-white/10 text-zinc-500 hover:text-primary hover:border-primary/30 transition-all shadow-sm flex items-center justify-center disabled:opacity-50"
            title="Синхронизировать с маркетплейсом"
          >
            <RefreshCcw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              hapticFeedback('light');
              setShowBulkCosts(true);
            }}
            className="p-3 min-w-[48px] rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm flex items-center justify-center"
            title="Загрузить себестоимость"
          >
            <Upload className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              hapticFeedback('light');
              setShowLogHistory(true);
            }}
            className="p-3 min-w-[48px] rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm flex items-center justify-center"
            title="История действий"
          >
            <History className="w-5 h-5" />
          </button>
        </div>

        {/* Products Grid with Module Handlers */}
        <div className="min-h-[200px]">
          <DashboardGrid
            onOpenSMM={setSelectedForSMM}
            onOpenCalculator={setSelectedForCalculator}
            onOpenMedia={setSelectedForMedia}
          />
        </div>

        {/* Empty Catalog State */}
        {products.length === 0 && (
          <div className="text-center py-20 px-4">
            <div className="w-24 h-24 rounded-3xl bg-white/2 border border-white/5 flex items-center justify-center mx-auto mb-8 shadow-2xl">
              <Package className="w-12 h-12 text-zinc-700" />
            </div>
            <h3 className="text-xl font-black italic tracking-tighter uppercase text-white mb-2">
              Каталог пуст
            </h3>
            <p className="text-zinc-500 text-sm max-w-[240px] mx-auto font-medium mb-10 leading-relaxed uppercase tracking-tight">
              Для начала работы подключите аккаунты маркетплейсов в настройках.
            </p>
            <button
              onClick={() => {
                hapticFeedback('medium');
                onNavigate?.('settings');
              }}
              className="inline-flex items-center gap-3 px-10 py-5 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(255,255,255,0.1)] active:scale-95 transition-all"
            >
              <Settings className="w-4 h-4" />
              Подключить API
            </button>
          </div>
        )}
      </div>

      {/* MODALS LAYER */}
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

        {/* NEW MODULES */}
        {selectedForSMM && (
          <ProductSMMModal
            isOpen={!!selectedForSMM}
            onClose={() => setSelectedForSMM(null)}
            product={selectedForSMM}
          />
        )}

        {selectedForMedia && (
          <ProductMediaModal
            isOpen={!!selectedForMedia}
            onClose={() => setSelectedForMedia(null)}
            product={selectedForMedia}
            onUpdate={() => {
              // Refresh product logic if needed, usually stores update automatically
              hapticFeedback('success');
            }}
          />
        )}
      </AnimatePresence>

      {/* CALCULATOR (Special Case - Rendered via Portal inside component) */}
      {selectedForCalculator && (
        <PriceCalculator
          marketplace={selectedForCalculator.marketplace}
          // Use type assertion or check if minPrice is valid cost price estimation
          initialCostPrice={
            selectedForCalculator.minPrice > 0
              ? Math.round(selectedForCalculator.minPrice * 0.7)
              : undefined
          }
          onClose={() => setSelectedForCalculator(null)}
          onCalculated={price => {
            hapticFeedback('success');
            if (selectedForCalculator) {
              // Just log for now as requested, or update local state
              console.log(`Calculated price for ${selectedForCalculator.id}: ${price}`);
              // In a real flow, you might offer to update minPrice:
              // useProductsStore.getState().updateProduct(selectedForCalculator.id, { minPrice: price });
            }
          }}
        />
      )}
    </div>
  );
}

export default ProductsPage;

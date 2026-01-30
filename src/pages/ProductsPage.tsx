// ============================================
// NeuroGUARDIAN — Products Page v2.0
// Aesthetic: Transparent Intelligence | Tactical Control
// ============================================

import { useState, useMemo, useEffect, useCallback } from 'react';
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
  CheckCircle2,
  LayoutGrid,
  Zap,
} from 'lucide-react';
import { useProductsStore, useAppStore } from '../stores';
import { productsApi } from '../lib/api';
import { GlobalSwitch } from '../components/controls/GlobalSwitch';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';
import { BulkStopLossModal } from '../components/dashboard/BulkStopLossModal';
import { BulkUpdateCostsModal } from '../components/dashboard/BulkUpdateCostsModal';
import { LogHistory } from '../components/dashboard/LogHistory';
import { hapticFeedback } from '../lib/telegram';
import { ViktorCore } from '../components/ui/ViktorCore';
import { ProductCardSkeleton } from '../components/ui/Skeleton';
import type { Product } from '../types';

// Modules
import { PriceCalculator } from '../components/dashboard/PriceCalculator';

export function ProductsPage({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate?: (page: string) => void;
}) {
  const {
    products,
    searchQuery,
    setSearchQuery,
    setProducts,
    updateProduct,
    marketplaceFilter,
    setMarketplaceFilter,
    statusFilter,
    setStatusFilter,
  } = useProductsStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; count: number } | null>(null);
  const [showBulkStopLoss, setShowBulkStopLoss] = useState(false);
  const [showBulkCosts, setShowBulkCosts] = useState(false);
  const [showLogHistory, setShowLogHistory] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [selectedForCalculator, setSelectedForCalculator] = useState<Product | null>(null);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await productsApi.getProducts();
      if (res.success) {
        setProducts(res.products as unknown as Product[]);
      }
    } catch (e) {
      console.error('Failed to load products:', e);
    } finally {
      setIsLoading(false);
    }
  }, [setProducts]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSync = async () => {
    hapticFeedback('medium');
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const [wbResult, ozonResult] = await Promise.all([
        productsApi.syncProducts('WB').catch(() => ({ count: 0 })),
        productsApi.syncProducts('Ozon').catch(() => ({ count: 0 })),
      ]);
      const total = (wbResult.count || 0) + (ozonResult.count || 0);
      setSyncResult({ success: true, count: total });
      await loadProducts();
      hapticFeedback('success');
    } catch {
      setSyncResult({ success: false, count: 0 });
      hapticFeedback('error');
    } finally {
      setIsSyncing(false);
    }
  };

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

  const designMode = useMemo(() => {
    if (stats.triggered > 0) return 'critical';
    return 'peace';
  }, [stats]);

  return (
    <div className={`min-h-full pb-32 font-display relative overflow-x-hidden mode-${designMode}`}>
      {/* Header (Premium Glass) */}
      <header className="sticky top-0 z-40 glass-nav border-b border-black/5 px-4 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                hapticFeedback('light');
                onBack();
              }}
              className="size-10 flex items-center justify-center rounded-xl fused-card border border-black/5 active:scale-90 transition-transform"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-base font-black tracking-tight text-text-main">Склад</h1>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-widest font-black text-black/40">
                  {stats.total} SKU • {stats.protected} под защитой
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                hapticFeedback('light');
                onNavigate?.('settings');
              }}
              className="p-2 rounded-xl bg-black/5 text-black/40 hover:text-primary transition-colors"
            >
              <Settings size={18} />
            </button>
            <GlobalSwitch compact />
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
        {/* Sync Result notification */}
        <AnimatePresence>
          {syncResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={`p-4 rounded-2xl flex items-center gap-3 border shadow-sm ${
                syncResult.success
                  ? 'bg-peace-green/10 border-peace-green/20 text-peace-green'
                  : 'bg-toxic-orange/10 border-toxic-orange/20 text-toxic-orange'
              }`}
            >
              <CheckCircle2 size={18} />
              <div className="text-xs font-black uppercase tracking-tight">
                {syncResult.success
                  ? `Синхронизировано: ${syncResult.count} товаров`
                  : 'Ошибка синхронизации'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Viktor status widget */}
        {!isLoading && products.length > 0 && (
          <div
            className={`fused-card p-4 flex gap-4 border-l-4 ${designMode === 'critical' ? 'border-l-toxic-orange' : 'border-l-peace-green'}`}
          >
            <div className="shrink-0">
              <ViktorCore size="sm" animate={designMode === 'critical'} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${designMode === 'critical' ? 'bg-toxic-orange text-black' : 'bg-peace-green/20 text-peace-green'}`}
                >
                  {designMode === 'critical' ? 'Alert: Демпинг' : 'System: Стабильно'}
                </span>
              </div>
              <p className="text-[11px] font-medium text-black/60 leading-relaxed">
                {designMode === 'critical'
                  ? `${stats.triggered} товара находятся в зоне ценовой атаки. Стоп-лосс активирован.`
                  : 'Все торговые позиции синхронизированы. Угроз не обнаружено.'}
              </p>
            </div>
          </div>
        )}

        {/* Search + Filter UI */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-black/30 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по артикулу..."
                className="w-full h-12 bg-white rounded-2xl border border-black/5 pl-11 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/10 outline-none transition-all shadow-inner"
              />
            </div>
            <button
              onClick={() => {
                hapticFeedback('light');
                setShowFilters(!showFilters);
              }}
              className={`size-12 shrink-0 flex items-center justify-center rounded-2xl border transition-all ${
                showFilters || marketplaceFilter !== 'all' || statusFilter !== 'all'
                  ? 'bg-primary border-primary text-white shadow-lg'
                  : 'bg-white border-black/5 text-black/40 hover:border-primary/20 shadow-sm'
              }`}
            >
              <Filter size={20} />
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="fused-card p-4 space-y-4 shadow-xl"
              >
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-black/30 mb-2 block">
                    Маркетплейс
                  </label>
                  <div className="flex gap-2">
                    {(['all', 'WB', 'Ozon'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setMarketplaceFilter(m)}
                        className={`flex-1 h-9 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border ${
                          marketplaceFilter === m
                            ? 'bg-primary border-primary text-white shadow-lg'
                            : 'bg-black/5 border-transparent text-black/40'
                        }`}
                      >
                        {m === 'all' ? 'Все' : m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-black/30 mb-2 block">
                    Режим
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'all', label: 'Все' },
                        { id: 'active', label: 'В продаже' },
                        { id: 'protected', label: 'В охране' },
                        { id: 'triggered', label: 'В огне' },
                      ] as const
                    ).map(s => (
                      <button
                        key={s.id}
                        onClick={() => setStatusFilter(s.id)}
                        className={`px-4 h-9 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border ${
                          statusFilter === s.id
                            ? 'bg-primary border-primary text-white shadow-lg'
                            : 'bg-black/5 border-transparent text-black/40'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tactical Actions Row */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
          <button
            onClick={() => {
              hapticFeedback('medium');
              setShowBulkStopLoss(true);
            }}
            className="h-12 px-5 rounded-2xl bg-primary text-white flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all text-xs font-black uppercase tracking-tight shrink-0"
          >
            <Shield size={16} /> Накрыть все защитой
          </button>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="size-12 shrink-0 flex items-center justify-center rounded-2xl bg-white border border-black/5 text-black/40 active:bg-gray-50 transition-colors shadow-sm"
          >
            <RefreshCcw size={18} className={isSyncing ? 'animate-spin text-primary' : ''} />
          </button>

          <button
            onClick={() => setShowBulkCosts(true)}
            className="size-12 shrink-0 flex items-center justify-center rounded-2xl bg-white border border-black/5 text-black/40 active:bg-gray-50 transition-colors shadow-sm"
          >
            <Upload size={18} />
          </button>

          <button
            onClick={() => setShowLogHistory(true)}
            className="size-12 shrink-0 flex items-center justify-center rounded-2xl bg-white border border-black/5 text-black/40 active:bg-gray-50 transition-colors shadow-sm"
          >
            <History size={18} />
          </button>
        </div>

        {/* Inventory Flow Matrix (Grid) */}
        <div className="min-h-[400px]">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <DashboardGrid onOpenCalculator={setSelectedForCalculator} />
          )}
        </div>

        {/* Zero state */}
        {!isLoading && products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-20 rounded-3xl bg-black/5 flex items-center justify-center mb-6">
              <LayoutGrid size={32} className="text-black/10" />
            </div>
            <h3 className="text-lg font-black text-black/80 tracking-tight">Склад пуст</h3>
            <p className="text-xs font-medium text-black/40 max-w-[200px] mt-2 mb-8">
              Подключите API ключи WB/Ozon для автоматической загрузки каталога.
            </p>
            <button
              onClick={() => onNavigate?.('settings')}
              className="h-12 px-8 rounded-2xl bg-black text-white text-[10px] font-black uppercase tracking-widest"
            >
              Настройки API
            </button>
          </div>
        )}
      </div>

      {/* Modals Bridge */}
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

      {selectedForCalculator && (
        <PriceCalculator
          marketplace={selectedForCalculator.marketplace}
          initialCostPrice={selectedForCalculator.costPrice}
          onClose={() => setSelectedForCalculator(null)}
          onCalculated={async price => {
            hapticFeedback('success');
            if (!selectedForCalculator) return;
            try {
              const res = await productsApi.updateProductParams(selectedForCalculator.id, {
                minPrice: price,
              });
              if (res.success) updateProduct(selectedForCalculator.id, { minPrice: price });
            } catch (error) {
              hapticFeedback('error');
            }
          }}
        />
      )}
    </div>
  );
}

export default ProductsPage;

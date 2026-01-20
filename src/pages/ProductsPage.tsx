// ============================================
// NeuroGUARDIAN — Products Page V7.0 (Warm Light)
// Aesthetic: Clean, Spacious, Warm Light Mode
// ============================================

import { useState, useMemo, useEffect } from 'react';
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
import { ProductCardSkeleton } from '../components/ui/Skeleton';
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

  const [selectedForSMM, setSelectedForSMM] = useState<Product | null>(null);
  const [selectedForCalculator, setSelectedForCalculator] = useState<Product | null>(null);
  const [selectedForMedia, setSelectedForMedia] = useState<Product | null>(null);

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
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
  };

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

  const viktorStatus = useMemo(() => {
    if (stats.triggered > 0) {
      return {
        tone: 'alert' as const,
        badge: 'ТРЕБУЕТ ВНИМАНИЯ',
        title: 'Обнаружены угрозы по ценам',
        message: `${stats.triggered} товара под атакой. Рекомендую перейти в центр защиты.`,
      };
    }
    if (stats.unprotected > 0) {
      return {
        tone: 'processing' as const,
        badge: 'РЕКОМЕНДАЦИЯ',
        title: 'Часть товаров без защиты',
        message: `Без защиты осталось ${stats.unprotected} товаров. Настройте стоп-лоссы.`,
      };
    }
    return {
      tone: 'success' as const,
      badge: 'ВСЕ СПОКОЙНО',
      title: 'Каталог под защитой',
      message: 'Все товары защищены. Мониторинг каждые 30 минут.',
    };
  }, [stats]);

  const viktorToneStyles: Record<typeof viktorStatus.tone, string> = {
    alert: 'border-danger/20 bg-danger-soft',
    processing: 'border-warning/20 bg-warning-soft',
    success: 'border-success/20 bg-success-soft',
  };

  return (
    <div className="min-h-full pb-24 bg-page relative overflow-x-hidden" role="main">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-xl border-b border-surface-dim">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Back + Title */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => {
                  hapticFeedback('light');
                  onBack();
                }}
                className="p-2.5 rounded-xl bg-surface border border-surface-dim hover:border-primary transition-all"
                aria-label="Назад"
              >
                <ArrowLeft className="w-5 h-5 text-text-secondary" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-text-main tracking-tight">Товары</h1>
                <p className="text-xs font-medium text-text-muted">
                  {stats.total} SKU • {stats.protected} защищено
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
                className="p-2 rounded-xl hover:bg-surface-hl transition-all text-text-muted hover:text-primary"
                aria-label="Настройки"
              >
                <Settings className="w-5 h-5" />
              </button>
              <GlobalSwitch compact />
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 px-4 py-6 space-y-5">
        {/* Sync Result Toast */}
        <AnimatePresence>
          {syncResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`p-4 rounded-xl flex items-center gap-3 ${
                syncResult.success
                  ? 'bg-success-soft border border-success/20'
                  : 'bg-danger-soft border border-danger/20'
              }`}
            >
              <CheckCircle2
                className={`w-5 h-5 ${syncResult.success ? 'text-success' : 'text-danger'}`}
              />
              <div>
                <span
                  className={`font-semibold ${syncResult.success ? 'text-success' : 'text-danger'}`}
                >
                  {syncResult.success ? 'Синхронизировано!' : 'Ошибка синхронизации'}
                </span>
                {syncResult.success && (
                  <p className="text-sm text-text-secondary">
                    Загружено товаров: <strong>{syncResult.count}</strong>
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Viktor Status Panel */}
        {!isLoading && products.length > 0 && (
          <motion.div
            className={`p-4 rounded-2xl border flex items-start gap-4 ${viktorToneStyles[viktorStatus.tone]}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="shrink-0 mt-0.5">
              <ViktorCore size="sm" status={viktorStatus.tone} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="badge badge-neutral text-[9px]">{viktorStatus.badge}</span>
              </div>
              <p className="text-sm font-semibold text-text-main mb-1">{viktorStatus.title}</p>
              <p className="text-xs text-text-secondary leading-relaxed">{viktorStatus.message}</p>
            </div>
          </motion.div>
        )}

        {/* Search + Filter Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск товаров..."
              className="input pl-10"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 rounded-xl border transition-all ${
              showFilters || marketplaceFilter !== 'all' || statusFilter !== 'all'
                ? 'bg-primary-dim border-primary/30 text-primary'
                : 'bg-surface border-surface-dim text-text-muted hover:border-primary/30'
            }`}
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 rounded-2xl card space-y-4">
                <div>
                  <p className="input-label mb-2">Маркетплейс</p>
                  <div className="flex gap-2">
                    {(['all', 'WB', 'Ozon'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setMarketplaceFilter(m)}
                        className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                          marketplaceFilter === m
                            ? 'bg-primary-dim border-primary/30 text-primary'
                            : 'bg-surface-warm border-surface-dim text-text-secondary hover:border-primary/30'
                        }`}
                      >
                        {m === 'all' ? 'Все' : m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="input-label mb-2">Статус</p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'all', label: 'Все' },
                        { id: 'active', label: 'Активные' },
                        { id: 'protected', label: 'Защита' },
                        { id: 'triggered', label: 'Атаки' },
                      ] as const
                    ).map(s => (
                      <button
                        key={s.id}
                        onClick={() => setStatusFilter(s.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                          statusFilter === s.id
                            ? 'bg-primary-dim border-primary/30 text-primary'
                            : 'bg-surface-warm border-surface-dim text-text-secondary hover:border-primary/30'
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
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
          <button
            onClick={() => {
              hapticFeedback('medium');
              setShowBulkStopLoss(true);
            }}
            className="flex-1 min-w-[140px] btn btn-primary py-3"
          >
            <Shield className="w-4 h-4" />
            Защитить все
          </button>

          <button
            disabled={isSyncing}
            onClick={handleSync}
            className="p-3 min-w-[48px] btn btn-secondary"
            title="Синхронизировать"
          >
            <RefreshCcw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              hapticFeedback('light');
              setShowBulkCosts(true);
            }}
            className="p-3 min-w-[48px] btn btn-secondary"
            title="Загрузить себестоимость"
          >
            <Upload className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              hapticFeedback('light');
              setShowLogHistory(true);
            }}
            className="p-3 min-w-[48px] btn btn-secondary"
            title="История"
          >
            <History className="w-5 h-5" />
          </button>
        </div>

        {/* Products Grid or Skeleton Loading */}
        <div className="min-h-[200px]">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <DashboardGrid
              onOpenSMM={setSelectedForSMM}
              onOpenCalculator={setSelectedForCalculator}
              onOpenMedia={setSelectedForMedia}
            />
          )}
        </div>

        {/* Empty Catalog State */}
        {!isLoading && products.length === 0 && (
          <div className="text-center py-20 px-4">
            <div className="w-24 h-24 rounded-2xl bg-surface border border-surface-dim flex items-center justify-center mx-auto mb-8">
              <Package className="w-12 h-12 text-text-muted" />
            </div>
            <h3 className="text-xl font-bold text-text-main mb-2">Каталог пуст</h3>
            <p className="text-text-secondary text-sm max-w-[240px] mx-auto mb-8">
              Подключите аккаунты маркетплейсов в настройках для синхронизации товаров.
            </p>
            <button
              onClick={() => {
                hapticFeedback('medium');
                onNavigate?.('settings');
              }}
              className="btn btn-primary py-4 px-8"
            >
              <Settings className="w-4 h-4" />
              Подключить API
            </button>
          </div>
        )}
      </div>

      {/* MODALS */}
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
            onUpdate={() => hapticFeedback('success')}
          />
        )}
      </AnimatePresence>

      {/* Calculator */}
      {selectedForCalculator && (
        <PriceCalculator
          marketplace={selectedForCalculator.marketplace}
          initialCostPrice={
            selectedForCalculator.minPrice > 0
              ? Math.round(selectedForCalculator.minPrice * 0.7)
              : undefined
          }
          onClose={() => setSelectedForCalculator(null)}
          onCalculated={async price => {
            hapticFeedback('success');
            if (!selectedForCalculator) return;
            try {
              const res = await productsApi.updateProductParams(selectedForCalculator.id, {
                minPrice: price,
              });
              if (res.success) {
                updateProduct(selectedForCalculator.id, { minPrice: price });
              }
            } catch (error) {
              console.error('Failed to apply calculated price', error);
              hapticFeedback('error');
            }
          }}
        />
      )}
    </div>
  );
}

export default ProductsPage;

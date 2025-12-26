// ============================================
// NeuroAgent — Products & Metrics Page
// Clean, organized view for products
// ============================================

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, useProductsStore } from '../stores';
import { GlobalSwitch } from '../components/controls/GlobalSwitch';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';
import { BulkStopLossModal } from '../components/dashboard/BulkStopLossModal';
import { LogHistory } from '../components/dashboard/LogHistory';
import { hapticFeedback } from '../lib/telegram';
import type { Product } from '../types';

// Mock data for development
const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    userId: 123456,
    productId: 'wb-123456789',
    nmId: 123456789,
    vendorCode: 'SKU-001',
    title: 'Кроссовки Nike Air Max 270',
    imageUrl: '/products/sneakers_nike.webp',
    brand: 'Nike',
    currentPrice: 12500,
    minPrice: 10000,
    stock: 45,
    marketplace: 'WB',
    status: 'protected',
    isMonitored: true,
    lastCheckedAt: new Date(),
    lastTriggeredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    userId: 123456,
    productId: 'wb-987654321',
    nmId: 987654321,
    vendorCode: 'SKU-002',
    title: 'Худи Adidas Originals',
    imageUrl: '/products/hoodie_adidas.webp',
    brand: 'Adidas',
    currentPrice: 6500,
    minPrice: 5000,
    stock: 120,
    marketplace: 'WB',
    status: 'triggered',
    isMonitored: true,
    lastCheckedAt: new Date(),
    lastTriggeredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    userId: 123456,
    productId: 'ozon-111222333',
    offerId: 'OZON-SKU-003',
    vendorCode: 'SKU-003',
    title: 'Смартфон Samsung Galaxy S23',
    imageUrl: '/products/smartphone_samsung.webp',
    brand: 'Samsung',
    currentPrice: 89990,
    minPrice: 80000,
    stock: 15,
    marketplace: 'Ozon',
    status: 'protected',
    isMonitored: true,
    lastCheckedAt: new Date(),
    lastTriggeredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Format money
function formatMoney(amount: number): string {
  if (amount >= 1000000) {
    return `₽${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `₽${(amount / 1000).toFixed(0)}k`;
  }
  return `₽${amount}`;
}

interface ProductsPageProps {
  onBack: () => void;
}

export function ProductsPage({ onBack }: ProductsPageProps) {
  const user = useAppStore(state => state.user);
  const products = useProductsStore(state => state.products);
  const setProducts = useProductsStore(state => state.setProducts);

  const [showBulkStopLoss, setShowBulkStopLoss] = useState(false);
  const [showLogHistory, setShowLogHistory] = useState(false);

  // Load mock data in dev mode
  useEffect(() => {
    if (import.meta.env.DEV && products.length === 0) {
      setProducts(MOCK_PRODUCTS);
    }
  }, [setProducts, products.length]);

  // Calculate stats
  const stats = useMemo(() => {
    const protectedCount = products.filter(p => p.minPrice > 0).length;
    const triggeredCount = products.filter(p => p.status === 'triggered').length;
    return {
      total: products.length,
      protected: protectedCount,
      unprotected: products.length - protectedCount,
      triggered: triggeredCount,
      savedAmount: user?.savedAmount ?? 0,
    };
  }, [products, user]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 to-stone-800 pb-24">
      {/* Header - Compact Mobile Version */}
      <header className="sticky top-0 z-10 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          {/* Back button + Title */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg hover:bg-stone-800 transition-colors text-stone-400 flex-shrink-0"
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
              <h1 className="text-lg font-bold text-white truncate">Товары</h1>
              <p className="text-[10px] text-stone-500">
                {stats.total} • {stats.protected} защищено
              </p>
            </div>
          </div>

          {/* Global Switch - Compact */}
          <div className="flex-shrink-0">
            <GlobalSwitch compact />
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Stats Cards - Compact Row */}
        <div className="grid grid-cols-4 gap-2">
          <motion.div
            className="p-3 rounded-xl bg-stone-800/50 border border-stone-700/50 text-center"
            whileHover={{ scale: 1.02 }}
          >
            <p className="text-xl font-bold text-white">{stats.total}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-wide">Всего</p>
          </motion.div>
          <motion.div
            className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center"
            whileHover={{ scale: 1.02 }}
          >
            <p className="text-xl font-bold text-emerald-400">{stats.protected}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-wide">Защита</p>
          </motion.div>
          <motion.div
            className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center"
            whileHover={{ scale: 1.02 }}
          >
            <p className="text-xl font-bold text-amber-400">{stats.unprotected}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-wide">Без</p>
          </motion.div>
          <motion.div
            className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center"
            whileHover={{ scale: 1.02 }}
          >
            <p className="text-xl font-bold text-red-400">{stats.triggered}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-wide">Триггер</p>
          </motion.div>
        </div>

        {/* Saved Amount - Only if > 0 */}
        {stats.savedAmount > 0 && (
          <motion.div
            className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-stone-400">Сэкономлено благодаря защите</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {formatMoney(stats.savedAmount)}
                </p>
              </div>
              <span className="text-3xl">💰</span>
            </div>
          </motion.div>
        )}

        {/* Action Buttons - Clean Row */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              hapticFeedback('light');
              setShowBulkStopLoss(true);
            }}
            className="flex-1 py-3 px-4 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-400 font-medium hover:bg-violet-500/30 transition-all flex items-center justify-center gap-2"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-sm">Включить Сторожа</span>
          </button>
          <button
            onClick={() => {
              hapticFeedback('light');
              setShowLogHistory(true);
            }}
            className="py-3 px-4 rounded-xl bg-stone-800 border border-stone-700 text-stone-400 hover:bg-stone-700 hover:text-stone-300 transition-all"
            title="История защиты"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        {/* Products Grid */}
        <DashboardGrid />

        {/* Empty State */}
        {products.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="text-5xl mb-4">📦</div>
            <h3 className="text-lg font-bold text-white mb-2">Нет товаров</h3>
            <p className="text-stone-400 text-sm max-w-xs mx-auto">
              Подключите API маркетплейса в настройках, чтобы синхронизировать товары
            </p>
          </motion.div>
        )}

        {/* Hint for Agent */}
        {products.length > 0 && (
          <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center gap-3">
            <img
              src="/agent-avatar.png"
              alt="Agent"
              className="w-8 h-8 rounded-full object-cover border border-violet-400/50"
            />
            <p className="text-sm text-stone-300 flex-1">
              💡 Напишите мне «защити все товары» во вкладке{' '}
              <span className="text-violet-400 font-medium">Агент</span>!
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <BulkStopLossModal isOpen={showBulkStopLoss} onClose={() => setShowBulkStopLoss(false)} />
      {showLogHistory && (
        <LogHistory isOpen={showLogHistory} onClose={() => setShowLogHistory(false)} />
      )}
    </div>
  );
}

export default ProductsPage;

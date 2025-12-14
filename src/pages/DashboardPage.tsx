// ============================================
// NeuroGUARDIAN — Dashboard Page
// Main application dashboard
// ============================================

import { useEffect, useState, useMemo } from 'react';
import { useAppStore, useProductsStore } from '../stores';
import { GlobalSwitch } from '../components/controls/GlobalSwitch';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';
import { LogConsole } from '../components/logPanel/LogConsole';
import { HelpModal } from '../components/ui/HelpModal';
import { PaymentModal } from '../components/ui/PaymentModal';
import { hapticFeedback } from '../lib/telegram';
import type { Product } from '../types';

// Format money with k abbreviation
function formatMoney(amount: number): string {
  if (amount >= 1000) {
    return `₽${(amount / 1000).toFixed(1)}k`;
  }
  return `₽${amount}`;
}

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
  {
    id: '4',
    userId: 123456,
    productId: 'ozon-444555666',
    offerId: 'OZON-SKU-004',
    vendorCode: 'SKU-004',
    title: 'Наушники Sony WH-1000XM5',
    imageUrl: '/products/headphones_sony.webp',
    brand: 'Sony',
    currentPrice: 34990,
    minPrice: 0,
    stock: 32,
    marketplace: 'Ozon',
    status: 'active',
    isMonitored: false,
    lastCheckedAt: new Date(),
    lastTriggeredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '5',
    userId: 123456,
    productId: 'wb-555666777',
    nmId: 555666777,
    vendorCode: 'SKU-005',
    title: 'Футболка Puma Essential',
    imageUrl: '/products/tshirt_puma.webp',
    brand: 'Puma',
    currentPrice: 2990,
    minPrice: 2500,
    stock: 250,
    marketplace: 'WB',
    status: 'protected',
    isMonitored: true,
    lastCheckedAt: new Date(),
    lastTriggeredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

interface DashboardPageProps {
  onGoToSettings?: () => void;
}

export function DashboardPage({ onGoToSettings }: DashboardPageProps) {
  const subscriptionDaysLeft = useAppStore((state) => state.subscriptionDaysLeft);
  const user = useAppStore((state) => state.user);
  const setProducts = useProductsStore((state) => state.setProducts);
  const products = useProductsStore((state) => state.products);
  
  // Calculate stats from real data
  const stats = useMemo(() => {
    const protectedCount = products.filter(p => p.minPrice > 0).length;
    return {
      savedAmount: user?.savedAmount ?? 0,
      protectedCount,
      triggeredToday: user?.triggeredToday ?? 0,
    };
  }, [user, products]);
  
  // Load mock data ONLY in development mode
  useEffect(() => {
    // Only load mock data in development if no products exist
    if (import.meta.env.DEV && products.length === 0) {
      console.log('🔧 DEV MODE: Loading mock products...');
      setProducts(MOCK_PRODUCTS);
      console.log('✅ Mock products loaded:', MOCK_PRODUCTS.length);
    }
  }, [setProducts, products.length]);
  
  const [showHelp, setShowHelp] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 to-stone-800 px-4 py-6 pb-24">
      {/* Help Modal */}
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      
      {/* Payment Modal */}
      <PaymentModal 
        isOpen={showPayment} 
        onClose={() => setShowPayment(false)}
        onGoToSettings={onGoToSettings}
      />
      
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl sm:text-2xl font-bold text-gradient-amber truncate mr-2">NeuroGUARDIAN</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Instruction button - prominent */}
            <button
              onClick={() => setShowHelp(true)}
              className="px-2 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/40 hover:from-amber-500/30 hover:to-amber-600/30 transition-all flex items-center gap-1.5"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-sm font-medium text-amber-400 hidden sm:inline">Инструкция</span>
            </button>
            <button
              onClick={() => {
                hapticFeedback('light');
                setShowPayment(true);
              }}
              className={`
                px-2 sm:px-3 py-1 rounded-full text-sm font-medium transition-all
                ${subscriptionDaysLeft !== null && subscriptionDaysLeft > 7 
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' 
                  : subscriptionDaysLeft !== null && subscriptionDaysLeft > 0
                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                    : 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-900 hover:from-amber-400 hover:to-amber-300 animate-pulse shadow-lg shadow-amber-500/25'
                }
              `}
            >
              {subscriptionDaysLeft !== null && subscriptionDaysLeft > 0 
                ? `${subscriptionDaysLeft} ${getDaysWord(subscriptionDaysLeft)}`
                : '💳 Оплатить'
              }
            </button>
          </div>
        </div>
        <p className="text-stone-400 text-sm">
          Защита маржи от принудительных акций
        </p>
      </header>
      
      {/* Global Switch */}
      <section className="mb-6">
        <GlobalSwitch />
      </section>
      
      {/* Quick Stats */}
      <section className="grid grid-cols-3 gap-3 mb-6">
        <div className="glass-panel p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {formatMoney(stats.savedAmount)}
          </div>
          <div className="text-xs text-stone-400">Спасено</div>
        </div>
        <div className="glass-panel p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">
            {stats.protectedCount}
          </div>
          <div className="text-xs text-stone-400">Защищено</div>
        </div>
        <div className="glass-panel p-4 text-center">
          <div className={`text-2xl font-bold ${stats.triggeredToday > 0 ? 'text-red-400' : 'text-stone-500'}`}>
            {stats.triggeredToday}
          </div>
          <div className="text-xs text-stone-400">Атак сегодня</div>
        </div>
      </section>
      
      {/* Products Dashboard */}
      <section>
        <DashboardGrid />
      </section>
      
      {/* Log Console */}
      <LogConsole />
    </div>
  );
}

function getDaysWord(days: number): string {
  const lastDigit = days % 10;
  const lastTwoDigits = days % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'дней';
  if (lastDigit === 1) return 'день';
  if (lastDigit >= 2 && lastDigit <= 4) return 'дня';
  return 'дней';
}

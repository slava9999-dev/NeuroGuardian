// ============================================
// NeuroGUARDIAN — Dashboard Page
// Main application dashboard
// ============================================

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, useProductsStore } from '../stores';
import { GlobalSwitch } from '../components/controls/GlobalSwitch';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';
import { LogConsole } from '../components/logPanel/LogConsole';
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
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200',
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
    imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=200',
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
    imageUrl: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=200',
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
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200',
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
    imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=200',
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

export function DashboardPage() {
  const subscriptionDaysLeft = useAppStore((state) => state.subscriptionDaysLeft);
  const setProducts = useProductsStore((state) => state.setProducts);
  const setLoading = useProductsStore((state) => state.setLoading);
  
  // Load mock data on mount
  useEffect(() => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setProducts(MOCK_PRODUCTS);
    }, 500);
  }, [setProducts, setLoading]);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 to-stone-800 px-4 py-6 pb-24">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gradient-amber">NeuroGUARDIAN</h1>
          {subscriptionDaysLeft !== null && (
            <div className={`
              px-3 py-1 rounded-full text-sm font-medium
              ${subscriptionDaysLeft > 7 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : subscriptionDaysLeft > 0
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-red-500/20 text-red-400'
              }
            `}>
              {subscriptionDaysLeft > 0 
                ? `${subscriptionDaysLeft} ${getDaysWord(subscriptionDaysLeft)}`
                : 'Подписка истекла'
              }
            </div>
          )}
        </div>
        <p className="text-stone-400 text-sm">
          Защита маржи от принудительных акций
        </p>
      </motion.header>
      
      {/* Global Switch */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <GlobalSwitch />
      </motion.section>
      
      {/* Quick Stats */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-3 gap-3 mb-6"
      >
        <div className="glass-panel p-4 text-center">
          <div className="text-2xl font-bold text-white">₽42.5k</div>
          <div className="text-xs text-stone-400">Спасено</div>
        </div>
        <div className="glass-panel p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">24</div>
          <div className="text-xs text-stone-400">Защищено</div>
        </div>
        <div className="glass-panel p-4 text-center">
          <div className="text-2xl font-bold text-red-400">3</div>
          <div className="text-xs text-stone-400">Атак сегодня</div>
        </div>
      </motion.section>
      
      {/* Products Dashboard */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <DashboardGrid />
      </motion.section>
      
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

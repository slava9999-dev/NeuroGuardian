// ============================================
// NeuroAgent — Protection Dashboard
// Margin protection for WB & Ozon sellers
// ============================================

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, useProductsStore } from '../stores';
import { playCashSound, playAlertSound } from '../utils/sounds';
import confetti from 'canvas-confetti';
import { GlobalSwitch } from '../components/controls/GlobalSwitch';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';
import { BulkStopLossModal } from '../components/dashboard/BulkStopLossModal';
import { LogHistory } from '../components/dashboard/LogHistory';
import { LogConsole } from '../components/logPanel/LogConsole';
import { HelpModal } from '../components/ui/HelpModal';
import { PaymentModal } from '../components/ui/PaymentModal';
import { SecurityModal } from '../components/ui/SecurityModal';
import { WelcomeBanner } from '../components/ui/WelcomeBanner';
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
  onGoToAgent?: () => void;
}

export function DashboardPage({ onGoToSettings, onGoToAgent }: DashboardPageProps) {
  const subscriptionDaysLeft = useAppStore(state => state.subscriptionDaysLeft);
  const user = useAppStore(state => state.user);
  const setProducts = useProductsStore(state => state.setProducts);
  const products = useProductsStore(state => state.products);

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
  const [showSecurity, setShowSecurity] = useState(false);
  const [showBulkStopLoss, setShowBulkStopLoss] = useState(false);
  const [showLogHistory, setShowLogHistory] = useState(false);

  // 💰 Money Sound Effect Logic
  useEffect(() => {
    if (!stats.savedAmount || stats.savedAmount <= 0) return;

    const lastSaved = Number(localStorage.getItem('ng_last_saved') || 0);

    // Only play if amount INCREASED
    if (stats.savedAmount > lastSaved) {
      console.log('💰 KA-CHING! Saved money increased:', stats.savedAmount);

      // Play sound
      playCashSound();

      // Fire confetti
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.3 },
        colors: ['#FFD700', '#FFA500', '#FF4500'],
        gravity: 0.8,
        scalar: 1.2,
        ticks: 200,
      });

      hapticFeedback('success');

      // Update local storage
      localStorage.setItem('ng_last_saved', stats.savedAmount.toString());
    }
  }, [stats.savedAmount]);

  // 🚨 Alert Sound Effect Logic - when stop-loss triggers
  useEffect(() => {
    if (!stats.triggeredToday || stats.triggeredToday <= 0) return;

    const lastTriggered = Number(localStorage.getItem('ng_last_triggered') || 0);

    // Only play alert if triggered count INCREASED
    if (stats.triggeredToday > lastTriggered) {
      console.log('🚨 ALERT! Сторож сработал:', stats.triggeredToday);

      // Play alert sound
      playAlertSound();

      hapticFeedback('error'); // Strong vibration for alert

      // Update local storage
      localStorage.setItem('ng_last_triggered', stats.triggeredToday.toString());
    }
  }, [stats.triggeredToday]);

  // 🔄 REAL-TIME SENTINEL POLLING (Client-Side Trigger)
  // Since we don't have Cron Jobs on Hobby plan, we trigger checks from client
  useEffect(() => {
    if (!user?.subscriptionActive) return;

    // Run check immediately on mount
    const runCheck = async () => {
      interface TelegramWebApp {
        initData?: string;
      }
      const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
      const initData = tg?.initData;
      if (!initData) return;

      try {
        await fetch('/api?action=check-prices', {
          headers: { 'X-Init-Data': initData },
        });
        console.log('⚡ Sentinel cycle triggered by client');
      } catch (e) {
        console.error('Sentinel trigger failed', e);
      }
    };

    // Run on mount
    runCheck();

    // And every 60 seconds
    const interval = setInterval(runCheck, 60000);

    return () => clearInterval(interval);
  }, [user?.subscriptionActive]);

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

      {/* Security Modal */}
      <SecurityModal isOpen={showSecurity} onClose={() => setShowSecurity(false)} />

      {/* Bulk Stop-Loss Modal */}
      <BulkStopLossModal isOpen={showBulkStopLoss} onClose={() => setShowBulkStopLoss(false)} />

      {/* Welcome Banner with Agent */}
      <WelcomeBanner onAskAgent={onGoToAgent} />

      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-3">
          {/* Left: Subscription Days Counter */}
          <div
            className={`
              flex items-center gap-2 px-3 py-2 rounded-xl
              ${
                subscriptionDaysLeft !== null && subscriptionDaysLeft > 7
                  ? 'bg-emerald-500/15 border border-emerald-500/30'
                  : subscriptionDaysLeft !== null && subscriptionDaysLeft > 0
                    ? 'bg-amber-500/15 border border-amber-500/30'
                    : 'bg-red-500/15 border border-red-500/30'
              }
            `}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`
                ${
                  subscriptionDaysLeft !== null && subscriptionDaysLeft > 7
                    ? 'text-emerald-400'
                    : subscriptionDaysLeft !== null && subscriptionDaysLeft > 0
                      ? 'text-amber-400'
                      : 'text-red-400'
                }
              `}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span
              className={`
                text-sm font-bold
                ${
                  subscriptionDaysLeft !== null && subscriptionDaysLeft > 7
                    ? 'text-emerald-400'
                    : subscriptionDaysLeft !== null && subscriptionDaysLeft > 0
                      ? 'text-amber-400'
                      : 'text-red-400'
                }
              `}
            >
              {subscriptionDaysLeft !== null && subscriptionDaysLeft > 0
                ? `${subscriptionDaysLeft} ${getDaysWord(subscriptionDaysLeft)}`
                : 'Подписка истекла'}
            </span>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Security Button with label */}
            <button
              onClick={() => {
                hapticFeedback('light');
                setShowSecurity(true);
              }}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-500/30 hover:from-emerald-500/25 hover:to-teal-500/25 transition-all flex items-center gap-2"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-emerald-400"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span className="text-sm font-medium text-emerald-400">Безопасность</span>
            </button>

            {/* Instruction Button */}
            <button
              onClick={() => {
                hapticFeedback('light');
                setShowHelp(true);
              }}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/15 to-amber-600/15 border border-amber-500/30 hover:from-amber-500/25 hover:to-amber-600/25 transition-all flex items-center gap-2"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-amber-400"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-sm font-medium text-amber-400">Инструкция</span>
            </button>
          </div>
        </div>

        <p className="text-stone-400 text-sm mb-4">
          Автоматическая защита маржи с помощью AI-агента
        </p>

        {/* 🎁 TRIAL BANNER - КРАСИВЫЙ */}
        {user?.subscriptionPlan === 'trial' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 relative overflow-hidden"
          >
            {/* Animated background */}
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/30 via-fuchsia-500/30 to-amber-500/30 rounded-2xl" />
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />

            <div className="relative p-4 rounded-2xl border border-purple-500/40 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                {/* Left: Icon + Text */}
                <div className="flex items-center gap-3">
                  {/* Animated gift icon */}
                  <motion.div
                    className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/30"
                    animate={{
                      scale: [1, 1.05, 1],
                      rotate: [0, -5, 5, 0],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <span className="text-2xl">🎁</span>
                  </motion.div>

                  <div>
                    <p className="text-base font-bold text-white flex items-center gap-2">
                      3 дня БЕСПЛАТНО!
                      <motion.span
                        className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        АКТИВНО
                      </motion.span>
                    </p>
                    <p className="text-sm text-purple-200/80">
                      {subscriptionDaysLeft !== null && subscriptionDaysLeft > 0
                        ? `Осталось ${subscriptionDaysLeft} ${getDaysWord(subscriptionDaysLeft)} полного доступа`
                        : 'Полный функционал без ограничений'}
                    </p>
                  </div>
                </div>

                {/* Right: Days counter */}
                <div className="text-center">
                  <motion.div
                    className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {subscriptionDaysLeft ?? 3}
                  </motion.div>
                  <p className="text-xs text-purple-300/60">
                    {subscriptionDaysLeft === 1
                      ? 'день'
                      : subscriptionDaysLeft && subscriptionDaysLeft <= 4
                        ? 'дня'
                        : 'дней'}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-1.5 bg-stone-800/50 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500 rounded-full"
                  initial={{ width: '100%' }}
                  animate={{ width: `${((subscriptionDaysLeft ?? 3) / 3) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {/* CTA Button */}
              <motion.button
                onClick={() => {
                  hapticFeedback('light');
                  setShowPayment(true);
                }}
                className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span>💳</span>
                Оплата подписки
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  →
                </motion.span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* 🔴 EXPIRED SUBSCRIPTION BANNER */}
        {(!user?.subscriptionActive || subscriptionDaysLeft === 0) &&
          user?.subscriptionPlan !== 'trial' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/40"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <span className="text-xl">⚠️</span>
                  </motion.div>
                  <div>
                    <p className="font-bold text-red-400">Подписка истекла</p>
                    <p className="text-sm text-stone-400">Защита товаров приостановлена</p>
                  </div>
                </div>
                <motion.button
                  onClick={() => {
                    hapticFeedback('light');
                    setShowPayment(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-sm shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Продлить
                </motion.button>
              </div>
            </motion.div>
          )}
      </header>

      {/* 🔧 CONNECT API BANNER — показывается если API не подключены */}
      {!user?.wbKeyRef && !user?.ozonKeyRef && user?.subscriptionActive && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/40"
        >
          <div className="flex items-center gap-4">
            <motion.div
              className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
              >
                <path d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </motion.div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-1">Подключите маркетплейс</h3>
              <p className="text-sm text-purple-200/70">
                Добавьте API ключи WB или Ozon чтобы начать защиту товаров
              </p>
            </div>
          </div>
          <motion.button
            onClick={() => {
              hapticFeedback('light');
              onGoToSettings?.();
            }}
            className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3" />
            </svg>
            Перейти в Настройки
          </motion.button>
        </motion.section>
      )}

      {/* Global Switch */}
      <section className="mb-6">
        <GlobalSwitch />
      </section>

      {/* Bulk Stop-Loss Button - Show only if there are unprotected products */}
      {products.filter(p => !p.minPrice || p.minPrice === 0).length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <button
            onClick={() => {
              hapticFeedback('light');
              setShowBulkStopLoss(true);
            }}
            className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 hover:from-amber-500/30 hover:to-orange-500/30 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <span className="text-xl">🛡️</span>
              </div>
              <div className="text-left">
                <p className="font-bold text-white">Защитить все товары</p>
                <p className="text-xs text-stone-400">
                  {products.filter(p => !p.minPrice || p.minPrice === 0).length} товаров без защиты
                  Сторожа
                </p>
              </div>
            </div>
            <motion.div
              className="text-amber-400"
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </motion.div>
          </button>
        </motion.section>
      )}

      {/* Quick Stats */}
      <section className="grid grid-cols-3 gap-3 mb-6">
        <div className="glass-panel p-4 text-center">
          <div className="text-2xl font-bold text-white">{formatMoney(stats.savedAmount)}</div>
          <div className="text-xs text-stone-400">Спасено</div>
        </div>
        <div className="glass-panel p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{stats.protectedCount}</div>
          <div className="text-xs text-stone-400">Защищено</div>
        </div>
        {/* Clickable card to open log history */}
        <button
          onClick={() => {
            hapticFeedback('light');
            setShowLogHistory(true);
          }}
          className="glass-panel p-4 text-center hover:bg-stone-700/50 transition-colors cursor-pointer"
        >
          <div
            className={`text-2xl font-bold ${stats.triggeredToday > 0 ? 'text-red-400' : 'text-stone-500'}`}
          >
            {stats.triggeredToday}
          </div>
          <div className="text-xs text-stone-400 flex items-center justify-center gap-1">
            Атак сегодня
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-stone-500"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </button>
      </section>

      {/* Log History Modal */}
      <LogHistory isOpen={showLogHistory} onClose={() => setShowLogHistory(false)} />

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

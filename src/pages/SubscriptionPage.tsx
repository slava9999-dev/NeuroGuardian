// ============================================
// NeuroGUARDIAN — Subscription Page v2.0
// Aesthetic: Digital Upgrade | Access Tiering
// ============================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowLeft, Zap, Package, Shield, Sparkles } from 'lucide-react';
import { useAppStore } from '../stores';
import { paymentApi } from '../lib/api';
import { hapticFeedback } from '../lib/telegram';

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  productLimit: number;
  shopLimit: number;
  isPopular?: boolean;
}

const TIERS: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Core Basic',
    price: 0,
    currency: 'RUB',
    productLimit: 10,
    shopLimit: 1,
    features: [
      '10 объектов под защитой',
      '1 торговый канал',
      'Sentinel: Базовый режим',
      'Ручной перезапуск потоков',
    ],
  },
  {
    id: 'pro',
    name: 'Professional',
    price: 2999,
    currency: 'RUB',
    productLimit: 500,
    shopLimit: 3,
    isPopular: true,
    features: [
      '500 объектов под защитой',
      '3 активных канала',
      'Sentinel: Hard Mode (24/7)',
      'Digital Vision: Сквозные цены',
      'AI Ассистент (Unlimited)',
      'Приоритетный Neuro-канал',
    ],
  },
  {
    id: 'business',
    name: 'Enterprise',
    price: 9999,
    currency: 'RUB',
    productLimit: 999999,
    shopLimit: 10,
    features: [
      'Безлимитные объекты',
      '10 торговых каналов',
      'Sentinel: Ultra-Latency',
      'Командный доступ (Multi-user)',
      'Персональный архитектор',
      'Полный API доступ',
    ],
  },
];

interface SubscriptionPageProps {
  onBack: () => void;
}

export function SubscriptionPage({ onBack }: SubscriptionPageProps) {
  const user = useAppStore(state => state.user);
  const [selectedTier, setSelectedTier] = useState<string>(user?.subscriptionPlan || 'pro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (tierId: string) => {
    if (tierId === 'free' || tierId === user?.subscriptionPlan) return;

    hapticFeedback('medium');
    setLoading(true);
    setError(null);
    try {
      const result = await paymentApi.createPayment({ tier: tierId });
      if (result.confirmationUrl) {
        window.location.href = result.confirmationUrl;
      } else {
        setError(result.error || 'Ошибка инициализации шлюза');
      }
    } catch {
      hapticFeedback('error');
      setError('Сервис оплаты временно недоступен');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-background font-display relative overflow-x-hidden pb-40">
      <div className="aura-layer" />

      {/* Header */}
      <header className="sticky top-0 z-40 glass-nav border-b border-black/5 px-4 py-4">
        <div className="flex items-center gap-4 max-w-2xl mx-auto">
          <button
            onClick={() => {
              hapticFeedback('light');
              onBack();
            }}
            className="size-10 flex items-center justify-center rounded-xl fused-card border border-black/5 active:scale-90 transition-transform"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black tracking-tight text-text-main">Биллинг</h1>
            <p className="text-[10px] font-medium text-black/30 tracking-tight">
              Уровень доступа системы
            </p>
          </div>
        </div>
      </header>

      <div className="px-4 py-8 space-y-8 max-w-2xl mx-auto relative z-10">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black italic tracking-tighter uppercase">Upgrade</h2>
          <p className="text-xs font-medium text-black/40 max-w-[240px] mx-auto">
            Выберите уровень контроля и закройте уязвимости бизнеса
          </p>
        </div>

        {/* Trial Status Card */}
        {user?.subscriptionPlan === 'trial' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fused-card p-5 bg-black text-white flex items-center gap-4 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Sparkles size={80} />
            </div>
            <div className="size-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-lg shadow-white/20">
              <Zap size={22} className="text-black fill-black" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xs font-black uppercase tracking-widest">
                Тестовый период активен
              </h3>
              <p className="text-[10px] font-medium text-white/50 mt-1">
                Все функции PRO разблокированы до{' '}
                <span className="text-white">
                  {user?.subscriptionExpiresAt
                    ? new Date(user.subscriptionExpiresAt).toLocaleDateString()
                    : '7 дней'}
                </span>
              </p>
            </div>
          </motion.div>
        )}

        {/* Current Info */}
        <div className="flex items-center justify-between px-1">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-black/30 block mb-1">
              Статус ядра
            </span>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-peace-green animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-lg font-black italic uppercase tracking-tighter">
                {user?.subscriptionPlan || 'Basic Core'}
              </span>
            </div>
          </div>
        </div>

        {/* TIERS LIST */}
        <div className="space-y-4">
          {TIERS.map(tier => (
            <motion.div
              key={tier.id}
              onClick={() => {
                hapticFeedback('light');
                setSelectedTier(tier.id);
              }}
              className={`fused-card p-6 cursor-pointer relative transition-all duration-300 ${selectedTier === tier.id ? 'ring-2 ring-black bg-black/3' : 'opacity-60 border-black/5'}`}
            >
              {tier.isPopular && (
                <div className="absolute top-0 right-6 bg-black text-white text-[8px] font-black px-3 py-1.5 rounded-b-lg tracking-widest uppercase">
                  Recommend
                </div>
              )}

              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30">
                    {tier.name}
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-black italic tracking-tighter">
                      {tier.price.toLocaleString()}₽
                    </span>
                    <span className="text-[10px] font-black text-black/20 uppercase">/ мес</span>
                  </div>
                </div>
                <div
                  className={`size-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedTier === tier.id ? 'bg-black border-black' : 'border-black/5 bg-transparent'}`}
                >
                  {selectedTier === tier.id && (
                    <Check size={14} className="text-white" strokeWidth={4} />
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {tier.features.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-[11px] font-bold text-black/60"
                  >
                    <div className="size-1 rounded-full bg-black/20" />
                    {f}
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-5 border-t border-black/5 flex gap-4">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-black/20" />
                  <span className="text-[10px] font-black text-black/40 uppercase tracking-tighter">
                    Limit: {tier.productLimit === 999999 ? '∞' : tier.productLimit} SKU
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-black/20" />
                  <span className="text-[10px] font-black text-black/40 uppercase tracking-tighter">
                    Channels: {tier.shopLimit}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* FOOTER CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-6 glass-nav border-t border-black/5 z-50">
        <div className="max-w-2xl mx-auto">
          <button
            disabled={loading || selectedTier === 'free' || selectedTier === user?.subscriptionPlan}
            onClick={() => handleSubscribe(selectedTier)}
            className={`w-full h-16 rounded-[24px] font-black text-xs uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 shadow-2xl ${
              selectedTier === 'free' || selectedTier === user?.subscriptionPlan
                ? 'bg-black/5 text-black/20 cursor-not-allowed shadow-none'
                : 'bg-black text-white active:scale-95 shadow-black/20'
            }`}
          >
            {loading ? (
              <div className="size-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : selectedTier === user?.subscriptionPlan ? (
              'Ядро активно'
            ) : (
              <>
                Подключить апгрейд <Zap size={16} className="fill-current" />
              </>
            )}
          </button>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-toxic-orange text-center text-[10px] font-black mt-4 uppercase tracking-widest"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

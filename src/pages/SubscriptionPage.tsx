// ============================================
// NeuroGUARDIAN — Subscription Page V4.0
// Premium Professional Upgrades: Pitch Black & Cyber Accents
// ============================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowLeft, Zap, Crown, Package } from 'lucide-react';
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
    name: 'BASIC',
    price: 0,
    currency: 'RUB',
    productLimit: 10,
    shopLimit: 1,
    features: [
      '10 товаров под защитой',
      '1 магазин (WB/Ozon)',
      'Sentinel: Базовая детекция',
      'Ручной перезапуск',
    ],
  },
  {
    id: 'pro',
    name: 'PROFESSIONAL',
    price: 2999,
    currency: 'RUB',
    productLimit: 500,
    shopLimit: 3,
    isPopular: true,
    features: [
      '500 товаров под защитой',
      '3 магазина одновременно',
      'Sentinel: HARD MODE (24/7)',
      'Digital Vision: Парсинг цен',
      'SMM-Ассистент (Unlimited)',
      'Приоритетный AI-канал',
    ],
  },
  {
    id: 'business',
    name: 'ENTERPRISE',
    price: 9999,
    currency: 'RUB',
    productLimit: 999999,
    shopLimit: 10,
    features: [
      'Безлимит товаров',
      '10 магазинов',
      'Sentinel: Ultra-Low Latency',
      'Командный доступ',
      'Персональный архитектор',
      'API интеграции',
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
    <div className="min-h-screen bg-black text-white pb-32 relative overflow-x-hidden bg-cosmic">
      {/* Dynamic Background Glow */}
      <div className="nebula-glow opacity-50" />

      {/* Header */}
      <div className="z-10 p-5 flex items-center justify-between nav-blur sticky top-0">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full transition-all">
          <ArrowLeft className="w-6 h-6 text-zinc-400" />
        </button>
        <span className="text-[10px] font-black tracking-[0.3em] text-zinc-500 uppercase">
          billing system v5
        </span>
        <div className="w-10" />
      </div>

      <div className="relative z-10 p-6 max-w-xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tight mb-2 italic">UPGRADE</h1>
          <p className="text-zinc-500 text-sm font-medium">
            Выберите уровень контроля над вашим бизнесом
          </p>
        </header>

        {/* Trial Status Card */}
        {user?.subscriptionPlan === 'trial' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="premium-card bg-violet-500/10 border-violet-500/30 mb-8 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-violet-500 flex items-center justify-center shadow-lg shadow-violet-500/40">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">ТЕСТОВЫЙ ПЕРИОД АКТИВЕН</h3>
              <p className="text-[11px] text-violet-300 font-mono">
                Все функции PRO разблокированы до{' '}
                {user?.subscriptionExpiresAt
                  ? new Date(user.subscriptionExpiresAt).toLocaleDateString()
                  : '7 дней'}
              </p>
            </div>
          </motion.div>
        )}

        {/* Current Plan Indicator */}
        <div className="mb-8 px-2 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1">
              ТЕКУЩИЙ СТАТУС
            </span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
              <span className="text-lg font-black italic tracking-tighter">
                {user?.subscriptionPlan?.toUpperCase() || 'FREE'}
              </span>
            </div>
          </div>
        </div>

        {/* Tiers List */}
        <div className="space-y-4">
          {TIERS.map(tier => (
            <motion.div
              key={tier.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedTier(tier.id)}
              className={`premium-card cursor-pointer relative ${
                selectedTier === tier.id
                  ? 'border-violet-500/60 bg-violet-500/5 ring-1 ring-violet-500/20'
                  : 'border-white/5 opacity-80'
              }`}
            >
              {tier.isPopular && (
                <div className="absolute -top-px right-6 bg-emerald-400 text-black text-[9px] font-black px-3 py-1 rounded-b-md shadow-lg shadow-emerald-500/20">
                  RECOMMENDED
                </div>
              )}

              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em]">
                    {tier.name}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black italic">
                      {tier.price.toLocaleString()}₽
                    </span>
                    <span className="text-zinc-600 text-[10px] font-bold">/ МЕС</span>
                  </div>
                </div>

                <div
                  className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                    selectedTier === tier.id
                      ? 'bg-violet-500 border-violet-400'
                      : 'border-zinc-800 bg-zinc-900'
                  }`}
                >
                  {selectedTier === tier.id && (
                    <Check className="w-4 h-4 text-white" strokeWidth={4} />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-y-2.5">
                {tier.features.map((feature, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 text-[12px] font-medium text-zinc-300"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                    {feature}
                  </div>
                ))}
              </div>

              {/* Limit Footer */}
              <div className="mt-6 pt-4 border-t border-white/5 flex gap-4">
                <div className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-[10px] font-mono text-zinc-400">
                    LIMIT: {tier.productLimit === 999999 ? '∞' : tier.productLimit} SKU
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-[10px] font-mono text-zinc-400">
                    SHOPS: {tier.shopLimit}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Floating Action CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-6 nav-blur border-t border-white/5 safe-area-inset-bottom z-50">
        <div className="max-w-xl mx-auto">
          <button
            disabled={loading || selectedTier === 'free' || selectedTier === user?.subscriptionPlan}
            onClick={() => handleSubscribe(selectedTier)}
            className={`w-full py-5 rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
              selectedTier === 'free' || selectedTier === user?.subscriptionPlan
                ? 'bg-zinc-900 text-zinc-600 border border-white/5 cursor-not-allowed'
                : 'bg-white text-black hover:bg-emerald-400 shadow-[0_10px_40px_rgba(255,255,255,0.1)] hover:shadow-emerald-500/20'
            }`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : selectedTier === user?.subscriptionPlan ? (
              'ПЛАН АКТИВЕН'
            ) : (
              <>
                ПОДКЛЮЧИТЬ ПЛАН <Zap className="w-4 h-4 fill-current" />
              </>
            )}
          </button>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-center text-[10px] mt-4 font-bold tracking-widest"
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

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../stores';
import { paymentApi } from '../lib/api';

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
    name: 'Старт',
    price: 0,
    currency: 'RUB',
    productLimit: 10,
    shopLimit: 1,
    features: ['10 товаров', '1 магазин', 'Базовая защита', 'Ручной запуск'],
  },
  {
    id: 'basic',
    name: 'Базовый',
    price: 999,
    currency: 'RUB',
    productLimit: 50,
    shopLimit: 1,
    isPopular: true,
    features: ['50 товаров', '1 магазин', 'Авто-защита 24/7', 'Умные уведомления', 'AI аналитика'],
  },
  {
    id: 'pro',
    name: 'Про',
    price: 2999,
    currency: 'RUB',
    productLimit: 500,
    shopLimit: 3,
    features: [
      '500 товаров',
      '3 магазина',
      'Приоритетная поддержка',
      'Расширенная аналитика',
      'Экспорт отчетов',
    ],
  },
  {
    id: 'business',
    name: 'Бизнес',
    price: 9999,
    currency: 'RUB',
    productLimit: 999999,
    shopLimit: 10,
    features: [
      'Безлимит товаров',
      '10 магазинов',
      'Персональный менеджер',
      'API доступ',
      'White label (soon)',
    ],
  },
];

interface SubscriptionPageProps {
  onBack: () => void;
}

export function SubscriptionPage({ onBack }: SubscriptionPageProps) {
  const user = useAppStore(state => state.user);
  const [selectedTier, setSelectedTier] = useState<string>(user?.subscriptionPlan || 'basic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (tierId: string) => {
    if (tierId === 'free') return; // Cannot "subscribe" to free manually here, usually default

    setLoading(true);
    setError(null);
    try {
      const result = await paymentApi.createPayment({ tier: tierId });
      if (result.confirmationUrl) {
        // Redirect to YooKassa
        window.location.href = result.confirmationUrl;
      } else {
        setError(result.error || 'Не удалось создать платеж');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('Ошибка при создании платежа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 text-white pb-24 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-900/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-900/10 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <div className="relative z-10 p-4 flex items-center gap-4 bg-stone-900/80 backdrop-blur-xl border-b border-white/5 sticky top-0">
        <button
          onClick={onBack}
          className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-stone-400"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-lg font-bold">Подписка NeuroGuardian</h1>
      </div>

      <div className="relative z-10 p-4 max-w-lg mx-auto space-y-6">
        {/* Trial Banner */}
        {user?.subscriptionPlan === 'trial' && (
          <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 border border-amber-500/30 rounded-2xl p-4 text-center">
            <div className="text-3xl mb-2">🎁</div>
            <h2 className="text-xl font-bold text-white mb-1">Тест-драйв активен!</h2>
            <p className="text-amber-300 text-sm">
              У вас <strong>7 дней бесплатного</strong> доступа ко всем функциям
            </p>
            {user?.subscriptionExpiresAt && (
              <p className="text-xs text-stone-400 mt-2">
                Осталось до: {new Date(user.subscriptionExpiresAt).toLocaleDateString('ru-RU')}
              </p>
            )}
          </div>
        )}

        {/* Current Status */}
        <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-2xl p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-stone-400 text-sm">Текущий план</p>
              <h3 className="text-xl font-bold text-white capitalize">
                {user?.subscriptionPlan === 'trial'
                  ? '🎁 Тест-драйв'
                  : user?.subscriptionPlan || 'Free'}
              </h3>
            </div>
            {user?.subscriptionActive && (
              <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded-full border border-emerald-500/20">
                Активен
              </span>
            )}
          </div>
          {user?.subscriptionExpiresAt && user?.subscriptionPlan !== 'trial' && (
            <p className="text-xs text-stone-500 mt-2">
              Истекает: {new Date(user.subscriptionExpiresAt).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Tiers List */}
        <div className="space-y-4">
          {TIERS.map(tier => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`relative overflow-hidden rounded-2xl border transition-all ${
                selectedTier === tier.id
                  ? 'bg-stone-800 border-violet-500 shadow-lg shadow-violet-500/10'
                  : 'bg-stone-800/50 border-white/5 hover:border-white/10'
              }`}
              onClick={() => setSelectedTier(tier.id)}
            >
              {tier.isPopular && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-violet-600 to-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                  ПОПУЛЯРНЫЙ
                </div>
              )}

              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{tier.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">
                        {tier.price === 0 ? 'Бесплатно' : `${tier.price}₽`}
                      </span>
                      {tier.price > 0 && <span className="text-stone-500 text-sm">/мес</span>}
                    </div>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedTier === tier.id
                        ? 'border-violet-500 bg-violet-500'
                        : 'border-stone-600'
                    }`}
                  >
                    {selectedTier === tier.id && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="text-white"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-2 mb-4">
                  {tier.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-stone-300">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={tier.id === 'free' ? '#78716c' : '#a78bfa'}
                        strokeWidth="2"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Action Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-stone-900/95 backdrop-blur-md border-t border-stone-800 safe-area-inset-bottom">
          <button
            disabled={loading || selectedTier === 'free'}
            onClick={() => handleSubscribe(selectedTier)}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              selectedTier === 'free'
                ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-900/50 active:scale-[0.98]'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Обработка...
              </span>
            ) : selectedTier === 'free' ? (
              'Текущий план'
            ) : (
              `Подключить за ${TIERS.find(t => t.id === selectedTier)?.price}₽`
            )}
          </button>
          {error && <p className="text-red-400 text-center text-sm mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}

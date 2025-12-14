// ============================================
// NeuroGUARDIAN — Payment Modal
// YooKassa Widget integration
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hapticFeedback } from '../../lib/telegram';
import { paymentApi, type SubscriptionPlan } from '../../lib/api';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Fallback plans if API is not available
const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Базовый',
    price: 499,
    durationDays: 30,
    maxProducts: 50,
    features: [
      'До 50 товаров',
      'Защита Zero Stock',
      'Telegram уведомления',
    ],
    pricePerMonth: 499,
    isPopular: false,
    isBestValue: false,
  },
  {
    id: 'pro',
    name: 'Профессиональный',
    price: 999,
    durationDays: 30,
    maxProducts: 500,
    features: [
      'До 500 товаров',
      'Оба режима защиты',
      'Приоритетная поддержка',
      'API доступ',
    ],
    pricePerMonth: 999,
    isPopular: true,
    isBestValue: false,
  },
  {
    id: 'yearly',
    name: 'Годовой Pro',
    price: 9990,
    durationDays: 365,
    maxProducts: 500,
    features: [
      'Все из Pro',
      'Экономия 2000₽',
      'Персональный менеджер',
    ],
    pricePerMonth: 833,
    isPopular: false,
    isBestValue: true,
  },
];

// Load YooKassa Widget script
function loadYooKassaWidget(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).YooMoneyCheckoutWidget) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://yookassa.ru/checkout-widget/v1/checkout-widget.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load YooKassa widget'));
    document.head.appendChild(script);
  });
}

export function PaymentModal({ isOpen, onClose, onSuccess }: PaymentModalProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(FALLBACK_PLANS);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWidget, setShowWidget] = useState(false);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);

  // Load plans on mount
  useEffect(() => {
    if (isOpen) {
      loadPlans();
    }
  }, [isOpen]);

  const loadPlans = async () => {
    setIsLoadingPlans(true);
    try {
      const response = await paymentApi.getPlans();
      if (response.success && response.plans.length > 0) {
        setPlans(response.plans);
      }
    } catch (err) {
      console.warn('Failed to load plans, using fallback');
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const handleSelectPlan = (planId: string) => {
    hapticFeedback('light');
    setSelectedPlan(planId);
    setError(null);
  };

  // Initialize YooKassa Widget
  const initWidget = useCallback(async (token: string) => {
    try {
      await loadYooKassaWidget();

      const YooMoneyCheckoutWidget = (window as any).YooMoneyCheckoutWidget;
      
      const checkout = new YooMoneyCheckoutWidget({
        confirmation_token: token,
        return_url: window.location.origin + '?payment_complete=true',
        error_callback: (error: any) => {
          console.error('YooKassa Widget error:', error);
          setError('Ошибка виджета оплаты');
          setShowWidget(false);
          hapticFeedback('error');
        },
      });

      checkout.on('success', () => {
        hapticFeedback('success');
        setShowWidget(false);
        onSuccess?.();
        onClose();
      });

      checkout.on('fail', () => {
        hapticFeedback('error');
        setError('Платёж не прошёл');
        setShowWidget(false);
      });

      checkout.render('yookassa-widget-container');
    } catch (err) {
      console.error('Widget initialization error:', err);
      setError('Не удалось загрузить виджет оплаты');
      setShowWidget(false);
    }
  }, [onSuccess, onClose]);

  useEffect(() => {
    if (showWidget && confirmationToken) {
      initWidget(confirmationToken);
    }
  }, [showWidget, confirmationToken, initWidget]);

  const handlePayment = async () => {
    if (!selectedPlan) {
      setError('Выберите тариф');
      return;
    }

    hapticFeedback('medium');
    setIsProcessing(true);
    setError(null);

    try {
      const result = await paymentApi.createPayment({
        planId: selectedPlan,
        savePaymentMethod: true,
      });

      if (!result.success) {
        throw new Error(result.error || 'Ошибка создания платежа');
      }

      // If we got confirmation token, show embedded widget
      if (result.confirmationToken) {
        setConfirmationToken(result.confirmationToken);
        setShowWidget(true);
        setIsProcessing(false);
        return;
      }

      // Fallback: redirect to YooKassa payment page
      if (result.confirmationUrl) {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openLink) {
          tg.openLink(result.confirmationUrl);
        } else {
          window.open(result.confirmationUrl, '_blank');
        }
        setIsProcessing(false);
        onClose();
        return;
      }

      throw new Error('Не получены данные для оплаты');
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Ошибка оплаты');
      hapticFeedback('error');
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setShowWidget(false);
      setConfirmationToken(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25 }}
          className="w-full max-w-lg bg-stone-900 rounded-t-3xl sm:rounded-2xl border-t sm:border border-stone-700 overflow-hidden max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-stone-900 p-4 border-b border-stone-700 flex items-center justify-between z-10">
            <h2 className="text-xl font-bold text-white">
              {showWidget ? 'Оплата' : 'Оформить подписку'}
            </h2>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="p-2 rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* YooKassa Widget Container */}
          {showWidget ? (
            <div className="p-4">
              <div id="yookassa-widget-container" className="min-h-[400px]" />
            </div>
          ) : (
            <>
              {/* Plans */}
              <div className="p-4 space-y-4">
                {isLoadingPlans ? (
                  <div className="flex items-center justify-center py-8">
                    <motion.div
                      className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                ) : (
                  plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => handleSelectPlan(plan.id)}
                      className={`
                        w-full p-4 rounded-2xl border-2 transition-all text-left relative
                        ${selectedPlan === plan.id
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-stone-700 bg-stone-800/50 hover:border-stone-600'
                        }
                      `}
                    >
                      {/* Popular badge */}
                      {plan.isPopular && (
                        <div className="absolute -top-3 left-4 px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-400 text-stone-900 text-xs font-bold rounded-full">
                          ПОПУЛЯРНЫЙ
                        </div>
                      )}
                      
                      {/* Best value badge */}
                      {plan.isBestValue && (
                        <div className="absolute -top-3 left-4 px-3 py-1 bg-gradient-to-r from-emerald-500 to-emerald-400 text-stone-900 text-xs font-bold rounded-full">
                          ВЫГОДНО
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-amber-400">{plan.price}₽</span>
                            <span className="text-stone-400">
                              /{plan.durationDays === 365 ? 'год' : 'месяц'}
                            </span>
                          </div>
                          {plan.durationDays === 365 && (
                            <span className="text-xs text-emerald-400">
                              {plan.pricePerMonth}₽/месяц
                            </span>
                          )}
                        </div>
                        
                        <div className={`
                          w-6 h-6 rounded-full border-2 flex items-center justify-center
                          ${selectedPlan === plan.id ? 'border-amber-500 bg-amber-500' : 'border-stone-600'}
                        `}>
                          {selectedPlan === plan.id && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-stone-900">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </div>
                      </div>
                      
                      <ul className="space-y-2">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-stone-300">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400 flex-shrink-0">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="mx-4 mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Footer */}
              <div className="sticky bottom-0 bg-stone-900 p-4 border-t border-stone-700">
                <button
                  onClick={handlePayment}
                  disabled={!selectedPlan || isProcessing}
                  className={`
                    w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2
                    ${selectedPlan
                      ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-900 hover:from-amber-400 hover:to-amber-300'
                      : 'bg-stone-700 text-stone-400 cursor-not-allowed'
                    }
                  `}
                >
                  {isProcessing ? (
                    <>
                      <motion.div
                        className="w-5 h-5 border-2 border-stone-900 border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      Создание платежа...
                    </>
                  ) : (
                    <>
                      💳 Оплатить
                      {selectedPlan && (
                        <span>
                          {plans.find((p) => p.id === selectedPlan)?.price}₽
                        </span>
                      )}
                    </>
                  )}
                </button>
                
                <p className="text-xs text-stone-500 text-center mt-3">
                  Безопасная оплата через ЮКасса. Отмена в любой момент.
                </p>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

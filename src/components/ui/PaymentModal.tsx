// ============================================
// NeuroAgent — Payment Modal
// YooKassa Widget integration + Test Mode
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hapticFeedback } from '../../lib/telegram';
import { paymentApi, type SubscriptionPlan } from '../../lib/api';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onGoToSettings?: () => void;
  selectedPlan?: string; // Pre-selected plan ID
}

// Fallback plans
const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: 'pro',
    name: 'Pro',
    price: 999,
    durationDays: 30,
    maxProducts: 500,
    features: ['До 500 товаров', 'Все режимы защиты', 'AI-агент', 'Приоритетная поддержка'],
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
    features: ['Все из Pro', 'Экономия 2000₽', '2 месяца бесплатно', 'Персональный менеджер'],
    pricePerMonth: 833,
    isPopular: false,
    isBestValue: true,
  },
];

// Load YooKassa Widget script
function loadYooKassaWidget(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as Window & { YooMoneyCheckoutWidget?: unknown }).YooMoneyCheckoutWidget) {
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

export function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  onGoToSettings,
  selectedPlan: initialPlan,
}: PaymentModalProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(FALLBACK_PLANS);
  // If initialPlan is provided, we start in "Confirmation" mode (selectedPlanId is set)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(initialPlan || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWidget, setShowWidget] = useState(false);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null); // For manual link payment

  // SUCCESS STATE
  const [showSuccess, setShowSuccess] = useState(false);
  const [activatedPlan, setActivatedPlan] = useState<{ name: string; durationDays: number } | null>(
    null
  );

  // Load plans on mount
  useEffect(() => {
    if (isOpen) {
      loadPlans();
      // Reset state when opening
      setShowSuccess(false);
      setActivatedPlan(null);
      setSelectedPlanId(initialPlan || null); // Reset to props
      setError(null);
      setShowWidget(false);
      setConfirmationToken(null);
      setFallbackUrl(null);
    }
  }, [isOpen, initialPlan]);

  const loadPlans = async () => {
    setIsLoadingPlans(true);
    try {
      const response = await paymentApi.getPlans();
      if (response.success && response.plans.length > 0) {
        setPlans(response.plans);
      }
    } catch {
      console.warn('Failed to load plans, using fallback');
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const handleSelectPlan = (planId: string) => {
    hapticFeedback('light');
    setSelectedPlanId(planId);
    setError(null);
  };

  // Initialize YooKassa Widget
  const initWidget = useCallback(
    async (token: string) => {
      try {
        await loadYooKassaWidget();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const YooMoneyCheckoutWidget = (window as unknown as { YooMoneyCheckoutWidget: any })
          .YooMoneyCheckoutWidget;

        const checkout = new YooMoneyCheckoutWidget({
          confirmation_token: token,
          return_url: window.location.origin + '?payment_complete=true',
          error_callback: (error: unknown) => {
            console.error('YooKassa Widget error:', error);
            setError('Ошибка загрузки виджета. Используйте ссылку ниже.');
            setShowWidget(false); // Hide widget container to show fallback link
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
          setError('Платёж не прошёл или был отменен');
          setShowWidget(false);
        });

        checkout.render('yookassa-widget-container');
      } catch (err) {
        console.error('Widget initialization error:', err);
        setError('Не удалось загрузить виджет оплаты');
        setShowWidget(false);
      }
    },
    [onSuccess, onClose]
  );

  // Trigger widget init when token is available
  useEffect(() => {
    if (showWidget && confirmationToken) {
      // Small delay to ensure container exists
      const timer = setTimeout(() => initWidget(confirmationToken), 100);
      return () => clearTimeout(timer);
    }
  }, [showWidget, confirmationToken, initWidget]);

  const handlePayment = async () => {
    if (!selectedPlanId) {
      setError('Выберите тариф');
      return;
    }

    hapticFeedback('medium');
    setIsProcessing(true);
    setError(null);
    setFallbackUrl(null);

    try {
      const result = await paymentApi.createPayment({
        planId: selectedPlanId,
        savePaymentMethod: true,
      });

      if (!result.success) {
        throw new Error(result.error || 'Ошибка создания платежа');
      }

      // TEST MODE: Subscription activated without payment
      if (result.testMode) {
        hapticFeedback('success');
        setActivatedPlan({
          name: result.plan?.name || selectedPlanId,
          durationDays: result.plan?.durationDays || 30,
        });
        setShowSuccess(true);
        setIsProcessing(false);
        onSuccess?.();
        return;
      }

      // Store fallback URL regardless if we use widget
      if (result.confirmationUrl) {
        setFallbackUrl(result.confirmationUrl);
      }

      // If we got confirmation token, use embedded widget
      if (result.confirmationToken) {
        setConfirmationToken(result.confirmationToken);
        setShowWidget(true);
        setIsProcessing(false);
        return;
      }

      // Fallback: If no token but URL exists, redirect or show link
      if (result.confirmationUrl) {
        window.location.href = result.confirmationUrl;
        return;
      }

      throw new Error('Не получены данные для оплаты');
    } catch (err) {
      console.error('Payment error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Ошибка оплаты. Попробуйте позже.';
      setError(errorMessage);
      hapticFeedback('error');
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setShowWidget(false);
      setConfirmationToken(null);
      setShowSuccess(false);
      setActivatedPlan(null);
      onClose();
    }
  };

  const selectedPlanDetails = plans.find(p => p.id === selectedPlanId);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-md"
        onClick={handleClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25 }}
          className="w-full max-w-lg bg-stone-900 rounded-t-3xl sm:rounded-2xl border-t sm:border border-stone-700 overflow-hidden max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* SUCCESS SCREEN */}
          {showSuccess ? (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="w-24 h-24 mb-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30"
              >
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-white"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">Оплата прошла успешно!</h2>
              <p className="text-stone-400 mb-8">
                Тариф <span className="text-white font-bold">{activatedPlan?.name}</span>{' '}
                активирован на {activatedPlan?.durationDays} дней.
              </p>
              <button
                onClick={() => {
                  if (onGoToSettings) onGoToSettings();
                  else handleClose();
                }}
                className="w-full py-4 rounded-xl font-bold text-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
              >
                Отлично
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex-shrink-0 bg-stone-900 p-4 border-b border-stone-800 flex items-center justify-between z-10">
                <h2 className="text-lg font-bold text-white">
                  {showWidget ? 'Оплата картой' : 'Оформление подписки'}
                </h2>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-colors"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content area */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* 1. Payment Widget Container */}
                {showWidget ? (
                  <div className="min-h-[300px] flex flex-col">
                    <div
                      id="yookassa-widget-container"
                      className="flex-1 rounded-xl overflow-hidden"
                    />
                  </div>
                ) : (
                  /* 2. Plan Selection / Confirmation */
                  <div className="space-y-4">
                    {/* Show Summary Card instead of list IF plan is already selected */}
                    {selectedPlanId && selectedPlanDetails ? (
                      <div className="p-5 rounded-2xl bg-stone-800/50 border border-stone-700">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-stone-400 text-sm mb-1">Выбранный тариф</p>
                            <h3 className="text-xl font-bold text-white">
                              {selectedPlanDetails.name}
                            </h3>
                          </div>
                          <div className="text-right">
                            <span className="block text-2xl font-bold text-amber-500">
                              {selectedPlanDetails.price} ₽
                            </span>
                            <span className="text-xs text-stone-500">
                              /{selectedPlanDetails.durationDays === 365 ? 'год' : 'мес'}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          {selectedPlanDetails.features.slice(0, 3).map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-stone-300">
                              <span className="text-emerald-500">✓</span> {f}
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => setSelectedPlanId(null)}
                          className="text-sm text-stone-500 hover:text-white underline transition-colors"
                        >
                          Выбрать другой тариф
                        </button>
                      </div>
                    ) : (
                      /* Plan List (Only if no plan selected) */
                      <div className="space-y-3">
                        {isLoadingPlans ? (
                          <div className="py-10 text-center text-stone-500">
                            Загрузка тарифов...
                          </div>
                        ) : (
                          plans.map(plan => (
                            <button
                              key={plan.id}
                              onClick={() => handleSelectPlan(plan.id)}
                              className="w-full p-4 rounded-xl bg-stone-800 border-2 border-transparent hover:border-stone-600 transition-all text-left flex justify-between items-center"
                            >
                              <div>
                                <div className="font-bold text-white">{plan.name}</div>
                                <div className="text-sm text-stone-400">{plan.price} ₽</div>
                              </div>
                              <div className="w-5 h-5 rounded-full border-2 border-stone-600" />
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                        {error}
                        {fallbackUrl && (
                          <a
                            href={fallbackUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block mt-2 font-bold underline"
                          >
                            Оплатить по прямой ссылке
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              {!showWidget && (
                <div className="flex-shrink-0 p-4 bg-stone-900 border-t border-stone-800">
                  <button
                    onClick={handlePayment}
                    disabled={!selectedPlanId || isProcessing}
                    className={`
                      w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2
                      ${
                        selectedPlanId && !isProcessing
                          ? 'bg-amber-500 text-stone-900 hover:bg-amber-400 shadow-lg shadow-amber-500/20'
                          : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                      }
                    `}
                  >
                    {isProcessing
                      ? 'Обработка...'
                      : `Оплатить ${selectedPlanDetails?.price || ''} ₽`}
                  </button>

                  <p className="text-center text-[10px] text-stone-500 mt-3 px-4">
                    Нажимая кнопку, вы соглашаетесь с условиями{' '}
                    <a href="#" className="text-stone-400 hover:text-white">
                      оферты
                    </a>{' '}
                    и рекуррентных платежей.
                  </p>
                </div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================
// NeuroAgent — Payment Modal V6.0 (Human)
// Aesthetic: Clear Steps, Visual Feedback
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hapticFeedback } from '../../lib/telegram';
import { paymentApi, type SubscriptionPlan } from '../../lib/api';
import { Check, X, Shield, Star, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onGoToSettings?: () => void;
  selectedPlan?: string;
}

const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: 'pro',
    name: 'Pro',
    price: 999,
    durationDays: 30,
    maxProducts: 500,
    features: [
      '🧠 AI-агент (Голос/Текст)',
      '📊 Аналитика в реальном времени',
      '🛡️ NeuroGuardian 24/7',
      '🔍 Анализ конкурентов',
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
      '✅ Все функции Pro',
      '💰 Выгода 20%',
      '🎁 2 месяца бесплатно',
      '👑 Персональный менеджер',
    ],
    pricePerMonth: 833,
    isPopular: false,
    isBestValue: true,
  },
];

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
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(initialPlan || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWidget, setShowWidget] = useState(false);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activatedPlan, setActivatedPlan] = useState<{ name: string; durationDays: number } | null>(
    null
  );

  useEffect(() => {
    if (isOpen) {
      loadPlans();
      setShowSuccess(false);
      setActivatedPlan(null);
      setSelectedPlanId(initialPlan || null);
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

  useEffect(() => {
    if (showWidget && confirmationToken) {
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
      const isYearly = selectedPlanId === 'yearly';
      const tier = isYearly ? 'pro' : selectedPlanId || 'pro';
      const billingPeriod = isYearly ? 'yearly' : 'monthly';

      const result = await paymentApi.createPayment({
        tier,
        billingPeriod,
        savePaymentMethod: true,
      });

      if (!result.success) {
        throw new Error(result.error || 'Ошибка создания платежа');
      }

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

      if (result.confirmationUrl) {
        setFallbackUrl(result.confirmationUrl);
      }

      if (result.confirmationToken) {
        setConfirmationToken(result.confirmationToken);
        setShowWidget(true);
        setIsProcessing(false);
        return;
      }

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

  const selectedPlanDetails = plans.find(p => p.id === selectedPlanId);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-10 sticky top-0">
            {!showSuccess ? (
              <div className="flex items-center gap-3">
                {showWidget ? (
                  <button
                    onClick={() => setShowWidget(false)}
                    className="p-1 hover:bg-slate-100 rounded-lg -ml-2"
                    aria-label="Назад"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-500" />
                  </button>
                ) : (
                  <div className="p-2 bg-indigo-50 rounded-xl">
                    <Star className="w-5 h-5 text-indigo-600" fill="currentColor" />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {showWidget ? 'Оплата' : 'Подписка Pro'}
                  </h2>
                </div>
              </div>
            ) : (
              <div className="w-full"></div>
            )}

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 bg-slate-50/50">
            {showSuccess ? (
              <div className="flex flex-col items-center justify-center text-center py-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6"
                >
                  <Check className="w-10 h-10 text-emerald-600 border-2 border-emerald-600 rounded-full p-1" />
                </motion.div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Оплата прошла!</h3>
                <p className="text-slate-500 mb-8 max-w-[250px]">
                  Тариф <span className="text-slate-900 font-bold">{activatedPlan?.name}</span>{' '}
                  активирован на {activatedPlan?.durationDays} дней.
                </p>
                <button
                  onClick={() => {
                    if (onGoToSettings) onGoToSettings();
                    else onClose();
                  }}
                  className="w-full btn-premium bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200"
                >
                  Отлично
                </button>
              </div>
            ) : showWidget ? (
              <div className="min-h-[300px] flex flex-col">
                <div
                  id="yookassa-widget-container"
                  className="flex-1 rounded-xl overflow-hidden shadow-sm border border-slate-200"
                />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Plan Selector */}
                {isLoadingPlans ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                    <p className="text-slate-400 text-sm">Загрузка тарифов...</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {plans.map(plan => (
                      <button
                        key={plan.id}
                        onClick={() => handleSelectPlan(plan.id)}
                        className={`relative group p-4 rounded-2xl border-2 text-left transition-all ${
                          selectedPlanId === plan.id
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-1 ring-indigo-600/20'
                            : 'border-slate-200 bg-white hover:border-indigo-300'
                        }`}
                      >
                        {plan.isBestValue && (
                          <span className="absolute -top-3 right-4 bg-linear-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                            ВЫГОДНО
                          </span>
                        )}

                        <div className="flex justify-between items-center mb-2">
                          <span
                            className={`font-bold text-lg ${
                              selectedPlanId === plan.id ? 'text-indigo-900' : 'text-slate-900'
                            }`}
                          >
                            {plan.name}
                          </span>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              selectedPlanId === plan.id
                                ? 'border-indigo-600 bg-indigo-600'
                                : 'border-slate-300'
                            }`}
                          >
                            {selectedPlanId === plan.id && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </div>

                        <div className="flex items-baseline gap-1 mb-3">
                          <span className="text-2xl font-black text-slate-900">{plan.price} ₽</span>
                          <span className="text-sm text-slate-500 font-medium">
                            / {plan.durationDays === 365 ? 'год' : 'мес'}
                          </span>
                        </div>

                        <ul className="space-y-2">
                          {plan.features.slice(0, 3).map((feature, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-xs font-medium text-slate-600"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    ))}
                  </div>
                )}

                {/* Security Badge */}
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium bg-slate-100/50 py-3 rounded-xl">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Платежи защищены SSL шифрованием</span>
                </div>

                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm font-medium text-center">
                    {error}
                    {fallbackUrl && (
                      <a
                        href={fallbackUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block mt-2 underline font-bold"
                      >
                        Оплатить по ссылке
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Action */}
          {!showSuccess && !showWidget && (
            <div className="p-4 bg-white border-t border-slate-100">
              <button
                onClick={handlePayment}
                disabled={!selectedPlanId || isProcessing}
                className="w-full btn-premium bg-linear-to-r from-indigo-600 to-violet-600 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  'Обработка...'
                ) : (
                  <>
                    <span>Оплатить {selectedPlanDetails?.price} ₽</span>
                    <ChevronRight className="w-5 h-5 opacity-80" />
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-slate-400 mt-3 px-4">
                Нажимая кнопку, вы принимаете условия{' '}
                <a href="#" className="underline hover:text-indigo-600">
                  оферты
                </a>
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

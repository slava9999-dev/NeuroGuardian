// ============================================
// NeuroGUARDIAN — Payment Modal
// YooKassa / Telegram Payments integration
// ============================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hapticFeedback } from '../../lib/telegram';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SUBSCRIPTION_PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 990,
    period: 'месяц',
    features: [
      'До 100 товаров',
      'Проверка каждые 5 минут',
      'Telegram уведомления',
      'Режим "Обнуление стока"',
    ],
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 1990,
    period: 'месяц',
    features: [
      'Неограниченно товаров',
      'Проверка каждую минуту',
      'Telegram + Email уведомления',
      'Оба режима защиты',
      'Приоритетная поддержка',
      'API доступ',
    ],
    popular: true,
  },
];

export function PaymentModal({ isOpen, onClose, onSuccess }: PaymentModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPlan = (planId: string) => {
    hapticFeedback('light');
    setSelectedPlan(planId);
    setError(null);
  };

  const handlePayment = async () => {
    if (!selectedPlan) {
      setError('Выберите тариф');
      return;
    }

    hapticFeedback('medium');
    setIsProcessing(true);
    setError(null);

    try {
      const plan = SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlan);
      if (!plan) throw new Error('Тариф не найден');

      // Проверяем доступность Telegram Payments
      const tg = window.Telegram?.WebApp as any;
      
      if (tg?.openInvoice) {
        // Используем Telegram Payments
        // Нужен backend для создания invoice
        const response = await fetch('/api/createInvoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: selectedPlan }),
        });
        
        const { invoiceLink } = await response.json();
        
        tg.openInvoice(invoiceLink, (status: string) => {
          if (status === 'paid') {
            hapticFeedback('success');
            onSuccess?.();
            onClose();
          } else if (status === 'failed') {
            setError('Оплата не прошла');
            hapticFeedback('error');
          }
          setIsProcessing(false);
        });
      } else {
        // Fallback: показываем информацию об оплате
        // В продакшене здесь будет редирект на ЮКасса
        const message = `Оплата тарифа "${plan.name}"\n\nСумма: ${plan.price}₽/месяц\n\nИнтеграция с ЮКасса будет доступна после настройки платёжной системы.`;
        
        if (window.Telegram?.WebApp?.showAlert) {
          window.Telegram.WebApp.showAlert(message);
        } else {
          alert(message);
        }
        setIsProcessing(false);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка оплаты');
      hapticFeedback('error');
      setIsProcessing(false);
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
        onClick={onClose}
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
          <div className="sticky top-0 bg-stone-900 p-4 border-b border-stone-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Оформить подписку</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-stone-800 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Plans */}
          <div className="p-4 space-y-4">
            {SUBSCRIPTION_PLANS.map((plan) => (
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
                {plan.popular && (
                  <div className="absolute -top-3 left-4 px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-400 text-stone-900 text-xs font-bold rounded-full">
                    ПОПУЛЯРНЫЙ
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-amber-400">{plan.price}₽</span>
                      <span className="text-stone-400">/{plan.period}</span>
                    </div>
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
            ))}
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
                  Обработка...
                </>
              ) : (
                <>
                  💳 Оплатить
                  {selectedPlan && (
                    <span>
                      {SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlan)?.price}₽
                    </span>
                  )}
                </>
              )}
            </button>
            
            <p className="text-xs text-stone-500 text-center mt-3">
              Безопасная оплата через ЮКасса. Отмена в любой момент.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================
// NeuroAgent — Legal Information & Pricing Page
// Updated tariffs with payment buttons
// ============================================

import { useState } from 'react';
import { motion } from 'framer-motion';
import { SecurityBadge } from '../components/ui/SecurityBadge';
import { PaymentModal } from '../components/ui/PaymentModal';
import { useAppStore } from '../stores';
import { hapticFeedback } from '../lib/telegram';

interface LegalPageProps {
  onBack?: () => void;
}

// План подписки
type PlanId = 'pro' | 'yearly';

export function LegalPage({ onBack }: LegalPageProps) {
  const user = useAppStore(state => state.user);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('pro');

  const handleSubscribe = (planId: PlanId) => {
    hapticFeedback('medium');
    setSelectedPlan(planId);
    setShowPayment(true);
  };

  // Проверяем тип подписки
  const isPaidSubscription = user?.subscriptionActive && user?.subscriptionPlan !== 'trial';
  const isTrialActive = user?.subscriptionActive && user?.subscriptionPlan === 'trial';
  const daysLeft = user?.subscriptionDaysLeft ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 to-stone-800 px-4 py-6 pb-24">
      {/* Header */}
      {onBack && (
        <header className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 transition-colors"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">Информация</h1>
        </header>
      )}

      {!onBack && (
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gradient-violet mb-2">NeuroAgent</h1>
          <p className="text-stone-400">Информация и тарифы</p>
        </header>
      )}

      <div className="space-y-6">
        {/* Security Badge */}
        <SecurityBadge />

        {/* Subscription Status */}
        {isPaidSubscription && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-stone-400">Ваша подписка</p>
                <p className="text-lg font-bold text-emerald-400">
                  {user?.subscriptionPlan === 'yearly' ? 'Годовой Pro' : 'Pro'} — активна
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{daysLeft}</p>
                <p className="text-xs text-stone-400">дней</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Trial Status */}
        {isTrialActive && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-stone-400">Пробный период</p>
                <p className="text-lg font-bold text-amber-400">🎁 Полный доступ бесплатно</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{daysLeft}</p>
                <p className="text-xs text-stone-400">дней осталось</p>
              </div>
            </div>
            <p className="text-xs text-amber-400/70 mt-2">
              💡 Оформите подписку сейчас, чтобы не потерять защиту!
            </p>
          </motion.div>
        )}

        {/* Тарифы */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-violet-400">💎</span>
            Тарифы
          </h2>

          {/* FREE TRIAL */}
          <div className="p-4 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-2xl border border-emerald-500/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-bl-xl">
              🎁 БЕСПЛАТНО
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-white text-lg">Пробный период</span>
              <span className="text-emerald-400 font-bold text-xl">3 дня</span>
            </div>
            <ul className="text-sm text-stone-300 space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span> Полный доступ ко всем функциям
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span> До 50 товаров
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span> Без привязки карты
              </li>
            </ul>
            <p className="text-xs text-emerald-400/70 mt-3">
              ✨ Активируется автоматически при первом входе
            </p>
          </div>

          {/* PRO - Основной тариф */}
          <motion.div
            className="p-4 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-2xl border-2 border-violet-500/50 relative overflow-hidden"
            whileHover={{ scale: 1.01 }}
          >
            <div className="absolute top-0 right-0 px-3 py-1 bg-violet-500 text-white text-xs font-bold rounded-bl-xl">
              ⭐ ПОПУЛЯРНЫЙ
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-white text-lg">Pro</span>
              <div className="text-right">
                <span className="text-violet-400 font-bold text-2xl">999 ₽</span>
                <span className="text-stone-400 text-sm">/мес</span>
              </div>
            </div>
            <ul className="text-sm text-stone-300 space-y-1.5 mb-4">
              <li className="flex items-center gap-2">
                <span className="text-violet-400">✓</span> До 500 товаров
              </li>
              <li className="flex items-center gap-2">
                <span className="text-violet-400">✓</span> Все режимы защиты (Zero Stock + Price
                Correction)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-violet-400">✓</span> AI-агент для управления
              </li>
              <li className="flex items-center gap-2">
                <span className="text-violet-400">✓</span> Telegram уведомления
              </li>
              <li className="flex items-center gap-2">
                <span className="text-violet-400">✓</span> Приоритетная поддержка
              </li>
            </ul>

            {!isPaidSubscription ? (
              <button
                onClick={() => handleSubscribe('pro')}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-lg hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
              >
                {isTrialActive ? 'Оплатить 999 ₽/мес' : 'Оформить подписку'}
              </button>
            ) : (
              <div className="w-full py-3 px-4 rounded-xl bg-stone-800 text-center text-stone-400 font-medium">
                ✓ Подписка активна
              </div>
            )}
          </motion.div>

          {/* Yearly - со скидкой */}
          <motion.div
            className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl border border-amber-500/30 relative overflow-hidden"
            whileHover={{ scale: 1.01 }}
          >
            <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-bl-xl">
              💰 ВЫГОДНО
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-white text-lg">Годовой Pro</span>
              <div className="text-right">
                <span className="text-stone-500 line-through text-sm">11 988 ₽</span>
                <div>
                  <span className="text-amber-400 font-bold text-2xl">9 990 ₽</span>
                  <span className="text-stone-400 text-sm">/год</span>
                </div>
              </div>
            </div>
            <ul className="text-sm text-stone-300 space-y-1.5 mb-4">
              <li className="flex items-center gap-2">
                <span className="text-amber-400">✓</span> Все из Pro
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-400">✓</span> Экономия 2 000 ₽
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-400">✓</span> 2 месяца бесплатно
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-400">✓</span> Персональный менеджер
              </li>
            </ul>

            {!isPaidSubscription || user?.subscriptionPlan !== 'yearly' ? (
              <button
                onClick={() => handleSubscribe('yearly')}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
              >
                Оформить на год
              </button>
            ) : (
              <button
                onClick={() => handleSubscribe('yearly')}
                className="w-full py-3 px-4 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-400 font-medium hover:bg-amber-500/30 transition-all"
              >
                Продлить на год со скидкой
              </button>
            )}
          </motion.div>
        </motion.section>

        {/* Реквизиты */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-6"
        >
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-violet-400">📋</span>
            Реквизиты
          </h2>

          <div className="space-y-3 text-stone-300">
            <div className="flex justify-between items-start">
              <span className="text-stone-400">Исполнитель:</span>
              <span className="text-right font-medium">ИП Дмитричев Александр Геннадьевич</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-stone-400">ИНН:</span>
              <span className="text-right font-mono">520500573503</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-stone-400">Регион:</span>
              <span className="text-right">Нижегородская область</span>
            </div>
          </div>
        </motion.section>

        {/* Контакты */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-panel p-6"
        >
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-violet-400">📞</span>
            Поддержка
          </h2>

          <div className="space-y-3 text-stone-300">
            <div className="flex justify-between items-start">
              <span className="text-stone-400">Телефон:</span>
              <a href="tel:+79040476383" className="text-violet-400 hover:text-violet-300">
                +7 (904) 047-63-83
              </a>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-stone-400">Email:</span>
              <a
                href="mailto:support@neuroguardian.app"
                className="text-violet-400 hover:text-violet-300"
              >
                support@neuroguardian.app
              </a>
            </div>
          </div>

          {/* Telegram Support Button */}
          <a
            href="https://t.me/Vyacheslav_Neuro"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-3 w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl text-white font-medium transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
            </svg>
            Написать в Telegram
          </a>
        </motion.section>

        {/* Способы оплаты */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-6"
        >
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-violet-400">💳</span>
            Способы оплаты
          </h2>

          <p className="text-stone-300 mb-4 text-sm">Оплата через платёжную систему ЮKassa:</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 bg-stone-800/50 rounded-xl">
              <span>💳</span>
              <span className="text-sm text-stone-300">Карта</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-stone-800/50 rounded-xl">
              <span>📱</span>
              <span className="text-sm text-stone-300">СБП</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-stone-800/50 rounded-xl">
              <span>🅿️</span>
              <span className="text-sm text-stone-300">ЮMoney</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-stone-800/50 rounded-xl">
              <span>🏦</span>
              <span className="text-sm text-stone-300">SberPay</span>
            </div>
          </div>

          <p className="text-xs text-stone-500 mt-4">
            Данные карты передаются напрямую в ЮKassa и не хранятся на нашем сервере.
          </p>
        </motion.section>

        {/* Оферта (сворачиваемая) */}
        <motion.details
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-panel"
        >
          <summary className="p-6 cursor-pointer text-lg font-bold text-white flex items-center gap-2">
            <span className="text-violet-400">📄</span>
            Договор оферты
          </summary>
          <div className="px-6 pb-6">
            <div className="text-sm text-stone-300 space-y-3 max-h-64 overflow-y-auto pr-2">
              <p className="font-medium text-white">ПУБЛИЧНАЯ ОФЕРТА</p>
              <p>
                Настоящий документ является официальным предложением (публичной офертой) Исполнителя
                — ИП Дмитричева Александра Геннадьевича (ИНН: 520500573503) заключить договор на
                оказание услуг.
              </p>
              <p className="font-medium text-white mt-3">1. ПРЕДМЕТ ДОГОВОРА</p>
              <p>
                1.1. Исполнитель предоставляет доступ к сервису NeuroAgent для автоматического
                мониторинга и защиты цен товаров на маркетплейсах WB и Ozon.
              </p>
              <p className="font-medium text-white mt-3">2. СТОИМОСТЬ УСЛУГ</p>
              <p>2.1. Пробный период: 3 дня бесплатно.</p>
              <p>2.2. Pro: 999 ₽/месяц</p>
              <p>2.3. Годовой Pro: 9 990 ₽/год</p>
              <p>2.4. Оплата через ЮKassa, 100% предоплата.</p>
              <p className="font-medium text-white mt-3">3. ВОЗВРАТ</p>
              <p>
                3.1. Возврат возможен в течение 3 дней после оплаты при неиспользовании сервиса. Для
                возврата: support@neuroguardian.app
              </p>
            </div>
          </div>
        </motion.details>

        {/* Политика конфиденциальности (сворачиваемая) */}
        <motion.details
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-panel"
        >
          <summary className="p-6 cursor-pointer text-lg font-bold text-white flex items-center gap-2">
            <span className="text-violet-400">🔒</span>
            Политика конфиденциальности
          </summary>
          <div className="px-6 pb-6">
            <div className="text-sm text-stone-300 space-y-3 max-h-64 overflow-y-auto pr-2">
              <p>Мы собираем: Telegram ID, API ключи (шифруются AES-256-GCM), данные о товарах.</p>
              <p>Данные используются для: предоставления сервиса, мониторинга цен, уведомлений.</p>
              <p>Все данные передаются по HTTPS. API ключи не передаются третьим лицам.</p>
              <p>Вы можете запросить удаление данных через support@neuroguardian.app</p>
            </div>
          </div>
        </motion.details>

        {/* Footer */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-center text-stone-500 text-sm py-4"
        >
          <p>NeuroAgent v2.4.0</p>
          <p>© 2024 ИП Дмитричев А.Г.</p>
        </motion.section>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        selectedPlan={selectedPlan}
      />
    </div>
  );
}

// ============================================
// NeuroAgent — Legal Information & Pricing Page
// Clean & Compliant Design
// ============================================

import { useState } from 'react';
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
    <div className="min-h-screen bg-stone-900 px-4 py-6 pb-24 text-stone-200">
      {/* Header */}
      {onBack ? (
        <header className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors text-stone-400 hover:text-white"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-white">Тарифы и условия</h1>
        </header>
      ) : (
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Информация</h1>
          <p className="text-stone-500 text-sm">Управление подпиской и документы</p>
        </header>
      )}

      <div className="space-y-6">
        {/* Status Cards */}
        {isPaidSubscription && (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-1">
                Активная подписка
              </p>
              <p className="text-lg font-bold text-white">
                {user?.subscriptionPlan === 'yearly' ? 'Годовой PRO' : 'PRO'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-white">{daysLeft}</span>
              <span className="text-sm text-stone-400 block">дней осталось</span>
            </div>
          </div>
        )}

        {isTrialActive && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-stone-900 uppercase">
                Trial
              </span>
              <span className="text-sm text-amber-500 font-medium">Тестовый период</span>
            </div>
            <p className="text-stone-300 text-sm mb-3">
              Вам доступны все функции PRO бесплатно еще <b>{daysLeft} дня</b>.
            </p>
            <button
              onClick={() => handleSubscribe('pro')}
              className="text-sm font-semibold text-amber-400 hover:text-white transition-colors"
            >
              Продлить защиту →
            </button>
          </div>
        )}

        {/* Tariffs Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white mb-4">Выберите план</h2>

          {/* PRO Card */}
          <div className="relative group rounded-2xl bg-stone-800 border-2 border-transparent hover:border-violet-500/50 transition-all p-5 shadow-lg">
            <div className="flex justify-between items-baseline mb-4">
              <h3 className="text-xl font-bold text-white">Pro Monthly</h3>
              <div className="text-right">
                <span className="text-2xl font-bold text-violet-400">999 ₽</span>
                <span className="text-stone-500 text-sm">/месяц</span>
              </div>
            </div>

            <ul className="space-y-2 mb-6">
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-violet-500">✓</span> Полная защита маржи (Stop-Loss)
              </li>
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-violet-500">✓</span> AI Агент 24/7
              </li>
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-violet-500">✓</span> Управление до 500 товаров
              </li>
            </ul>

            <button
              onClick={() => handleSubscribe('pro')}
              className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-500 transition-colors shadow-lg shadow-violet-600/20"
            >
              Выбрать тариф
            </button>
          </div>

          {/* YEARLY Card */}
          <div className="relative rounded-2xl bg-gradient-to-br from-stone-800 to-stone-800 border-2 border-amber-500/30 p-5 shadow-lg">
            <div className="absolute top-0 right-0 bg-amber-500 text-stone-900 text-xs font-bold px-3 py-1 rounded-bl-xl">
              ВЫГОДА 20%
            </div>

            <div className="flex justify-between items-baseline mb-4">
              <h3 className="text-xl font-bold text-white">Pro Yearly</h3>
              <div className="text-right">
                <span className="text-sm text-stone-500 line-through mr-2">11 988 ₽</span>
                <span className="text-2xl font-bold text-amber-500">9 990 ₽</span>
                <span className="text-stone-500 text-sm block">/год</span>
              </div>
            </div>

            <ul className="space-y-2 mb-6">
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-amber-500">✓</span> Все функции Pro
              </li>
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-amber-500">✓</span> <b>2 месяца</b> в подарок
              </li>
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-amber-500">✓</span> Приоритетная поддержка
              </li>
            </ul>

            <button
              onClick={() => handleSubscribe('yearly')}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-stone-900 font-bold hover:from-amber-400 hover:to-amber-500 transition-colors shadow-lg shadow-amber-500/20"
            >
              Оформить на год
            </button>
          </div>
        </section>

        {/* Info & Legal Section (Optimized for Compliance) */}
        <section className="space-y-4 pt-4 border-t border-stone-800">
          {/* Contacts */}
          <div className="bg-stone-800/50 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-3">Служба поддержки</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">Telegram</span>
                <a
                  href="https://t.me/Vyacheslav_Neuro"
                  target="_blank"
                  className="text-violet-400 hover:underline"
                >
                  @Vyacheslav_Neuro
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Email</span>
                <a
                  href="mailto:support@neuroguardian.app"
                  className="text-violet-400 hover:underline"
                >
                  support@neuroguardian.app
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Время работы</span>
                <span className="text-stone-300">Пн-Вс, 10:00 - 20:00 МСК</span>
              </div>
            </div>
          </div>

          {/* Legal Details */}
          <details className="group bg-stone-800/30 rounded-xl">
            <summary className="p-4 cursor-pointer font-medium text-stone-400 group-open:text-white transition-colors flex justify-between items-center">
              Юридическая информация
              <svg
                className="w-4 h-4 transform group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </summary>
            <div className="px-4 pb-4 text-xs text-stone-500 space-y-2">
              <p>ИП Дмитричев Александр Геннадьевич</p>
              <p>ИНН 520500573503</p>
              <p>Адрес: 603093, Россия, Нижегородская обл., г. Бор, ул. Максима Горького</p>
            </div>
          </details>

          {/* Offer & Policies */}
          <details className="group bg-stone-800/30 rounded-xl">
            <summary className="p-4 cursor-pointer font-medium text-stone-400 group-open:text-white transition-colors flex justify-between items-center">
              Условия использования
              <svg
                className="w-4 h-4 transform group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </summary>
            <div className="px-4 pb-4 text-xs text-stone-500 space-y-3">
              <div>
                <strong className="block text-stone-300 mb-1">Порядок предоставления услуг</strong>
                Услуга предоставляется в виде предоставления неисключительной лицензии на
                использование ПО NeuroAgent. Доступ к ПО предоставляется электронным способом сразу
                после успешной оплаты.
              </div>
              <div>
                <strong className="block text-stone-300 mb-1">Рекуррентные платежи</strong>
                Соглашаясь с офертой, вы даете согласие на автоматическое списание средств за
                продление подписки каждые 30 или 365 дней в зависимости от выбранного тарифа.
                Отменить подписку можно в любой момент через службу поддержки.
              </div>
              <div>
                <strong className="block text-stone-300 mb-1">Возврат</strong>
                Возврат средств возможен в случае технической неработоспособности сервиса по вине
                Исполнителя, если проблема не была устранена в течение 3 рабочих дней.
              </div>
              <div className="pt-2">
                <a href="#" className="underline hover:text-white mr-4">
                  Публичная оферта
                </a>
                <a href="#" className="underline hover:text-white">
                  Политика конфиденциальности
                </a>
              </div>
            </div>
          </details>
        </section>

        <SecurityBadge />

        <div className="text-center text-[10px] text-stone-600 pb-4">
          NeuroGuardian © 2024. All rights reserved.Secure Payment by YooKassa.
        </div>
      </div>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        selectedPlan={selectedPlan}
      />
    </div>
  );
}

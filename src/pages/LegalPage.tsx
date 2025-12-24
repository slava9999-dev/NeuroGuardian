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
type DocumentType = 'offer' | 'privacy' | null;

export function LegalPage({ onBack }: LegalPageProps) {
  const user = useAppStore(state => state.user);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('pro');
  const [activeDocument, setActiveDocument] = useState<DocumentType>(null);

  const handleSubscribe = (planId: PlanId) => {
    hapticFeedback('medium');
    setSelectedPlan(planId);
    setShowPayment(true);
  };

  const handleDocumentClick = (docType: DocumentType) => {
    hapticFeedback('light');
    setActiveDocument(docType);
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
                <span className="text-violet-500">✓</span> 🧠 AI-агент с голосовым управлением
              </li>
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-violet-500">✓</span> 🛡️ SENTINEL — защита от акций 24/7
              </li>
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-violet-500">✓</span> 📊 Продажи и выручка в реальном времени
              </li>
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-violet-500">✓</span> 🔍 Поиск и анализ конкурентов
              </li>
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-violet-500">✓</span> 📦 Синхронизация до 500 товаров
              </li>
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-violet-500">✓</span> 📈 ABC-анализ и прогноз стоков
              </li>
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-violet-500">✓</span> 🧮 Юнит-экономика WB/Ozon
              </li>
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-violet-500">✓</span> 🔐 Шифрование API-ключей (AES-256)
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
                <span className="text-amber-500">✓</span> ✅ Все функции Pro
              </li>
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-amber-500">✓</span> 💰 Экономия <b>2000₽</b>
              </li>
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-amber-500">✓</span> 🎁 <b>2 месяца</b> в подарок
              </li>
              <li className="flex gap-3 text-sm text-stone-300">
                <span className="text-amber-500">✓</span> 👑 Персональный менеджер
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

          {/* Offer & Policies - PROMINENT DISPLAY */}
          <div className="bg-stone-800 rounded-xl p-1 overflow-hidden">
            <div className="p-4 bg-stone-800/50 border-b border-stone-700">
              <h3 className="font-bold text-white flex items-center gap-2">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Документы
              </h3>
            </div>
            <div>
              <button
                onClick={() => handleDocumentClick('offer')}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b border-stone-700/50 group text-left"
              >
                <div>
                  <span className="block text-white font-medium">Публичная оферта</span>
                  <span className="text-xs text-stone-500">Читать полный текст договора</span>
                </div>
                <svg
                  className="w-5 h-5 text-stone-500 group-hover:text-white transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M9 18l6-6-6-6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                onClick={() => handleDocumentClick('privacy')}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group text-left"
              >
                <div>
                  <span className="block text-white font-medium">Политика конфиденциальности</span>
                  <span className="text-xs text-stone-500">Правила обработки данных</span>
                </div>
                <svg
                  className="w-5 h-5 text-stone-500 group-hover:text-white transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M9 18l6-6-6-6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="px-4 py-2 text-xs text-stone-500 space-y-3 bg-stone-900/50 rounded-xl border border-white/5">
            <p>
              <strong className="text-stone-300">Суть услуги:</strong> Предоставление
              неисключительной лицензии на использование ПО NeuroAgent. Доступ открывается
              автоматически после оплаты.
            </p>
            <p>
              <strong className="text-stone-300">Рекуррентные платежи:</strong> Оплата за продление
              подписки списывается автоматически согласно выбранному тарифу. Отмена возможна в любой
              момент.
            </p>
          </div>
        </section>

        <SecurityBadge />

        <div className="text-center text-[10px] text-stone-600 pb-4">
          NeuroGuardian © 2024. All rights reserved. Secure Payment by YooKassa.
        </div>
      </div>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        selectedPlan={selectedPlan}
      />

      {/* Document Modal */}
      {activeDocument && (
        <DocumentModal type={activeDocument} onClose={() => setActiveDocument(null)} />
      )}
    </div>
  );
}

// Document Modal Component
interface DocumentModalProps {
  type: 'offer' | 'privacy';
  onClose: () => void;
}

function DocumentModal({ type, onClose }: DocumentModalProps) {
  const title = type === 'offer' ? 'Публичная оферта' : 'Политика конфиденциальности';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-stone-900 rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-800">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-stone-400"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 text-sm text-stone-300 space-y-4">
          {type === 'offer' ? <OfferContent /> : <PrivacyContent />}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-800">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-500 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

// Offer Content
function OfferContent() {
  return (
    <>
      <h3 className="text-white font-bold text-base">ДОГОВОР ПУБЛИЧНОЙ ОФЕРТЫ</h3>
      <p className="text-stone-400 text-xs">Редакция от 01.12.2024</p>

      <div className="space-y-4">
        <section>
          <h4 className="font-semibold text-white mb-2">1. ОБЩИЕ ПОЛОЖЕНИЯ</h4>
          <p>
            1.1. Настоящий документ является официальным предложением (публичной офертой) ИП
            Дмитричев Александр Геннадьевич (ИНН 520500573503) заключить договор на предоставление
            права использования программного обеспечения NeuroAgent.
          </p>
          <p className="mt-2">
            1.2. Акцептом оферты является оплата выбранного тарифа. Моментом заключения договора
            считается момент зачисления денежных средств.
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-white mb-2">2. ПРЕДМЕТ ДОГОВОРА</h4>
          <p>
            2.1. Исполнитель предоставляет Заказчику неисключительную лицензию на использование
            программного обеспечения NeuroAgent для автоматизации управления товарами на
            маркетплейсах Wildberries и Ozon.
          </p>
          <p className="mt-2">
            2.2. Функциональные возможности включают: защиту маржи (Stop-Loss), AI-ассистент,
            аналитику продаж, управление ценами.
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-white mb-2">3. СТОИМОСТЬ И ПОРЯДОК ОПЛАТЫ</h4>
          <p>3.1. Стоимость подписки:</p>
          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
            <li>Pro Monthly — 999 ₽/месяц</li>
            <li>Pro Yearly — 9 990 ₽/год</li>
          </ul>
          <p className="mt-2">
            3.2. Оплата производится через платёжную систему YooKassa. Рекуррентные платежи
            списываются автоматически. Отмена подписки возможна в любой момент в личном кабинете.
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-white mb-2">4. ПРАВА И ОБЯЗАННОСТИ СТОРОН</h4>
          <p>
            4.1. Исполнитель обязуется: обеспечить доступ к сервису 24/7 (кроме плановых работ),
            сохранять конфиденциальность данных, оказывать техническую поддержку.
          </p>
          <p className="mt-2">
            4.2. Заказчик обязуется: не передавать доступ третьим лицам, не использовать сервис для
            нарушения правил маркетплейсов, своевременно оплачивать подписку.
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-white mb-2">5. ОТВЕТСТВЕННОСТЬ</h4>
          <p>
            5.1. Исполнитель не несёт ответственности за: решения, принятые на основе рекомендаций
            AI-ассистента; изменения в API маркетплейсов; блокировку аккаунтов Заказчика на
            маркетплейсах.
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-white mb-2">6. ВОЗВРАТ СРЕДСТВ</h4>
          <p>
            6.1. Возврат денежных средств не осуществляется после активации подписки, так как услуга
            оказывается путём предоставления доступа к ПО немедленно после оплаты.
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-white mb-2">7. РЕКВИЗИТЫ ИСПОЛНИТЕЛЯ</h4>
          <p>ИП Дмитричев Александр Геннадьевич</p>
          <p>ИНН: 520500573503</p>
          <p>Адрес: 603093, Россия, Нижегородская обл., г. Бор, ул. Максима Горького</p>
          <p>Email: support@neuroguardian.app</p>
        </section>
      </div>
    </>
  );
}

// Privacy Content
function PrivacyContent() {
  return (
    <>
      <h3 className="text-white font-bold text-base">ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ</h3>
      <p className="text-stone-400 text-xs">Редакция от 01.12.2024</p>

      <div className="space-y-4">
        <section>
          <h4 className="font-semibold text-white mb-2">1. ОБЩИЕ ПОЛОЖЕНИЯ</h4>
          <p>
            1.1. Настоящая Политика конфиденциальности устанавливает порядок обработки персональных
            данных пользователей сервиса NeuroAgent.
          </p>
          <p className="mt-2">
            1.2. Оператор персональных данных: ИП Дмитричев Александр Геннадьевич (ИНН
            520500573503).
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-white mb-2">2. СОБИРАЕМЫЕ ДАННЫЕ</h4>
          <p>2.1. Мы собираем следующие данные:</p>
          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
            <li>Идентификатор и имя пользователя Telegram</li>
            <li>API-ключи маркетплейсов (в зашифрованном виде)</li>
            <li>Данные о товарах и продажах (получаемые через API маркетплейсов)</li>
            <li>История взаимодействия с AI-ассистентом</li>
            <li>Данные об оплате (обрабатываются YooKassa)</li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold text-white mb-2">3. ЦЕЛИ ОБРАБОТКИ</h4>
          <p>3.1. Персональные данные обрабатываются для:</p>
          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
            <li>Предоставления доступа к сервису</li>
            <li>Работы функций защиты маржи и аналитики</li>
            <li>Обработки платежей</li>
            <li>Технической поддержки</li>
            <li>Улучшения качества сервиса</li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold text-white mb-2">4. ЗАЩИТА ДАННЫХ</h4>
          <p>4.1. API-ключи маркетплейсов шифруются алгоритмом AES-256-GCM.</p>
          <p className="mt-2">
            4.2. Данные хранятся на серверах Vercel (США, Европа) с сертификацией SOC 2.
          </p>
          <p className="mt-2">4.3. Доступ к базе данных ограничен и защищён.</p>
        </section>

        <section>
          <h4 className="font-semibold text-white mb-2">5. ПЕРЕДАЧА ТРЕТЬИМ ЛИЦАМ</h4>
          <p>5.1. Мы не продаём и не передаём персональные данные третьим лицам, за исключением:</p>
          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
            <li>Платёжной системы YooKassa (для обработки платежей)</li>
            <li>По требованию законодательства РФ</li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold text-white mb-2">6. ПРАВА ПОЛЬЗОВАТЕЛЯ</h4>
          <p>6.1. Вы имеете право:</p>
          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
            <li>Запросить информацию о своих данных</li>
            <li>Потребовать удаления данных</li>
            <li>Отозвать согласие на обработку</li>
          </ul>
          <p className="mt-2">
            6.2. Для реализации прав свяжитесь с нами: support@neuroguardian.app
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-white mb-2">7. ФАЙЛЫ COOKIE</h4>
          <p>
            7.1. Сервис использует технические cookies для авторизации через Telegram. Рекламные
            cookies не используются.
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-white mb-2">8. КОНТАКТЫ</h4>
          <p>По вопросам обработки персональных данных:</p>
          <p>Email: support@neuroguardian.app</p>
          <p>Telegram: @Vyacheslav_Neuro</p>
        </section>
      </div>
    </>
  );
}

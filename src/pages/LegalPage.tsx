// ============================================
// NeuroGUARDIAN — Info Page V7.0 (Warm Light)
// Pricing, Legal Documents, Support
// ============================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Crown,
  Check,
  MessageCircle,
  Mail,
  Clock,
  FileText,
  Shield,
  X,
  Sparkles,
  Zap,
} from 'lucide-react';
import { PaymentModal } from '../components/ui/PaymentModal';
import { useAppStore } from '../stores';
import { hapticFeedback } from '../lib/telegram';

interface LegalPageProps {
  onBack?: () => void;
}

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

  const isPaidSubscription = user?.subscriptionActive && user?.subscriptionPlan !== 'trial';
  const isTrialActive = user?.subscriptionActive && user?.subscriptionPlan === 'trial';
  const daysLeft = user?.subscriptionDaysLeft ?? 0;

  return (
    <div className="min-h-full bg-page px-5 py-6 pb-32" role="main">
      {/* Header */}
      <header className="flex items-center gap-4 mb-8">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-surface border border-surface-dim hover:border-primary transition-colors"
            aria-label="Назад"
          >
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-text-main">Тарифы и условия</h1>
          <p className="text-sm text-text-muted">Выберите подходящий план</p>
        </div>
      </header>

      {/* ============================================
          SUBSCRIPTION STATUS CARDS
          ============================================ */}
      {isPaidSubscription && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5 mb-6 bg-gradient-to-r from-success-soft to-surface border-success/20"
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-success text-white">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <span className="badge badge-success mb-1">Активна</span>
                <h3 className="font-bold text-text-main">
                  {user?.subscriptionPlan === 'yearly' ? 'Годовой PRO' : 'PRO'}
                </h3>
              </div>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-success">{daysLeft}</span>
              <p className="text-xs text-text-muted">дней осталось</p>
            </div>
          </div>
        </motion.div>
      )}

      {isTrialActive && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5 mb-6 bg-gradient-to-r from-warning-soft to-surface border-warning/20"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="badge badge-warning">Trial</span>
            <span className="text-sm font-medium text-warning">Тестовый период</span>
          </div>
          <p className="text-sm text-text-secondary mb-3">
            Все функции PRO доступны бесплатно ещё <strong>{daysLeft} дня</strong>.
          </p>
          <button
            onClick={() => handleSubscribe('pro')}
            className="text-sm font-semibold text-warning hover:text-warning/80 transition-colors"
          >
            Продлить защиту →
          </button>
        </motion.div>
      )}

      {/* ============================================
          PRICING CARDS
          ============================================ */}
      <section className="space-y-4 mb-10">
        <h2 className="section-title">💎 Выберите план</h2>

        {/* PRO Monthly */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="card p-5 border-2 border-transparent hover:border-primary/30 transition-all"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary-dim">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-text-main">Pro Monthly</h3>
                <p className="text-xs text-text-muted">Ежемесячная подписка</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-primary">999 ₽</span>
              <span className="text-sm text-text-muted">/мес</span>
            </div>
          </div>

          <ul className="space-y-2 mb-5">
            {[
              '🧠 AI-агент с голосовым управлением',
              '🛡️ Sentinel — защита цен 24/7',
              '📊 Продажи и выручка в реальном времени',
              '🔍 Анализ конкурентов',
              '📦 До 500 товаров',
              '📈 ABC-анализ и прогноз стоков',
              '🔐 Шифрование ключей (AES-256)',
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                <Check className="w-4 h-4 text-primary shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          <button onClick={() => handleSubscribe('pro')} className="w-full btn btn-primary py-3.5">
            Выбрать тариф
          </button>
        </motion.div>

        {/* PRO Yearly - Best Value */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="card p-5 border-2 border-secondary/30 bg-gradient-to-br from-secondary/5 to-surface relative overflow-hidden"
        >
          {/* Best Value Badge */}
          <div className="absolute top-0 right-0 bg-secondary text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
            ВЫГОДА 20%
          </div>

          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-secondary/10">
                <Sparkles className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-text-main">Pro Yearly</h3>
                <p className="text-xs text-text-muted">Годовая подписка</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm text-text-muted line-through">11 988 ₽</span>
              <div>
                <span className="text-2xl font-bold text-secondary">9 990 ₽</span>
                <span className="text-sm text-text-muted">/год</span>
              </div>
            </div>
          </div>

          <ul className="space-y-2 mb-5">
            {[
              '✅ Все функции Pro',
              '💰 Экономия 2000₽',
              '🎁 2 месяца в подарок',
              '👑 Персональный менеджер',
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                <Check className="w-4 h-4 text-secondary shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          <button
            onClick={() => handleSubscribe('yearly')}
            className="w-full btn py-3.5 bg-secondary hover:bg-secondary-hover text-white font-semibold"
          >
            Оформить на год
          </button>
        </motion.div>
      </section>

      {/* ============================================
          SUPPORT SECTION
          ============================================ */}
      <section className="mb-8">
        <h2 className="section-title">📞 Поддержка</h2>
        <div className="card p-4 space-y-3">
          <a
            href="https://t.me/Vyacheslav_Neuro"
            target="_blank"
            className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-warm transition-colors"
          >
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-info" />
              <span className="text-sm font-medium text-text-main">Telegram</span>
            </div>
            <span className="text-sm text-primary">@Vyacheslav_Neuro</span>
          </a>
          <a
            href="mailto:support@neuroguardian.app"
            className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-warm transition-colors"
          >
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-info" />
              <span className="text-sm font-medium text-text-main">Email</span>
            </div>
            <span className="text-sm text-primary">support@neuroguardian.app</span>
          </a>
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-text-muted" />
              <span className="text-sm font-medium text-text-main">Время работы</span>
            </div>
            <span className="text-sm text-text-secondary">Пн-Вс, 10:00-20:00</span>
          </div>
        </div>
      </section>

      {/* ============================================
          LEGAL DOCUMENTS
          ============================================ */}
      <section className="mb-8">
        <h2 className="section-title">📄 Документы</h2>
        <div className="card overflow-hidden">
          <button
            onClick={() => {
              hapticFeedback('light');
              setActiveDocument('offer');
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-surface-warm transition-colors border-b border-surface-dim"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-text-muted" />
              <div className="text-left">
                <span className="font-medium text-text-main block">Публичная оферта</span>
                <span className="text-xs text-text-muted">Договор-оферта на услуги</span>
              </div>
            </div>
            <ArrowLeft className="w-4 h-4 text-text-muted rotate-180" />
          </button>
          <button
            onClick={() => {
              hapticFeedback('light');
              setActiveDocument('privacy');
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-surface-warm transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-text-muted" />
              <div className="text-left">
                <span className="font-medium text-text-main block">
                  Политика конфиденциальности
                </span>
                <span className="text-xs text-text-muted">Обработка персональных данных</span>
              </div>
            </div>
            <ArrowLeft className="w-4 h-4 text-text-muted rotate-180" />
          </button>
        </div>
      </section>

      {/* Legal Info */}
      <section className="mb-8">
        <details className="card overflow-hidden group">
          <summary className="p-4 cursor-pointer font-medium text-text-secondary hover:text-text-main transition-colors flex justify-between items-center">
            Юридическая информация
            <ArrowLeft className="w-4 h-4 transform rotate-[-90deg] group-open:rotate-90 transition-transform" />
          </summary>
          <div className="px-4 pb-4 text-xs text-text-muted space-y-1 border-t border-surface-dim pt-3">
            <p>ИП Дмитричев Александр Геннадьевич</p>
            <p>ИНН 520500573503</p>
            <p>603093, Россия, Нижегородская обл., г. Бор</p>
          </div>
        </details>
      </section>

      {/* Service Info */}
      <div className="card-warm p-4 text-xs text-text-muted space-y-2 mb-6">
        <p>
          <strong className="text-text-secondary">Суть услуги:</strong> Предоставление
          неисключительной лицензии на использование ПО NeuroAgent. Доступ открывается автоматически
          после оплаты.
        </p>
        <p>
          <strong className="text-text-secondary">Рекуррентные платежи:</strong> Оплата за продление
          списывается автоматически. Отмена возможна в любой момент.
        </p>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-text-muted pb-4">
        NeuroGuardian © 2024-2026. Secure Payment by YooKassa.
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        selectedPlan={selectedPlan}
      />

      {/* Document Modal */}
      <AnimatePresence>
        {activeDocument && (
          <DocumentModal type={activeDocument} onClose={() => setActiveDocument(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// DOCUMENT MODAL
// ============================================
interface DocumentModalProps {
  type: 'offer' | 'privacy';
  onClose: () => void;
}

function DocumentModal({ type, onClose }: DocumentModalProps) {
  const title = type === 'offer' ? 'Публичная оферта' : 'Политика конфиденциальности';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-dim">
          <h2 className="text-lg font-bold text-text-main">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-hl transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 text-sm text-text-secondary space-y-4">
          {type === 'offer' ? <OfferContent /> : <PrivacyContent />}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-dim">
          <button onClick={onClose} className="w-full btn btn-primary py-3">
            Закрыть
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// DOCUMENT CONTENTS
// ============================================
function OfferContent() {
  return (
    <>
      <h3 className="text-text-main font-bold text-base">ДОГОВОР ПУБЛИЧНОЙ ОФЕРТЫ</h3>
      <p className="text-text-muted text-xs">Редакция от 01.12.2024</p>

      <div className="space-y-4">
        <section>
          <h4 className="font-semibold text-text-main mb-2">1. ОБЩИЕ ПОЛОЖЕНИЯ</h4>
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
          <h4 className="font-semibold text-text-main mb-2">2. ПРЕДМЕТ ДОГОВОРА</h4>
          <p>
            2.1. Исполнитель предоставляет Заказчику неисключительную лицензию на использование
            программного обеспечения NeuroAgent для автоматизации управления товарами на
            маркетплейсах Wildberries и Ozon.
          </p>
          <p className="mt-2">
            2.2. Функциональные возможности включают: Sentinel (защита маржи), AI-ассистент,
            аналитику продаж, управление ценами.
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-text-main mb-2">3. СТОИМОСТЬ И ПОРЯДОК ОПЛАТЫ</h4>
          <p>3.1. Стоимость подписки:</p>
          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
            <li>Pro Monthly — 999 ₽/месяц</li>
            <li>Pro Yearly — 9 990 ₽/год</li>
          </ul>
          <p className="mt-2">
            3.2. Оплата производится через платёжную систему YooKassa. Рекуррентные платежи
            списываются автоматически. Отмена подписки возможна в любой момент.
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-text-main mb-2">4. ПРАВА И ОБЯЗАННОСТИ</h4>
          <p>
            4.1. Исполнитель обязуется: обеспечить доступ к сервису 24/7 (кроме плановых работ),
            сохранять конфиденциальность данных, оказывать техническую поддержку.
          </p>
          <p className="mt-2">
            4.2. Заказчик обязуется: не передавать доступ третьим лицам, не использовать сервис для
            нарушения правил маркетплейсов.
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-text-main mb-2">5. РЕКВИЗИТЫ</h4>
          <p>ИП Дмитричев Александр Геннадьевич</p>
          <p>ИНН: 520500573503</p>
          <p>Email: support@neuroguardian.app</p>
        </section>
      </div>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <h3 className="text-text-main font-bold text-base">ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ</h3>
      <p className="text-text-muted text-xs">Редакция от 01.12.2024</p>

      <div className="space-y-4">
        <section>
          <h4 className="font-semibold text-text-main mb-2">1. ОБЩИЕ ПОЛОЖЕНИЯ</h4>
          <p>
            1.1. Настоящая Политика устанавливает порядок обработки персональных данных
            пользователей сервиса NeuroAgent.
          </p>
          <p className="mt-2">
            1.2. Оператор: ИП Дмитричев Александр Геннадьевич (ИНН 520500573503).
          </p>
        </section>

        <section>
          <h4 className="font-semibold text-text-main mb-2">2. СОБИРАЕМЫЕ ДАННЫЕ</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>Идентификатор и имя пользователя Telegram</li>
            <li>API-ключи маркетплейсов (зашифрованы)</li>
            <li>Данные о товарах через API маркетплейсов</li>
            <li>История взаимодействия с AI-ассистентом</li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold text-text-main mb-2">3. ЗАЩИТА ДАННЫХ</h4>
          <p>3.1. API-ключи шифруются алгоритмом AES-256-GCM.</p>
          <p className="mt-2">3.2. Данные хранятся на серверах с сертификацией SOC 2.</p>
        </section>

        <section>
          <h4 className="font-semibold text-text-main mb-2">4. ВАШИ ПРАВА</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>Запросить информацию о своих данных</li>
            <li>Потребовать удаления данных</li>
            <li>Отозвать согласие на обработку</li>
          </ul>
          <p className="mt-2">Контакт: support@neuroguardian.app</p>
        </section>
      </div>
    </>
  );
}

export default LegalPage;

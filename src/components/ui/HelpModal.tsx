// ============================================
// NeuroGUARDIAN — Help Modal Component
// Step-by-step tutorial for new users
// ============================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hapticFeedback } from '../../lib/telegram';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TUTORIAL_STEPS = [
  {
    id: 1,
    title: '🤖 Знакомьтесь — NeuroAgent!',
    content: 'Ваш личный AI-помощник для управления магазином на Wildberries и Ozon.',
    tip: 'Общайтесь через чат, защищайте маржу автоматически и управляйте ценами голосом!',
  },
  {
    id: 2,
    title: '🔑 Получите API ключ WB',
    content: 'Для подключения Wildberries:',
    steps: [
      '1. Откройте seller.wildberries.ru',
      '2. Профиль → Настройки → Доступ к API',
      '3. Создайте новый токен',
      '4. Выберите права: "Контент", "Цены", "Склад"',
      '5. Скопируйте ключ (он показывается только 1 раз!)',
    ],
    tip: '⚠️ Храните ключ в надёжном месте — его нельзя восстановить',
  },
  {
    id: 3,
    title: '🔑 Получите API ключ Ozon',
    content: 'Для подключения Ozon:',
    steps: [
      '1. Откройте seller.ozon.ru',
      '2. Настройки → API ключи',
      '3. Создайте новый ключ',
      '4. Скопируйте API-ключ и Client ID',
    ],
    tip: '📌 Для Ozon нужны ОБА значения: API-ключ и Client ID',
  },
  {
    id: 4,
    title: '📱 Подключите маркетплейс',
    content: 'В приложении нажмите "Подключить" и:',
    steps: [
      '1. Выберите маркетплейс (WB или Ozon)',
      '2. Вставьте API ключ',
      '3. Для Ozon также введите Client ID',
      '4. Нажмите "Подключить"',
    ],
    tip: '✅ Ключ шифруется и хранится в защищённом хранилище',
  },
  {
    id: 5,
    title: '💰 Включите Sentinel',
    content: 'Установите минимальную цену для каждого товара:',
    steps: [
      '1. Найдите товар в списке',
      '2. Нажмите на поле "Защита"',
      '3. Введите комфортную минимальную цену',
      '4. Sentinel будет защищать её 24/7',
    ],
    tip: '💡 Рекомендуем: себестоимость + минимальная маржа',
  },
  {
    id: 6,
    title: '🛡️ Активируйте защиту',
    content: 'Когда всё настроено:',
    steps: [
      '1. Нажмите большую кнопку "ARMED"',
      '2. Система начнёт мониторинг 24/7',
      '3. При падении цены ниже минимума — сработает защита',
    ],
    tip: '🚨 При срабатывании вы получите уведомление в Telegram!',
  },
];

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const step = TUTORIAL_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    hapticFeedback('light');
    if (isLast) {
      onClose();
      setCurrentStep(0);
    } else {
      setCurrentStep(p => p + 1);
    }
  };

  const handlePrev = () => {
    hapticFeedback('light');
    if (!isFirst) {
      setCurrentStep(p => p - 1);
    }
  };

  const handleClose = () => {
    hapticFeedback('light');
    onClose();
    setCurrentStep(0);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-md bg-stone-900 rounded-2xl border border-stone-700 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-stone-700">
            <div className="flex items-center gap-2">
              <span className="text-amber-500">📚</span>
              <span className="text-sm text-stone-400">
                Шаг {currentStep + 1} из {TUTORIAL_STEPS.length}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="p-1 rounded-lg hover:bg-stone-800 transition-colors"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-stone-800">
            <motion.div
              className="h-full bg-linear-to-r from-amber-500 to-amber-400"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="text-xl font-bold text-white mb-4">{step.title}</h3>

                <p className="text-stone-300 mb-4">{step.content}</p>

                {step.steps && (
                  <ul className="space-y-2 mb-4">
                    {step.steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-stone-300">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {step.tip && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <p className="text-sm text-amber-400">{step.tip}</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-stone-700">
            <button
              onClick={handlePrev}
              disabled={isFirst}
              className={`
                px-4 py-2 rounded-xl font-medium transition-all
                ${
                  isFirst
                    ? 'text-stone-600 cursor-not-allowed'
                    : 'text-stone-300 hover:bg-stone-800'
                }
              `}
            >
              ← Назад
            </button>

            <div className="flex gap-1.5">
              {TUTORIAL_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={`
                    w-2 h-2 rounded-full transition-all
                    ${i === currentStep ? 'bg-amber-500 w-4' : 'bg-stone-600'}
                  `}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="px-4 py-2 rounded-xl font-medium bg-amber-500 text-stone-900 hover:bg-amber-400 transition-colors"
            >
              {isLast ? 'Готово ✓' : 'Далее →'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

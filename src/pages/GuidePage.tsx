// ============================================
// NeuroGUARDIAN — Quick Start Guide Page
// In-app tutorial for users
// ============================================

import { useState } from 'react';
import { motion } from 'framer-motion';
import { hapticFeedback } from '../lib/telegram';

interface GuidePageProps {
  onBack: () => void;
}

const GUIDE_SECTIONS = [
  {
    id: 'start',
    icon: '🚀',
    title: 'Быстрый старт',
    content: [
      {
        step: 1,
        title: 'Подключите маркетплейс',
        text: 'Нажмите "Подключить" и введите API ключ вашего магазина.',
      },
      {
        step: 2,
        title: 'Включите Сторожа цены',
        text: 'Установите минимальную цену, которую Сторож будет защищать 24/7.',
      },
      {
        step: 3,
        title: 'Активируйте защиту',
        text: 'Нажмите большую кнопку "ARMED" — система начнёт мониторинг 24/7.',
      },
    ],
  },
  {
    id: 'ozon',
    icon: '🟦',
    title: 'Ozon API',
    content: [
      {
        step: 1,
        title: 'Откройте seller.ozon.ru',
        text: 'Войдите в личный кабинет продавца.',
        link: 'https://seller.ozon.ru',
      },
      {
        step: 2,
        title: 'Перейдите в API ключи',
        text: 'Настройки → API ключи → Создать ключ',
      },
      {
        step: 3,
        title: 'Скопируйте данные',
        text: 'Вам нужны ОБА значения: Client ID (число) и API-ключ (длинная строка).',
      },
      {
        step: 4,
        title: 'Вставьте в приложение',
        text: 'Нажмите "Подключить" → Ozon → Введите Client ID и API-ключ.',
      },
    ],
  },
  {
    id: 'wb',
    icon: '🟪',
    title: 'Wildberries API',
    content: [
      {
        step: 1,
        title: 'Откройте seller.wildberries.ru',
        text: 'Войдите в личный кабинет продавца.',
        link: 'https://seller.wildberries.ru',
      },
      {
        step: 2,
        title: 'Создайте токен',
        text: 'Профиль → Настройки → Доступ к API → Создать новый токен',
      },
      {
        step: 3,
        title: 'Выберите права',
        text: 'Обязательно включите: Контент, Цены, Склад.',
      },
      {
        step: 4,
        title: 'Сохраните токен!',
        text: '⚠️ Токен показывается только 1 раз! Сразу скопируйте его.',
        warning: true,
      },
    ],
  },
  {
    id: 'protection',
    icon: '🛡️',
    title: 'Как работает защита',
    content: [
      {
        step: 1,
        title: 'Мониторинг 24/7',
        text: 'Система проверяет цены каждые 1-2 минуты.',
      },
      {
        step: 2,
        title: 'Обнаружение снижения',
        text: 'Если маркетплейс снизил цену ниже вашего минимума — срабатывает защита.',
      },
      {
        step: 3,
        title: 'Режим "Обнуление стока"',
        text: 'Товар мгновенно снимается с продажи (сток = 0).',
      },
      {
        step: 4,
        title: 'Режим "Коррекция цены"',
        text: 'Цена автоматически возвращается к минимальной.',
      },
      {
        step: 5,
        title: 'Уведомление',
        text: 'Вы получите push в Telegram о сработавшей защите.',
      },
    ],
  },
  {
    id: 'faq',
    icon: '❓',
    title: 'Частые вопросы',
    content: [
      {
        step: 1,
        title: 'Безопасно ли давать API ключ?',
        text: 'Да! Ключ шифруется и хранится в защищённом хранилище Google Cloud. Мы НЕ можем делать покупки или снимать деньги.',
      },
      {
        step: 2,
        title: 'Что если защита сработала по ошибке?',
        text: 'Вы можете в любой момент восстановить сток вручную на маркетплейсе.',
      },
      {
        step: 3,
        title: 'Работает с несколькими магазинами?',
        text: 'Да! Подключите оба маркетплейса — WB и Ozon.',
      },
      {
        step: 4,
        title: 'Как отменить подписку?',
        text: 'В настройках или напишите в поддержку @neuroguardian_support.',
      },
    ],
  },
];

export function GuidePage({ onBack }: GuidePageProps) {
  const [activeSection, setActiveSection] = useState('start');

  const section = GUIDE_SECTIONS.find(s => s.id === activeSection);

  return (
    <div className="min-h-screen bg-linear-to-b from-stone-900 to-stone-800">
      {/* Header */}
      <header className="sticky top-0 bg-stone-900/95 backdrop-blur-sm border-b border-stone-700 px-4 py-3 flex items-center gap-4 z-10">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 transition-colors"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-white">Инструкция</h1>
      </header>

      {/* Section tabs */}
      <div className="px-4 py-3 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {GUIDE_SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => {
                hapticFeedback('light');
                setActiveSection(s.id);
              }}
              className={`
                px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                ${
                  activeSection === s.id
                    ? 'bg-amber-500 text-stone-900'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }
              `}
            >
              {s.icon} {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {section && (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-3xl">{section.icon}</span>
              {section.title}
            </h2>

            <div className="space-y-4">
              {section.content.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`
                    p-4 rounded-xl border
                    ${
                      item.warning
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-stone-800/50 border-stone-700'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold
                        ${item.warning ? 'bg-amber-500 text-stone-900' : 'bg-stone-700 text-white'}
                      `}
                    >
                      {item.step}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                      <p
                        className={`text-sm ${item.warning ? 'text-amber-400' : 'text-stone-400'}`}
                      >
                        {item.text}
                      </p>
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-sm text-amber-400 hover:text-amber-300"
                          onClick={() => hapticFeedback('light')}
                        >
                          Открыть сайт
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Support footer */}
      <div className="px-4 py-6 border-t border-stone-800">
        <div className="glass-panel p-4 text-center">
          <p className="text-stone-400 mb-3">Остались вопросы?</p>
          <a
            href="https://t.me/neuroguardian_support"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-stone-800 hover:bg-stone-700 rounded-xl text-white font-medium transition-colors"
            onClick={() => hapticFeedback('light')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
            </svg>
            Написать в поддержку
          </a>
        </div>
      </div>
    </div>
  );
}

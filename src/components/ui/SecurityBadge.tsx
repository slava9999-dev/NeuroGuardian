// ============================================
// NeuroGUARDIAN — Security Badge Component
// Displays security information for users
// ============================================

import { motion } from 'framer-motion';
import { useState } from 'react';

export function SecurityBadge({ compact = false }: { compact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-emerald-400"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <span className="text-xs text-emerald-400 font-medium">SSL защита</span>
      </motion.div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-6 border-emerald-500/30 bg-emerald-500/5"
    >
      <div className="flex items-start gap-4">
        {/* Shield Icon */}
        <div className="shrink-0 w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-emerald-400"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            🔒 Ваши данные защищены
          </h3>

          <div className="space-y-3">
            {/* Security features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-emerald-400">✓</span>
                <span className="text-stone-300">SSL/TLS шифрование</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-emerald-400">✓</span>
                <span className="text-stone-300">Vercel Edge Network</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-emerald-400">✓</span>
                <span className="text-stone-300">PostgreSQL в изоляции</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-emerald-400">✓</span>
                <span className="text-stone-300">Telegram авторизация</span>
              </div>
            </div>

            {/* Collapsible details */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              <span>{isExpanded ? 'Скрыть детали' : 'Как мы храним ваши данные?'}</span>
              <motion.svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                animate={{ rotate: isExpanded ? 180 : 0 }}
              >
                <path d="m6 9 6 6 6-6" />
              </motion.svg>
            </button>

            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 pt-3 border-t border-stone-700 space-y-4 text-sm text-stone-400"
              >
                {/* API Keys */}
                <div>
                  <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                    <span>🔑</span> API ключи WB и Ozon
                  </h4>
                  <ul className="space-y-1 pl-6">
                    <li>• Шифруются алгоритмом AES-256-GCM (банковский стандарт)</li>
                    <li>• Хранятся в защищённой PostgreSQL базе данных</li>
                    <li>• Передаются только по HTTPS (TLS 1.3)</li>
                    <li>• Используются исключительно для работы с вашими товарами</li>
                    <li>• Никогда не передаются третьим лицам</li>
                  </ul>
                </div>

                {/* User Data */}
                <div>
                  <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                    <span>👤</span> Данные пользователя
                  </h4>
                  <ul className="space-y-1 pl-6">
                    <li>• Telegram ID — для идентификации аккаунта</li>
                    <li>• Имя — для персонализации интерфейса</li>
                    <li>• Email не собираем и не храним</li>
                  </ul>
                </div>

                {/* Infrastructure */}
                <div>
                  <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                    <span>🏗️</span> Инфраструктура
                  </h4>
                  <ul className="space-y-1 pl-6">
                    <li>• Хостинг: Vercel (Edge Network)</li>
                    <li>• База данных: Vercel Postgres (изолированная)</li>
                    <li>• Платежи: ЮKassa (PCI DSS сертификация)</li>
                    <li>• Все коммуникации зашифрованы</li>
                  </ul>
                </div>

                {/* What we DON'T do */}
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <h4 className="font-medium text-red-400 mb-2">❌ Мы НЕ:</h4>
                  <ul className="space-y-1 text-red-300/80">
                    <li>• Не продаём ваши данные</li>
                    <li>• Не передаём API ключи третьим лицам</li>
                    <li>• Не храним данные банковских карт</li>
                    <li>• Не используем данные для рекламы</li>
                  </ul>
                </div>

                {/* Delete Data */}
                <div className="text-center pt-2">
                  <p className="text-stone-500 text-xs">
                    Хотите удалить все свои данные? Напишите нам:{' '}
                    <a
                      href="https://t.me/Vyacheslav_Neuro"
                      className="text-amber-400 hover:text-amber-300"
                    >
                      @Vyacheslav_Neuro
                    </a>
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

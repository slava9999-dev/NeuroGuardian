// ============================================
// NeuroGUARDIAN — Security Modal Component
// Detailed security information for users
// ============================================

import { motion, AnimatePresence } from 'framer-motion';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SecurityModal({ isOpen, onClose }: SecurityModalProps) {
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
          className="w-full max-w-lg bg-stone-900 rounded-t-3xl sm:rounded-2xl border-t sm:border border-emerald-500/30 overflow-hidden max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-emerald-900/90 to-teal-900/90 backdrop-blur-sm p-4 border-b border-emerald-500/30 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Безопасность</h2>
                <p className="text-xs text-emerald-300/70">Как мы защищаем ваши данные</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-stone-800 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-6">
            
            {/* Trust Banner */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-2xl text-center"
            >
              <motion.div 
                className="text-4xl mb-2"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🛡️
              </motion.div>
              <h3 className="text-lg font-bold text-white mb-1">Ваши данные под защитой</h3>
              <p className="text-sm text-emerald-300/80">
                Мы используем банковский уровень шифрования
              </p>
            </motion.div>

            {/* API Keys Section */}
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-panel p-4"
            >
              <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-2xl">🔑</span>
                Ваши API ключи
              </h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 p-3 bg-stone-800/50 rounded-xl">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <div>
                    <p className="font-medium text-white">Безопасное хранение</p>
                    <p className="text-stone-400">API ключи хранятся в защищённой базе данных PostgreSQL с изоляцией на уровне пользователя</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-stone-800/50 rounded-xl">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <div>
                    <p className="font-medium text-white">Шифрование при передаче</p>
                    <p className="text-stone-400">Все данные передаются по HTTPS с TLS 1.3 — это современный стандарт банков</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-stone-800/50 rounded-xl">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <div>
                    <p className="font-medium text-white">Только для ваших товаров</p>
                    <p className="text-stone-400">Ключи используются исключительно для мониторинга и защиты ваших товаров</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-stone-800/50 rounded-xl">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <div>
                    <p className="font-medium text-white">Никаких третьих лиц</p>
                    <p className="text-stone-400">Ваши ключи никогда не передаются посторонним. Только вы и наша система</p>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Data Protection */}
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-panel p-4"
            >
              <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-2xl">🔐</span>
                Защита данных
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-stone-800/50 rounded-xl text-center">
                  <div className="text-2xl mb-1">🔒</div>
                  <p className="text-xs text-white font-medium">SSL/TLS</p>
                  <p className="text-xs text-stone-400">шифрование</p>
                </div>
                <div className="p-3 bg-stone-800/50 rounded-xl text-center">
                  <div className="text-2xl mb-1">🌐</div>
                  <p className="text-xs text-white font-medium">Vercel Edge</p>
                  <p className="text-xs text-stone-400">CDN защита</p>
                </div>
                <div className="p-3 bg-stone-800/50 rounded-xl text-center">
                  <div className="text-2xl mb-1">📱</div>
                  <p className="text-xs text-white font-medium">Telegram</p>
                  <p className="text-xs text-stone-400">авторизация</p>
                </div>
                <div className="p-3 bg-stone-800/50 rounded-xl text-center">
                  <div className="text-2xl mb-1">💳</div>
                  <p className="text-xs text-white font-medium">ЮKassa</p>
                  <p className="text-xs text-stone-400">PCI DSS</p>
                </div>
              </div>
            </motion.section>

            {/* What We Collect */}
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-panel p-4"
            >
              <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-2xl">📋</span>
                Какие данные мы храним
              </h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center p-2 bg-stone-800/30 rounded-lg">
                  <span className="text-stone-300">Telegram ID</span>
                  <span className="text-xs text-emerald-400 px-2 py-0.5 bg-emerald-500/20 rounded-full">для входа</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-stone-800/30 rounded-lg">
                  <span className="text-stone-300">Имя пользователя</span>
                  <span className="text-xs text-emerald-400 px-2 py-0.5 bg-emerald-500/20 rounded-full">приветствие</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-stone-800/30 rounded-lg">
                  <span className="text-stone-300">API ключи WB/Ozon</span>
                  <span className="text-xs text-emerald-400 px-2 py-0.5 bg-emerald-500/20 rounded-full">защита товаров</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-stone-800/30 rounded-lg">
                  <span className="text-stone-300">Список товаров</span>
                  <span className="text-xs text-emerald-400 px-2 py-0.5 bg-emerald-500/20 rounded-full">мониторинг</span>
                </div>
              </div>
            </motion.section>

            {/* What We DON'T Do */}
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl"
            >
              <h3 className="text-base font-bold text-red-400 mb-3 flex items-center gap-2">
                <span className="text-2xl">🚫</span>
                Мы НИКОГДА не делаем
              </h3>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-400">✕</span>
                  <span className="text-red-300/80">Не продаём ваши данные</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-400">✕</span>
                  <span className="text-red-300/80">Не передаём API ключи третьим лицам</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-400">✕</span>
                  <span className="text-red-300/80">Не храним данные банковских карт</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-400">✕</span>
                  <span className="text-red-300/80">Не используем данные для рекламы</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-400">✕</span>
                  <span className="text-red-300/80">Не делаем операций без вашего ведома</span>
                </div>
              </div>
            </motion.section>

            {/* Simple Explanation */}
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl"
            >
              <h3 className="text-base font-bold text-blue-400 mb-3 flex items-center gap-2">
                <span className="text-2xl">💡</span>
                Простыми словами
              </h3>
              
              <p className="text-sm text-blue-200/80 leading-relaxed">
                Представьте, что ваши API ключи лежат в сейфе, к которому есть доступ только у вас и у нашего робота-защитника. 
                Робот использует ключи только чтобы следить за ценами и защищать ваши товары от демпинга. 
                Когда вы закрываете приложение — сейф остаётся на замке. 
                Никто другой не может туда заглянуть.
              </p>
            </motion.section>

            {/* Contact */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center pt-2"
            >
              <p className="text-sm text-stone-500 mb-2">
                Есть вопросы о безопасности?
              </p>
              <a 
                href="https://t.me/Vyacheslav_Neuro"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400 hover:bg-blue-500/30 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
                Написать в поддержку
              </a>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

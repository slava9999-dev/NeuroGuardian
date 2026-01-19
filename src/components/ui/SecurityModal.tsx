// ============================================
// NeuroGUARDIAN — Security Modal Component V6.0
// Concise, Space-Efficient, Accordion-Style
// ============================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Lock,
  EyeOff,
  Server,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
} from 'lucide-react';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SecurityModal({ isOpen, onClose }: SecurityModalProps) {
  const [openSection, setOpenSection] = useState<number | null>(0);

  if (!isOpen) return null;

  const sections = [
    {
      id: 1,
      title: 'Ваши ключи под защитой',
      icon: <Lock className="w-5 h-5 text-emerald-600" />,
      content: (
        <div className="text-sm text-slate-600 space-y-2">
          <p>
            Мы используем шифрование <strong>AES-256-GCM</strong> (банковский стандарт). Ключи
            шифруются перед сохранением и никогда не передаются третьим лицам.
          </p>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 p-2 rounded-lg">
            <Shield className="w-3 h-3" />
            <span>Только для мониторинга ваших товаров</span>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      title: 'Безопасность данных',
      icon: <Server className="w-5 h-5 text-indigo-600" />,
      content: (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-slate-50 rounded-lg text-center border border-slate-100">
            <span className="block font-bold text-slate-900">SSL/TLS 1.3</span>
            <span className="text-slate-400">Шифрование канала</span>
          </div>
          <div className="p-2 bg-slate-50 rounded-lg text-center border border-slate-100">
            <span className="block font-bold text-slate-900">Vercel Edge</span>
            <span className="text-slate-400">Защита от DDoS</span>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      title: 'Приватность и Анонимность',
      icon: <EyeOff className="w-5 h-5 text-slate-600" />,
      content: (
        <ul className="text-xs text-slate-500 space-y-2 list-disc list-inside">
          <li>Мы не продаем данные.</li>
          <li>Мы не храним данные банковских карт (обработка через ЮKassa).</li>
          <li>Мы не делаем действий на маркетплейсах без вашего ведома.</li>
        </ul>
      ),
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-10 sticky top-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-xl">
                <Shield className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Безопасность</h2>
                <p className="text-xs text-emerald-600 font-medium">Ваши данные защищены</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {/* Trust Badge */}
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-16 h-16 bg-linear-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mb-3 shadow-inner">
                <Lock className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Банковский уровень защиты</h3>
              <p className="text-xs text-slate-500 max-w-[200px]">
                Все чувствительные данные шифруются и хранятся в защищенном контуре.
              </p>
            </div>

            {/* Accordion Sections */}
            <div className="space-y-2">
              {sections.map((section, idx) => (
                <div
                  key={section.id}
                  className="bg-white border boundary-slate-200 rounded-xl overflow-hidden shadow-sm"
                >
                  <button
                    onClick={() => setOpenSection(openSection === idx ? null : idx)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {section.icon}
                      <span className="text-sm font-bold text-slate-700">{section.title}</span>
                    </div>
                    {openSection === idx ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  <AnimatePresence>
                    {openSection === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-4 pb-4 pt-0"
                      >
                        <div className="pt-2 border-t border-slate-100">{section.content}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Footer Link */}
            <div className="pt-4 text-center">
              <a
                href="https://t.me/Vyacheslav_Neuro"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <span>Задать вопрос о безопасности</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

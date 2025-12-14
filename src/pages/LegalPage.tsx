// ============================================
// NeuroGUARDIAN — Legal Information Page
// Required for YooKassa integration
// ============================================

import { motion } from 'framer-motion';
import { SecurityBadge } from '../components/ui/SecurityBadge';

interface LegalPageProps {
  onBack?: () => void;
}

export function LegalPage({ onBack }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 to-stone-800 px-4 py-6 pb-24">
      {/* Header */}
      {onBack && (
        <header className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">Правовая информация</h1>
        </header>
      )}

      {!onBack && (
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gradient-amber mb-2">NeuroGUARDIAN</h1>
          <p className="text-stone-400">Правовая информация</p>
        </header>
      )}

      <div className="space-y-6">
        {/* Security Badge */}
        <SecurityBadge />

        {/* Реквизиты */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-6"
        >
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-amber-400">📋</span>
            Реквизиты
          </h2>
          
          <div className="space-y-3 text-stone-300">
            <div className="flex justify-between items-start">
              <span className="text-stone-400">Исполнитель:</span>
              <span className="text-right font-medium">Дерябин Вячеслав Валерьевич</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-stone-400">Статус:</span>
              <span className="text-right">Самозанятый (НПД)</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-stone-400">ИНН:</span>
              <span className="text-right font-mono">670301543202</span>
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
          transition={{ delay: 0.1 }}
          className="glass-panel p-6"
        >
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-amber-400">📞</span>
            Контакты
          </h2>
          
          <div className="space-y-3 text-stone-300">
            <div className="flex justify-between items-start">
              <span className="text-stone-400">Телефон:</span>
              <a href="tel:+79040476383" className="text-amber-400 hover:text-amber-300">
                +7 (904) 047-63-83
              </a>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-stone-400">Email:</span>
              <a href="mailto:slava-derjbin@list.ru" className="text-amber-400 hover:text-amber-300">
                slava-derjbin@list.ru
              </a>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-stone-400">Telegram:</span>
              <a href="https://t.me/Vyacheslav_Neuro" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">
                @Vyacheslav_Neuro
              </a>
            </div>
          </div>
        </motion.section>

        {/* Кнопка помощи Telegram */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <a
            href="https://t.me/Vyacheslav_Neuro"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-2xl text-white font-medium transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
            </svg>
            <span className="text-lg">Написать в Telegram</span>
            <span className="text-blue-200 text-sm">@Vyacheslav_Neuro</span>
          </a>
        </motion.section>

        {/* Услуги и тарифы */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-6"
        >
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-amber-400">💰</span>
            Услуги и тарифы
          </h2>
          
          <p className="text-stone-300 mb-4">
            NeuroGUARDIAN — сервис автоматической защиты маржи для продавцов маркетплейсов 
            Wildberries и Ozon. Система мониторит цены ваших товаров и автоматически 
            защищает от принудительного снижения цен на акциях.
          </p>
          
          <div className="space-y-4">
            {/* 🎁 FREE TRIAL */}
            <div className="p-4 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-xl border border-emerald-500/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-bl-xl">
                🎁 БЕСПЛАТНО
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-white">Пробный период</span>
                <span className="text-emerald-400 font-bold">3 дня</span>
              </div>
              <ul className="text-sm text-stone-400 space-y-1">
                <li>• Полный доступ ко всем функциям</li>
                <li>• До 20 товаров</li>
                <li>• Без привязки карты</li>
                <li>• Автоматическое отключение</li>
              </ul>
              <p className="text-xs text-emerald-400/70 mt-2">
                Активируется автоматически при первом входе
              </p>
            </div>
            
            <div className="p-4 bg-stone-800/50 rounded-xl border border-stone-700">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-white">Базовый</span>
                <span className="text-amber-400 font-bold">499 ₽/мес</span>
              </div>
              <ul className="text-sm text-stone-400 space-y-1">
                <li>• До 50 товаров</li>
                <li>• Защита Zero Stock</li>
                <li>• Telegram уведомления</li>
              </ul>
            </div>
            
            <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-white">Профессиональный</span>
                <span className="text-amber-400 font-bold">999 ₽/мес</span>
              </div>
              <ul className="text-sm text-stone-400 space-y-1">
                <li>• До 500 товаров</li>
                <li>• Все режимы защиты</li>
                <li>• Приоритетная поддержка</li>
                <li>• API доступ</li>
              </ul>
            </div>
            
            <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-white">Годовой Pro</span>
                <span className="text-emerald-400 font-bold">9 990 ₽/год</span>
              </div>
              <ul className="text-sm text-stone-400 space-y-1">
                <li>• Все из Pro</li>
                <li>• Экономия 2000₽</li>
                <li>• Персональный менеджер</li>
              </ul>
            </div>
          </div>
        </motion.section>

        {/* Оферта */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-panel p-6"
        >
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-amber-400">📄</span>
            Договор оферты
          </h2>
          
          <div className="text-sm text-stone-300 space-y-4 max-h-96 overflow-y-auto pr-2">
            <p className="font-medium text-white">ПУБЛИЧНАЯ ОФЕРТА</p>
            <p>
              Настоящий документ является официальным предложением (публичной офертой) 
              Исполнителя — самозанятого Дерябина Вячеслава Валерьевича (ИНН: 670301543202) 
              заключить договор на оказание услуг автоматизации защиты ценообразования на 
              маркетплейсах на следующих условиях:
            </p>
            
            <p className="font-medium text-white mt-4">1. ПРЕДМЕТ ДОГОВОРА</p>
            <p>
              1.1. Исполнитель обязуется предоставить Заказчику доступ к сервису NeuroGUARDIAN 
              для автоматического мониторинга и защиты цен товаров на маркетплейсах WB и Ozon.
            </p>
            <p>
              1.2. Заказчик обязуется оплатить услуги Исполнителя в соответствии с выбранным тарифом.
            </p>
            
            <p className="font-medium text-white mt-4">2. ПРОБНЫЙ ПЕРИОД И СТОИМОСТЬ УСЛУГ</p>
            <p>
              2.1. Новым пользователям предоставляется бесплатный пробный период сроком 3 (три) 
              календарных дня с полным доступом ко всем функциям сервиса.
            </p>
            <p>
              2.2. Пробный период активируется автоматически при первом входе в приложение.
              По истечении пробного периода доступ к платным функциям приостанавливается.
            </p>
            <p>
              2.3. Стоимость услуг определяется в соответствии с действующими тарифами.
            </p>
            <p>
              2.4. Оплата производится путём 100% предоплаты через платёжную систему ЮKassa.
            </p>
            <p>
              2.5. Моментом оплаты считается поступление денежных средств на счёт Исполнителя.
            </p>
            
            <p className="font-medium text-white mt-4">3. ПОРЯДОК ВОЗВРАТА</p>
            <p>
              3.1. Возврат денежных средств возможен в течение 3 дней после оплаты при условии 
              неиспользования сервиса.
            </p>
            <p>
              3.2. Для оформления возврата необходимо связаться с поддержкой по email: 
              slava-derjbin@list.ru
            </p>
            
            <p className="font-medium text-white mt-4">4. ОТВЕТСТВЕННОСТЬ</p>
            <p>
              4.1. Исполнитель не несёт ответственности за убытки, возникшие вследствие 
              неправильной настройки сервиса Заказчиком.
            </p>
            <p>
              4.2. Исполнитель не несёт ответственности за изменения в API маркетплейсов, 
              которые могут повлиять на работу сервиса.
            </p>
            
            <p className="font-medium text-white mt-4">5. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ</p>
            <p>
              5.1. Акцептом оферты является факт оплаты услуг.
            </p>
            <p>
              5.2. Настоящий договор вступает в силу с момента акцепта и действует до 
              окончания оплаченного периода.
            </p>
          </div>
        </motion.section>

        {/* Политика конфиденциальности */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-panel p-6"
        >
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-amber-400">🔒</span>
            Политика конфиденциальности
          </h2>
          
          <div className="text-sm text-stone-300 space-y-4 max-h-96 overflow-y-auto pr-2">
            <p className="font-medium text-white">ПОЛИТИКА ОБРАБОТКИ ПЕРСОНАЛЬНЫХ ДАННЫХ</p>
            
            <p className="font-medium text-white mt-4">1. ОБЩИЕ ПОЛОЖЕНИЯ</p>
            <p>
              1.1. Настоящая политика определяет порядок обработки персональных данных 
              пользователей сервиса NeuroGUARDIAN.
            </p>
            <p>
              1.2. Оператор персональных данных: Дерябин Вячеслав Валерьевич, ИНН 670301543202.
            </p>
            
            <p className="font-medium text-white mt-4">2. СОБИРАЕМЫЕ ДАННЫЕ</p>
            <p>2.1. Мы собираем следующие данные:</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Telegram ID и имя пользователя</li>
              <li>API ключи маркетплейсов (шифруются алгоритмом AES-256-GCM)</li>
              <li>Данные о товарах из подключённых аккаунтов</li>
              <li>Информация о платежах</li>
            </ul>
            
            <p className="font-medium text-white mt-4">3. ИСПОЛЬЗОВАНИЕ ДАННЫХ</p>
            <p>3.1. Данные используются для:</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Предоставления доступа к сервису</li>
              <li>Мониторинга цен и защиты товаров</li>
              <li>Отправки уведомлений о срабатывании защиты</li>
              <li>Обработки платежей</li>
            </ul>
            
            <p className="font-medium text-white mt-4">4. ЗАЩИТА ДАННЫХ</p>
            <p>
              4.1. Все данные передаются по защищённым каналам (HTTPS).
            </p>
            <p>
              4.2. API ключи шифруются алгоритмом AES-256-GCM и не передаются третьим лицам.
            </p>
            
            <p className="font-medium text-white mt-4">5. ПРАВА ПОЛЬЗОВАТЕЛЯ</p>
            <p>5.1. Вы имеете право:</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Получить информацию о своих данных</li>
              <li>Удалить свои данные (обратитесь в поддержку)</li>
              <li>Отозвать согласие на обработку</li>
            </ul>
          </div>
        </motion.section>

        {/* Способы оплаты */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-panel p-6"
        >
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-amber-400">💳</span>
            Способы оплаты
          </h2>
          
          <p className="text-stone-300 mb-4">
            Оплата производится через платёжную систему ЮKassa. Доступные способы:
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 bg-stone-800/50 rounded-xl">
              <span>💳</span>
              <span className="text-sm text-stone-300">Банковская карта</span>
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
            Платежи обрабатываются сервисом ЮKassa (ООО «ЮМани»). 
            Данные вашей карты передаются напрямую в ЮKassa и не хранятся на нашем сервере.
          </p>
        </motion.section>

        {/* Footer */}
        <motion.section 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-stone-500 text-sm py-4"
        >
          <p>NeuroGUARDIAN v2.2.0</p>
          <p>© 2024 Дерябин В.В. Все права защищены.</p>
          <p className="mt-2">ИНН: 670301543202 | Самозанятый</p>
        </motion.section>
      </div>
    </div>
  );
}

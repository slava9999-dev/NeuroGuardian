// ============================================
// NeuroGUARDIAN — Legal Information Page
// Required for YooKassa integration
// ============================================

import { motion } from 'framer-motion';

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
              <span className="text-stone-400">Поддержка:</span>
              <a href="https://t.me/neuroguardian_support" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">
                @neuroguardian_support
              </a>
            </div>
          </div>
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
            
            <p className="font-medium text-white mt-4">2. СТОИМОСТЬ И ПОРЯДОК ОПЛАТЫ</p>
            <p>
              2.1. Стоимость услуг определяется в соответствии с действующими тарифами.
            </p>
            <p>
              2.2. Оплата производится путём 100% предоплаты через платёжную систему ЮKassa.
            </p>
            <p>
              2.3. Моментом оплаты считается поступление денежных средств на счёт Исполнителя.
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
              <li>API ключи маркетплейсов (хранятся в зашифрованном виде)</li>
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
              4.2. API ключи хранятся в зашифрованном виде и не передаются третьим лицам.
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
          <p>NeuroGUARDIAN v2.0.0</p>
          <p>© 2024 Дерябин В.В. Все права защищены.</p>
          <p className="mt-2">ИНН: 670301543202 | Самозанятый</p>
        </motion.section>
      </div>
    </div>
  );
}

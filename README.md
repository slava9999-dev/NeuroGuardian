# 🛡️ NeuroGUARDIAN

> **Автоматическая защита маржи для продавцов WB и Ozon**

Система мониторинга и защиты цен от принудительных акций маркетплейсов. Когда маркетплейс снижает вашу цену ниже установленного минимума — NeuroGUARDIAN мгновенно реагирует!

---

## ✨ Возможности

### 🎁 3 Дня Бесплатно

Каждый новый пользователь получает **полный доступ на 3 дня** без привязки карты.

### 🔒 Два режима защиты

| Режим                | Описание                                            |
| -------------------- | --------------------------------------------------- |
| **Zero Stock**       | Обнуляет остаток товара — товар снимается с продажи |
| **Price Correction** | Возвращает цену к установленному минимуму           |

### 📱 Telegram Integration

- Авторизация через Telegram
- Уведомления о срабатывании защиты
- Быстрая связь с поддержкой

### 💳 Подписка

- **Basic** — 499₽/мес (до 50 товаров)
- **Pro** — 999₽/мес (до 500 товаров)
- **Yearly** — 9990₽/год (экономия 2000₽)

---

## 🔐 Безопасность и Приватность

### Защита API ключей

```
✅ Хранятся в защищённой PostgreSQL базе данных
✅ Передаются только по HTTPS (TLS 1.3)
✅ Используются исключительно для ваших товаров
✅ Никогда не передаются третьим лицам
```

### Аутентификация

```
✅ Telegram HMAC-SHA256 валидация
✅ Криптографическая проверка подписи
✅ Защита от replay attacks (24h auth_date)
```

### Платежи

```
✅ ЮKassa (PCI DSS сертификация)
✅ Данные карт не хранятся на сервере
✅ Безопасный embedded виджет
```

### Мы НЕ:

```
❌ Не продаём ваши данные
❌ Не передаём API ключи третьим лицам
❌ Не храним данные банковских карт
❌ Не используем данные для рекламы
❌ Не делаем операций без вашего ведома
```

---

## 📲 Как подключить

### Шаг 1: Получите API ключ Wildberries

1. Откройте [seller.wildberries.ru](https://seller.wildberries.ru)
2. Профиль → Настройки → Доступ к API
3. Создайте новый токен
4. Выберите права: **Контент**, **Цены**, **Склад**
5. Скопируйте ключ (показывается только 1 раз!)

### Шаг 2: Получите API ключ Ozon

1. Откройте [seller.ozon.ru](https://seller.ozon.ru)
2. Настройки → API ключи
3. Создайте новый ключ
4. Скопируйте **API-ключ** и **Client ID** (нужны оба!)

### Шаг 3: Подключите в приложении

1. Откройте NeuroGUARDIAN
2. Перейдите в **Настройки** (⚙️)
3. Нажмите **Подключить** напротив нужного маркетплейса
4. Вставьте ключи и нажмите **Сохранить**

### Шаг 4: Настройте Stop-Loss

1. На главной странице найдите товары
2. Для каждого установите **минимальную цену**
3. Товары с установленной ценой будут защищены

### Шаг 5: Активируйте защиту

1. Нажмите большую кнопку **ARMED**
2. Система начнёт мониторинг 24/7
3. При срабатывании получите уведомление в Telegram!

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────┐
│                 TELEGRAM WEBAPP                      │
│  (React 19 + Vite + TypeScript + TailwindCSS)       │
├─────────────────────────────────────────────────────┤
│                  VERCEL API                          │
│  • /api?action=auth — Telegram авторизация          │
│  • /api?action=products — CRUD товаров              │
│  • /api?action=settings — Настройки пользователя     │
│  • /api?action=create-payment — Создание платежа    │
│  • /api?action=check-prices — Sentinel (Cron)       │
├─────────────────────────────────────────────────────┤
│                VERCEL POSTGRES                       │
│  users | products | transactions                    │
├─────────────────────────────────────────────────────┤
│                 EXTERNAL APIS                        │
│  • Wildberries Seller API                           │
│  • Ozon Seller API v3                               │
│  • YooKassa Payments                                │
│  • Telegram Bot API                                 │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 Логика работы Sentinel

```typescript
// Цикл проверки (Cron Job)
// ============================

// 1. Получить пользователей с protection_enabled = true
const users = await getProtectedUsers();

// 2. Для каждого пользователя получить товары с min_price > 0
for (const user of users) {
  const products = await getMonitoredProducts(user.id);

  // 3. Получить текущие цены через API маркетплейса
  const currentPrices = await fetchMarketplacePrices(products);

  // 4. Проверить нарушения
  for (const product of products) {
    const currentPrice = currentPrices[product.id];

    // 5. VIOLATION DETECTED!
    if (currentPrice < product.minPrice) {
      // 6. Выполнить защитное действие
      if (user.defenseMode === "zero_stock") {
        await setStock(product.id, 0); // Обнулить сток
      } else {
        await setPrice(product.id, product.minPrice); // Вернуть цену
      }

      // 7. Отправить уведомление в Telegram
      await sendTelegramAlert(user.id, product, currentPrice);

      // 8. Обновить статистику
      await updateStats(user.id, product.minPrice - currentPrice);
    }
  }
}
```

---

## 💻 Development

### Локальный запуск

```bash
# Установка зависимостей
npm install

# Запуск dev сервера
npm run dev

# Сборка для production
npm run build
```

### Environment Variables

```env
# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token

# YooKassa
YOOKASSA_SHOP_ID=123456
YOOKASSA_SECRET_KEY=live_xxx

# Admin
ADMIN_API_KEY=your-secret-key
```

---

## 📞 Поддержка

- **Telegram:** [@Vyacheslav_Neuro](https://t.me/Vyacheslav_Neuro)
- **Email:** slava-derjbin@list.ru
- **Телефон:** +7 (904) 047-63-83

---

## 📜 Юридическая информация

- **Исполнитель:** Дерябин Вячеслав Валерьевич
- **Статус:** Самозанятый (НПД)
- **ИНН:** 670301543202
- **Регион:** Нижегородская область

Полная оферта и политика конфиденциальности доступны в приложении (вкладка "Инфо").

---

## 📄 Лицензия

© 2024 Дерябин В.В. Все права защищены.

NeuroGUARDIAN v2.1.0 — Margin Defense System

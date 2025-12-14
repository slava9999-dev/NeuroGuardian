# 🚀 NeuroGUARDIAN — PRODUCTION DEPLOYMENT CHECKLIST

## Дата подготовки: 2024-12-14

## Статус: ГОТОВО К PRODUCTION

---

## ✅ ВЫПОЛНЕННЫЕ ПРОВЕРКИ

### 🔐 Безопасность

- [x] **Telegram initData HMAC-SHA256 validation** — криптографическая проверка подписи
- [x] **Production mode check** — demo user только в development
- [x] **TELEGRAM_BOT_TOKEN required in production** — без токена = ошибка авторизации
- [x] **YOOKASSA required in production** — без настройки = ошибка 503
- [x] **CORS ограничен** — только разрешённые домены
- [x] **Rate Limiting** — 100 req/min на IP
- [x] **Input sanitization** — XSS защита
- [x] **Security headers** — X-Frame-Options, X-XSS-Protection и др.
- [x] **Timing-safe comparison** — защита от timing attacks

### 💳 Платежи YooKassa (Самозанятый)

- [x] **Реквизиты в LegalPage** — ФИО, ИНН, статус самозанятого
- [x] **Публичная оферта** — полный текст договора
- [x] **Политика конфиденциальности** — GDPR compliant
- [x] **Контактные данные** — телефон, email, Telegram
- [x] **Описание услуг и тарифов** — все планы с ценами
- [x] **Способы оплаты** — карта, СБП, ЮMoney, SberPay
- [x] **Ссылка на оферту в PaymentModal** — перед оплатой
- [x] **Receipt для чека** — vat_code: 1 (НПД)
- [x] **Webhook обработка** — success, canceled

### 🛡️ Sentinel (Защита цен)

- [x] **Ozon defense** — zero_stock, price_correction
- [x] **Cron job** — каждые 5 минут
- [x] **Telegram уведомления** — при срабатывании защиты
- [x] **Subscription check** — защита только для подписчиков
- [ ] **WB defense** — TODO (placeholder)

### 🎨 Frontend

- [x] **Production build** — Vite optimized
- [x] **Error boundaries** — graceful error handling
- [x] **Loading states** — UX
- [x] **Mobile responsive** — Telegram WebApp
- [x] **MOCK_PRODUCTS only in DEV** — `import.meta.env.DEV` check

---

## 📋 VERCEL ENVIRONMENT VARIABLES

### Обязательные для Production

| Variable              | Описание                          | Установлено? |
| --------------------- | --------------------------------- | ------------ |
| `TELEGRAM_BOT_TOKEN`  | Токен бота от @BotFather          | ⬜           |
| `YOOKASSA_SHOP_ID`    | ID магазина ЮКасса                | ⬜           |
| `YOOKASSA_SECRET_KEY` | Секретный ключ ЮКасса             | ⬜           |
| `ADMIN_API_KEY`       | Ключ для admin endpoints          | ⬜           |
| `CRON_SECRET`         | Автоматически (Vercel)            | ⬜           |
| `WEBAPP_URL`          | https://neuro-guardian.vercel.app | ⬜           |

### Опциональные

| Variable                | Описание               | По умолчанию     |
| ----------------------- | ---------------------- | ---------------- |
| `TELEGRAM_BOT_USERNAME` | Для реферальных ссылок | NeuroGuardianBot |

---

## 🔧 НАСТРОЙКА YOOKASSA

### Шаг 1: Регистрация

1. Зайти на https://yookassa.ru
2. Зарегистрироваться как самозанятый (НПД)
3. Указать данные:
   - ФИО: Дерябин Вячеслав Валерьевич
   - ИНН: 670301543202
   - Статус: Самозанятый

### Шаг 2: Настройка магазина

1. Создать магазин в личном кабинете
2. Включить способы оплаты:
   - ✅ Банковская карта
   - ✅ СБП
   - ✅ ЮMoney
   - ✅ SberPay

### Шаг 3: Webhook

1. Настройки → HTTP-уведомления
2. URL: `https://neuro-guardian.vercel.app/api?action=payment-webhook`
3. События: `payment.succeeded`, `payment.canceled`

### Шаг 4: Получение ключей

1. Скопировать `shopId` и `secretKey`
2. Добавить в Vercel Environment Variables

---

## 🚀 DEPLOY COMMANDS

```bash
# 1. Проверить сборку локально
npm run build

# 2. Deploy на Vercel (через Git push)
git add .
git commit -m "Production ready: YooKassa + Security"
git push origin main

# 3. Проверить переменные окружения в Vercel Dashboard
# → Settings → Environment Variables
```

---

## ✅ POST-DEPLOY CHECKLIST

После деплоя проверить:

```bash
# 1. Health check
curl https://neuro-guardian.vercel.app/api?action=health

# Ожидаемый ответ:
# {"status":"healthy","database":true,"hasPostgresUrl":true,"hasYookassaShopId":true}

# 2. Plans endpoint
curl https://neuro-guardian.vercel.app/api?action=plans

# 3. Тестовый платёж (ТОЛЬКО В TEST MODE ЮКассы!)
# Открыть приложение → Выбрать тариф → Оплатить тестовой картой

# 4. Telegram Bot
# Убедиться, что бот отвечает и открывает WebApp
```

---

## 📱 TELEGRAM BOT SETUP

### @BotFather команды:

```
/setmenubutton
@YourBotUsername
https://neuro-guardian.vercel.app

/setdescription
NeuroGUARDIAN — автоматическая защита маржи для WB и Ozon
```

### Web App Settings:

```
/newapp
@YourBotUsername
NeuroGUARDIAN
https://neuro-guardian.vercel.app
```

---

## ⚠️ ИЗВЕСТНЫЕ ОГРАНИЧЕНИЯ

1. **WB Sentinel не реализован** — только Ozon
2. **Rate limiter in-memory** — сбрасывается при cold start
3. **API keys plain text** — рекомендуется шифрование

---

## 📞 ПОДДЕРЖКА

- **Telegram:** @Vyacheslav_Neuro
- **Email:** slava-derjbin@list.ru
- **Телефон:** +7 (904) 047-63-83

---

_Документ создан: 2024-12-14T17:50:00_
_NeuroGUARDIAN v2.1.0 — PRODUCTION READY_

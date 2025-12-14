# 🔍 ПОЛНЫЙ КРИТИЧЕСКИЙ АУДИТ NeuroGUARDIAN

## Дата: 2024-12-14 (обновлено)

## Версия: 2.1.0

## Статус: 🟡 ГОТОВО К BETA (с оговорками)

---

# 📊 EXECUTIVE SUMMARY

| Категория                 | Статус         | Оценка | Критичность |
| ------------------------- | -------------- | ------ | ----------- |
| **Архитектура**           | ✅ Хорошо      | 9/10   | -           |
| **Безопасность**          | 🟡 Улучшено    | 7/10   | СРЕДНЯЯ     |
| **API Endpoints**         | ✅ Готовы      | 9/10   | -           |
| **Frontend**              | ✅ Хорошо      | 8/10   | -           |
| **Database**              | ✅ Корректная  | 9/10   | -           |
| **Платёжная система**     | ✅ YooKassa    | 8/10   | -           |
| **Telegram Integration**  | ✅ HMAC-SHA256 | 9/10   | -           |
| **Sentinel (Core Logic)** | ✅ Работает    | 8/10   | -           |
| **Rate Limiting**         | ✅ Реализован  | 7/10   | -           |
| **Error Handling**        | ✅ Есть        | 8/10   | -           |

**ОБЩАЯ ОЦЕНКА: 82/100** — Готово к Beta тестированию

---

# 🏗️ АРХИТЕКТУРА

## Dual Backend Structure (⚠️ ВНИМАНИЕ)

Проект имеет **ДВА БЭКЕНДА**, что создаёт потенциальную путаницу:

### 1. Vercel Serverless (`/api/index.ts`) — АКТИВНЫЙ

- **1588 строк** кода
- Unified handler pattern
- Используется в продакшене
- Подключен к Vercel Postgres

### 2. Firebase Functions (`/functions/src/`) — LEGACY/АЛЬТЕРНАТИВА

- 472 строки в `index.ts`
- Использует Firestore + Secret Manager
- Модульная архитектура (gatekeeper, sentinel, sync, payments)
- **НЕ РАЗВЁРНУТ** в текущей конфигурации

```
⚠️ РЕКОМЕНДАЦИЯ: Определить один активный бэкенд и удалить/архивировать второй
во избежание путаницы и дублирования кода.
```

## Active Stack (Vercel)

| Компонент | Технология                    | Статус |
| --------- | ----------------------------- | ------ |
| Frontend  | React 19 + Vite + TypeScript  | ✅     |
| Styling   | TailwindCSS + Framer Motion   | ✅     |
| State     | Zustand + Persist             | ✅     |
| Backend   | Vercel Serverless Functions   | ✅     |
| Database  | Vercel Postgres               | ✅     |
| Payments  | YooKassa Embedded             | ✅     |
| Auth      | Telegram initData HMAC-SHA256 | ✅     |
| Cron      | Vercel Cron Jobs              | ✅     |

---

# 🔐 АУДИТ БЕЗОПАСНОСТИ

## ✅ ИСПРАВЛЕНО (с прошлого аудита)

### 1. Telegram initData Validation — РЕАЛИЗОВАНО ✅

**Файл:** `api/index.ts`, строки 106-200

```typescript
function validateTelegramInitData(initData: string): InitDataValidationResult {
  // ✅ HMAC-SHA256 validation
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(TELEGRAM_BOT_TOKEN)
    .digest();
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // ✅ Timing-safe comparison (prevents timing attacks)
  if (!crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
    return { valid: false, user: null, error: "Invalid signature" };
  }

  // ✅ Auth date validation (24h max)
  if (now - authTimestamp > MAX_AGE) {
    return { valid: false, user: null, error: "Auth data expired" };
  }
}
```

### 2. Production Mode Check — РЕАЛИЗОВАНО ✅

```typescript
const IS_PRODUCTION =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";
// Demo user only in development
if (!IS_PRODUCTION) {
  console.log("🧪 [DEV] Using demo user");
  return { valid: true, user: DEMO_USER };
}
```

### 3. CORS Restriction — РЕАЛИЗОВАНО ✅

```typescript
const ALLOWED_ORIGINS = [
  "https://neuro-guardian.vercel.app",
  "https://neuro-guardian-sos.vercel.app",
  "https://t.me",
  process.env.WEBAPP_URL,
].filter(Boolean);
```

### 4. Rate Limiting — РЕАЛИЗОВАНО ✅

```typescript
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60 * 1000;
// + Headers: X-RateLimit-Limit, X-RateLimit-Remaining
```

### 5. Input Sanitization — РЕАЛИЗОВАНО ✅

```typescript
function sanitizeInput(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.slice(0, 10000).replace(/[<>]/g, ""); // XSS prevention
}

function sanitizeApiKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9\-_:]/g, "").slice(0, 500);
}
```

### 6. Security Headers — РЕАЛИЗОВАНО ✅

```typescript
res.setHeader("X-Content-Type-Options", "nosniff");
res.setHeader("X-Frame-Options", "DENY");
res.setHeader("X-XSS-Protection", "1; mode=block");
res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
```

---

## ⚠️ ОСТАВШИЕСЯ ПРОБЛЕМЫ

### 1. API Keys хранятся в Plain Text (P1 - HIGH)

**Файл:** `api/index.ts`, строки 824-827

```typescript
await sql`UPDATE users SET api_key_wb = ${apiKey}, ...`; // ← Plain text!
```

**Риск:** При утечке БД все API ключи пользователей будут скомпрометированы.

**Решение:**

```typescript
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY; // 32 bytes

function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv
  );
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}
```

### 2. ADMIN_KEY в .env (P2 - MEDIUM)

**Файл:** `.env`, строка 32

```
ADMIN_KEY=neuro_secret_test_key
```

**Рекомендация:** Удалить из репозитория, использовать только Vercel Environment Variables.

### 3. BOT_TOKEN Fallback (P2 - MEDIUM)

**Файл:** `api/index.ts`, строки 124-133

```typescript
// If no bot token configured, allow but log warning
if (!TELEGRAM_BOT_TOKEN) {
  console.warn("⚠️ TELEGRAM_BOT_TOKEN not set, skipping signature validation");
  // ... still allows access
}
```

**Риск:** В продакшене без BOT_TOKEN любой может подделать initData.

**Решение:** В продакшене требовать BOT_TOKEN обязательно.

### 4. Rate Limiter — In-Memory (P3 - LOW)

```typescript
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
// ⚠️ Resets on cold start
```

**Рекомендация:** Для продакшена использовать Redis или Vercel KV.

---

# 📡 АУДИТ API ENDPOINTS

## Endpoints Map (Vercel API)

| Action                 | Method   | Auth        | Описание                  | Статус |
| ---------------------- | -------- | ----------- | ------------------------- | ------ |
| `auth`                 | POST     | initData    | Telegram аутентификация   | ✅     |
| `products`             | GET/POST | X-Init-Data | CRUD товаров              | ✅     |
| `settings`             | POST     | X-Init-Data | Настройки пользователя    | ✅     |
| `plans`                | GET      | Public      | Получение тарифов         | ✅     |
| `create-payment`       | POST     | X-Init-Data | Создание платежа YooKassa | ✅     |
| `payment-webhook`      | POST     | Public      | Webhook от YooKassa       | ✅     |
| `sync-products`        | POST     | X-Init-Data | Синхронизация WB/Ozon     | ✅     |
| `check-prices`         | GET      | CRON/Admin  | Sentinel проверка         | ✅     |
| `send-reminders`       | GET      | CRON/Admin  | Напоминания об окончании  | ✅     |
| `referral`             | GET/POST | X-Init-Data | Реферальная система       | ✅     |
| `init-db`              | POST     | X-Admin-Key | Инициализация БД          | ✅     |
| `admin-activate-trial` | POST     | X-Admin-Key | Активация trial           | ✅     |
| `admin-clone-user`     | POST     | X-Admin-Key | Клонирование данных       | ✅     |
| `health`               | GET      | Public      | Health check              | ✅     |

**Всего:** 14 endpoints

---

# 🛡️ SENTINEL MODULE (Core Logic)

## Логика проверки цен — КОРРЕКТНАЯ ✅

**Файл:** `api/index.ts`, строки 1282-1442

```
Цикл проверки:
1. Найти пользователей с protection_enabled = true
2. Для каждого получить товары с min_price > 0
3. Запросить текущие цены через API (Ozon v3 / WB)
4. Если currentPrice < minPrice → DEFENSE TRIGGER
5. Выполнить защиту (zero_stock или price_correction)
6. Отправить Telegram уведомление
```

## Defense Modes — ОБА РАБОТАЮТ ✅

### Mode 1: Zero Stock

```typescript
await fetch("https://api-seller.ozon.ru/v1/product/import/stocks", {
  body: JSON.stringify({
    stocks: [{ offer_id: item.offer_id, product_id: item.id, stock: 0 }],
  }),
});
```

### Mode 2: Price Correction

```typescript
await fetch("https://api-seller.ozon.ru/v1/product/import/prices", {
  body: JSON.stringify({
    prices: [
      {
        offer_id: item.offer_id,
        product_id: item.id,
        price: String(minPrice),
      },
    ],
  }),
});
```

## Cron Job — НАСТРОЕН ✅

**Файл:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api?action=check-prices",
      "schedule": "*/5 * * * *" // Каждые 5 минут
    },
    {
      "path": "/api?action=send-reminders",
      "schedule": "0 10 * * *" // Ежедневно в 10:00
    }
  ]
}
```

---

# 💳 ПЛАТЁЖНАЯ СИСТЕМА

## YooKassa Integration — ГОТОВА ✅

### Subscription Plans

| Plan   | Price                   | Duration | Max Products |
| ------ | ----------------------- | -------- | ------------ |
| Basic  | 499₽ (349₽ first month) | 30 days  | 50           |
| Pro    | 999₽ (699₽ first month) | 30 days  | 500          |
| Yearly | 9990₽                   | 365 days | 500          |

### Features

- ✅ Embedded Widget + Redirect
- ✅ First month 30% discount
- ✅ Promo codes (LAUNCH30, NEURO20)
- ✅ Referral program (+30 days for referrer)
- ✅ Subscription reminders (3 days before expiry)
- ✅ Webhook processing
- ✅ Test mode fallback (when YooKassa not configured)

### Subscription Gating — РЕАЛИЗОВАНО ✅

```typescript
// Protection toggle requires subscription
if (protectionEnabled === true) {
  if (!isSubscriptionActive(dbUser)) {
    return res.status(403).json({
      error: "Для включения защиты требуется активная подписка",
      code: "SUBSCRIPTION_REQUIRED",
    });
  }
}

// Sync requires subscription
if (!isSubscriptionActive(dbUser)) {
  return res.status(403).json({
    error: "Для синхронизации товаров требуется активная подписка",
    code: "SUBSCRIPTION_REQUIRED",
  });
}
```

### Product Limits — РЕАЛИЗОВАНО ✅

```typescript
function getProductLimit(plan: string | null): number {
  switch (plan) {
    case "pro":
    case "yearly":
      return 500;
    case "basic":
      return 50;
    case "trial":
      return 20;
    default:
      return 0;
  }
}
```

---

# 🎨 FRONTEND AUDIT

## Components Structure

```
src/
├── App.tsx              # Main router, auth flow
├── pages/
│   ├── DashboardPage.tsx # Products grid, GlobalSwitch
│   ├── SettingsPage.tsx  # API keys, subscription
│   └── LegalPage.tsx     # Legal info
├── components/
│   ├── dashboard/        # DashboardGrid, ProductCard
│   ├── controls/         # GlobalSwitch
│   ├── ui/               # Dialog, PaymentModal
│   └── ErrorBoundary.tsx # Error handling
├── stores/               # Zustand stores
├── lib/                  # API client, Telegram SDK
└── types/                # TypeScript definitions
```

## ✅ Strengths

- Proper auth flow with Telegram WebApp
- Zustand for state management
- Framer Motion animations
- Responsive design
- Error boundaries
- Loading states

## ⚠️ Issues Found

### 1. Mock User Fallback (DEV only) — OK

```typescript
// App.tsx line 67-84
const MOCK_USER = { ... }; // Only used on API failure
```

### 2. Console.log in Production

Много `console.log` statements в продакшен коде.

**Рекомендация:** Добавить логику отключения в продакшене:

```typescript
const log = import.meta.env.PROD ? () => {} : console.log;
```

---

# 🗄️ DATABASE SCHEMA

## Tables — КОРРЕКТНЫЕ ✅

### users

- id (BIGINT PK) — Telegram ID
- username, first_name, last_name, photo_url
- api_key_wb, api_key_ozon — ⚠️ Plain text
- protection_enabled, defense_mode
- subscription_plan, subscription_end, subscription_active
- payment_method_id
- total_products, triggered_today, saved_amount
- referral_code, referred_by
- last_reminder_sent
- created_at, updated_at

### products

- id (SERIAL PK)
- user_id (FK → users)
- product_id, nm_id, title, image_url
- current_price, min_price, current_stock
- marketplace, status, is_monitored
- UNIQUE(user_id, product_id)

### transactions

- id (VARCHAR PK)
- user_id (FK → users)
- yookassa_payment_id (UNIQUE)
- amount, status, plan
- created_at, paid_at

## Indexes

```sql
CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
```

### Рекомендуемые дополнительные индексы

```sql
CREATE INDEX idx_products_marketplace ON products(user_id, marketplace);
CREATE INDEX idx_users_protection ON users(protection_enabled, subscription_active);
CREATE INDEX idx_products_monitored ON products(user_id, min_price) WHERE min_price > 0;
```

---

# ⚙️ DUAL BACKEND ANALYSIS

## Vercel API (`/api/index.ts`) — ACTIVE

**Плюсы:**

- ✅ Простота деплоя
- ✅ Интеграция с Vercel Postgres
- ✅ Vercel Cron
- ✅ Один файл — легко читать

**Минусы:**

- ⚠️ 1588 строк в одном файле
- ⚠️ API keys в plain text
- ⚠️ Rate limiter resets on cold start

## Firebase Functions (`/functions/src/`) — INACTIVE

**Плюсы:**

- ✅ Модульная архитектура
- ✅ Secret Manager для API keys
- ✅ Cloud Tasks для очередей
- ✅ Proper rate limiter class

**Минусы:**

- ❌ Не развёрнут
- ❌ Дублирует логику Vercel API
- ❌ Требует Firebase проект

## РЕКОМЕНДАЦИЯ

Выбрать **ОДНУ** платформу:

**Вариант A (Текущий):** Остаться на Vercel

- Удалить `/functions/` или перенести в `/archive/`
- Добавить шифрование API keys
- Перейти на Vercel KV для rate limiting

**Вариант B:** Мигрировать на Firebase

- Больше возможностей (Tasks, Pub/Sub, Secret Manager)
- Лучшая масштабируемость
- Требует перенос БД на Firestore

---

# 📋 CHECKLIST ДЛЯ PRODUCTION

## P0 — Критические (ДО релиза)

| #   | Task                                 | Status  |
| --- | ------------------------------------ | ------- |
| 1   | Telegram initData HMAC validation    | ✅ DONE |
| 2   | Production mode check (no demo user) | ✅ DONE |
| 3   | CORS restriction                     | ✅ DONE |
| 4   | Rate limiting                        | ✅ DONE |

## P1 — Высокий приоритет

| #   | Task                            | Status                  |
| --- | ------------------------------- | ----------------------- |
| 5   | Encrypt API keys in database    | ❌ TODO                 |
| 6   | Require BOT_TOKEN in production | ❌ TODO                 |
| 7   | Remove ADMIN_KEY from .env file | ❌ TODO                 |
| 8   | Add WB Sentinel defense         | ❌ TODO (Ozon only now) |

## P2 — Средний приоритет

| #   | Task                                  | Status  |
| --- | ------------------------------------- | ------- |
| 9   | Use Redis/Vercel KV for rate limiting | ❌ TODO |
| 10  | Add additional DB indexes             | ❌ TODO |
| 11  | Cleanup dual backend                  | ❌ TODO |
| 12  | Remove console.log in production      | ❌ TODO |

## P3 — Nice to have

| #   | Task                           | Status  |
| --- | ------------------------------ | ------- |
| 13  | Error monitoring (Sentry)      | ❌ TODO |
| 14  | Analytics (Amplitude/Mixpanel) | ❌ TODO |
| 15  | A/B testing infrastructure     | ❌ TODO |

---

# 🧪 TEST COMMANDS

## Health Check

```bash
curl https://neuro-guardian.vercel.app/api?action=health
```

## Get Plans

```bash
curl https://neuro-guardian.vercel.app/api?action=plans
```

## Manual Sentinel Run (requires ADMIN_KEY)

```bash
curl "https://neuro-guardian.vercel.app/api?action=check-prices&key=YOUR_ADMIN_KEY"
```

## Init Database (requires ADMIN_KEY)

```bash
curl -X POST https://neuro-guardian.vercel.app/api \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: YOUR_ADMIN_KEY" \
  -d '{"action": "init-db"}'
```

---

# 🏁 CONCLUSION

## Готовность к Production

| Критерий                   | Статус         |
| -------------------------- | -------------- |
| Core functionality working | ✅             |
| Security baseline          | ✅ (P0 fixed)  |
| Payment system             | ✅             |
| Auth system                | ✅             |
| Sentinel protection        | 🟡 (Ozon only) |
| Error handling             | ✅             |
| Monitoring                 | ❌             |

## ВЕРДИКТ

### 🟡 ГОТОВО К BETA ТЕСТИРОВАНИЮ

**Можно запускать** с ограниченной аудиторией при условии:

1. ✅ Все P0 проблемы исправлены
2. ⚠️ P1 проблемы документированы для пользователей
3. ⚠️ Мониторинг ручной (через логи)

**Для full production** требуется:

1. Шифрование API keys
2. WB Sentinel defense
3. Error monitoring (Sentry)
4. Redis rate limiting

---

_Аудит проведён: 2024-12-14T17:45:00_
_Автор: NeuroExpert Architect_
_Версия документа: 2.1.0_

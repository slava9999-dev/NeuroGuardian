# 🚀 NeuroGUARDIAN — Миграция на Vercel Postgres + YooKassa

## Обзор изменений

Проект мигрирован с Firebase на Vercel Native решения:

- **Database**: Firebase Firestore → **Vercel Postgres**
- **Functions**: Firebase Cloud Functions → **Vercel Serverless Functions**
- **Payments**: CloudPayments → **YooKassa**

---

## 📁 Новая структура API

```
api/
├── lib/
│   ├── db.ts           # Vercel Postgres операции
│   ├── telegram.ts     # Telegram auth validation
│   └── yookassa.ts     # YooKassa payment integration
├── cron/
│   └── daily-reset.ts  # Ежедневный сброс счётчиков
├── auth.ts             # POST /api/auth
├── create-payment.ts   # POST /api/create-payment
├── payment-webhook.ts  # POST /api/payment-webhook
├── products.ts         # GET/POST /api/products
├── settings.ts         # POST /api/settings
├── plans.ts            # GET /api/plans
├── health.ts           # GET /api/health
└── init-db.ts          # POST /api/init-db (admin only)
```

---

## 🗄️ SQL Schema

### users

```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY,              -- telegram_id
  username VARCHAR(255),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  api_key_wb TEXT,                    -- WB API Key
  api_key_ozon TEXT,                  -- Ozon API Key
  protection_enabled BOOLEAN DEFAULT false,
  defense_mode VARCHAR(50) DEFAULT 'zero_stock',
  subscription_plan VARCHAR(50),
  subscription_end TIMESTAMP,
  subscription_active BOOLEAN DEFAULT false,
  total_products INTEGER DEFAULT 0,
  triggered_today INTEGER DEFAULT 0,
  saved_amount DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### products

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  product_id VARCHAR(255) NOT NULL,   -- 'wb-123456' or 'ozon-789'
  nm_id BIGINT,                       -- WB article
  title VARCHAR(500) NOT NULL,
  current_price INTEGER NOT NULL,
  min_price INTEGER DEFAULT 0,        -- Stop-loss level
  current_stock INTEGER DEFAULT 0,
  marketplace VARCHAR(10) NOT NULL,   -- 'WB' or 'Ozon'
  status VARCHAR(50) DEFAULT 'active',
  UNIQUE(user_id, product_id)
);
```

### transactions

```sql
CREATE TABLE transactions (
  id VARCHAR(255) PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  yookassa_payment_id VARCHAR(255) UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  plan VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP
);
```

---

## 🔐 Environment Variables

Добавить в **Vercel Project Settings → Environment Variables**:

```env
# Vercel Postgres (автоматически при добавлении Postgres)
POSTGRES_URL=...

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token

# YooKassa
YOOKASSA_SHOP_ID=your_shop_id
YOOKASSA_SECRET_KEY=your_secret_key

# Admin
ADMIN_API_KEY=your_secret_key

# Cron (Vercel Cron Secret)
CRON_SECRET=...
```

---

## 💳 YooKassa Integration

### Планы подписки

| Plan   | Price | Duration | Max Products |
| ------ | ----- | -------- | ------------ |
| basic  | 499₽  | 30 дней  | 50           |
| pro    | 999₽  | 30 дней  | 500          |
| yearly | 9990₽ | 365 дней | 500          |

### Процесс оплаты

1. Frontend вызывает `POST /api/create-payment`
2. Backend создаёт платёж в YooKassa
3. Возвращается `confirmation_token` для виджета
4. Frontend показывает YooKassa Widget для ввода карты
5. После оплаты YooKassa отправляет webhook на `/api/payment-webhook`
6. Webhook активирует подписку пользователя

### Webhook URL для YooKassa

```
https://your-app.vercel.app/api/payment-webhook
```

---

## 🚀 Deployment Checklist

### 1. Vercel Postgres

```bash
# В Vercel Dashboard:
# Project → Storage → Create Database → Postgres
# Переменные POSTGRES_* будут добавлены автоматически
```

### 2. Инициализация БД

После деплоя вызовите:

```bash
curl -X POST https://your-app.vercel.app/api/init-db \
  -H "X-Admin-Key: your_admin_key"
```

### 3. YooKassa Setup

1. Зарегистрируйтесь на https://yookassa.ru
2. Получите Shop ID и Secret Key
3. Настройте webhook URL: `https://your-app.vercel.app/api/payment-webhook`
4. Добавьте переменные в Vercel

### 4. Telegram Bot

1. Создайте бота через @BotFather
2. Получите токен
3. Добавьте TELEGRAM_BOT_TOKEN в Vercel
4. Настройте Mini App URL

---

## 📡 API Endpoints

### Authentication

```
POST /api/auth
Body: { initData: "telegram_init_data" }
Response: { success: true, user: {...} }
```

### Products

```
GET /api/products
Headers: X-Init-Data: telegram_init_data
Response: { success: true, products: [...] }

POST /api/products
Body: { initData, productId, minPrice }
Response: { success: true }
```

### Payments

```
POST /api/create-payment
Body: { initData, planId, email?, savePaymentMethod? }
Response: { success: true, confirmationToken, confirmationUrl }

POST /api/payment-webhook
Body: YooKassa webhook payload
Response: { success: true }
```

### Settings

```
POST /api/settings
Body: { initData, protectionEnabled?, defenseMode?, marketplace?, apiKey? }
Response: { success: true }
```

### Plans

```
GET /api/plans
Response: { success: true, plans: [...] }
```

---

## 🔄 Migration from Firebase

| Old (Firebase)    | New (Vercel)           |
| ----------------- | ---------------------- |
| `/telegramAuth`   | `/api/auth`            |
| `/getProducts`    | `/api/products` (GET)  |
| `/updateMinPrice` | `/api/products` (POST) |
| `/updateSettings` | `/api/settings`        |
| `/createPayment`  | `/api/create-payment`  |
| `/paymentWebhook` | `/api/payment-webhook` |

---

## ✅ Преимущества миграции

1. **Бесплатно**: Vercel Hobby план включает Postgres и Serverless Functions
2. **Проще**: Один провайдер вместо Firebase + Google Cloud
3. **Быстрее**: Edge-оптимизация Vercel
4. **TypeScript**: Полная типизация API
5. **SQL**: Привычные SQL запросы вместо NoSQL

---

## 📊 Мониторинг

- **Vercel Dashboard**: Логи функций, метрики
- **Health Check**: `GET /api/health`
- **Postgres Dashboard**: В Vercel Storage

---

**Статус**: ✅ Готово к деплою

# NeuroGUARDIAN

> 🛡️ **Margin Defense System** — автоматическая защита селлеров от принудительных акций WB/Ozon

## Что это?

NeuroGUARDIAN — это "Kill Switch" система, которая мониторит цены ваших товаров на маркетплейсах и мгновенно реагирует при падении ниже заданного Stop-Loss уровня:

- **Zero Stock Mode**: Обнуляет остатки, чтобы товар не продавался по убыточной цене
- **Price Correction Mode**: Автоматически возвращает цену к минимальной

## Стек технологий

### Frontend (TWA — Telegram Web App)

- **React 18** + **Vite** + **TypeScript**
- **Tailwind CSS** — стилизация
- **Framer Motion** — анимации
- **Zustand** — state management
- **Zod** — валидация схем

### Backend (Serverless)

- **Firebase Cloud Functions** (Node.js 18)
- **Firestore** — база данных
- **Google Cloud Secret Manager** — хранение API ключей
- **Google Cloud Tasks** — очередь задач
- **Cloud Scheduler** — планировщик

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                     Telegram Mini App                            │
│                    (React + Tailwind)                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Firebase Cloud Functions                      │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Gatekeeper    │    API Sync     │         Sentinel            │
│   (Auth/Pay)    │   (WB/Ozon)     │    (Monitor/Defense)        │
└─────────────────┴─────────────────┴─────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
    ┌─────────────┐                 ┌─────────────┐
    │  Firestore  │                 │ Secret Mgr  │
    │   (Data)    │                 │ (API Keys)  │
    └─────────────┘                 └─────────────┘
```

## Быстрый старт

### 1. Frontend

```bash
cd frontend
npm install
npm run dev
```

Откройте http://localhost:5173

### 2. Backend (Firebase Functions)

```bash
cd functions
npm install
npm run build

# Запуск эмуляторов
firebase emulators:start
```

### 3. Деплой

```bash
# Frontend
cd frontend && npm run build

# Всё вместе
firebase deploy
```

## Конфигурация

### Frontend (.env.local)

```env
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_PROJECT_ID=neuroguardian
VITE_USE_EMULATORS=true
```

### Functions (Firebase Config)

```bash
firebase functions:config:set \
  telegram.bot_token="xxx" \
  cloudpayments.public_id="xxx" \
  cloudpayments.api_secret="xxx"
```

## API Endpoints

| Endpoint          | Метод | Описание                     |
| ----------------- | ----- | ---------------------------- |
| `/telegramAuth`   | POST  | Авторизация через Telegram   |
| `/paymentWebhook` | POST  | Webhook платежей             |
| `/saveApiKey`     | POST  | Сохранение API ключа WB/Ozon |
| `/getProducts`    | GET   | Список товаров               |
| `/updateSettings` | POST  | Обновление настроек          |
| `/updateMinPrice` | POST  | Установка Stop-Loss          |

## Модули

### Gatekeeper (Auth & Payment)

- Telegram WebApp HMAC-SHA256 валидация
- CloudPayments интеграция
- Subscription management

### API Sync

- WB Content API `/content/v2/get/cards/list`
- Ozon Seller API `/v2/product/list`
- Cursor-based pagination
- Rate limiting с exponential backoff

### Sentinel (Core Logic)

- **Dispatcher**: Cloud Scheduler каждые 2 минуты
- **Worker**: Cloud Tasks для каждого пользователя
- **Defense Protocol**: Zero Stock / Price Correction
- **Alerting**: Telegram уведомления

## Лицензия

MIT License

---

**NeuroGUARDIAN** — Защитите свою маржу! 🛡️

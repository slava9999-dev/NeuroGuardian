# 🔍 КРИТИЧЕСКИЙ АУДИТ АВТОМАТИЗАЦИИ

> **Дата:** 2026-01-01
> **Цель:** Определить что работает, что лишнее, что нужно для бизнеса

---

## 📊 ТЕКУЩАЯ АРХИТЕКТУРА АВТОМАТИЗАЦИИ

### Слой 1: Vercel Cron (PRODUCTION)

```
vercel.json → 1 cron job daily at 09:00
├── /api?action=check-prices → handleCheckPrices() → SentinelService
```

**Статус:** ✅ РАБОТАЕТ
**Проблема:** Hobby план = только 1 cron/день

### Слой 2: Inngest Functions (SERVERLESS QUEUE)

```
inngest-functions.ts → 4 функции
├── processMoEQuery — MoE intent classification
├── backgroundPriceCheck — Heavy price checking
├── scheduledSentinelCycle — Scheduled Sentinel
├── triggerMoEQuery — Queue trigger utility
```

**Статус:** ⚠️ РАЗВЁРНУТО, НЕ ИСПОЛЬЗУЕТСЯ
**Проблема:** Требует Inngest Cloud ($) или self-hosted Inngest

### Слой 3: n8n Workflows (SELF-HOSTED/DOCKER)

```
n8n-workflows/ → 19 JSON файлов (!)
├── 8 основных workflows
├── 11 дубликатов/вариаций
```

**Статус:** ❌ ИЗБЫТОЧНО
**Проблема:**

- Требует Docker/VPS
- Дублирует функционал Vercel + Telegram
- Сложность поддержки
- Нет связи с production

### Слой 4: Telegram Bot (WEBHOOK)

```
telegram.ts →
├── handleStartCommand, /help, /settings, /status
├── handleUserMessage → orchestrateV4 (AI Agent)
├── handleCallbackQuery → apply_price, ignore_alert, etc.
```

**Статус:** ✅ РАБОТАЕТ
**Это ГЛАВНЫЙ интерфейс пользователя!**

### Слой 5: AI Agent Tools (ORCHESTRATOR V4)

```
tool-executors.ts → 13 инструментов
├── get_products — ✅ База данных
├── get_sales_stats — ✅ WB/Ozon API
├── get_orders — ✅ WB/Ozon API
├── get_warehouse_stocks — ✅ WB/Ozon API
├── calculate_unit_economics — ✅ Калькулятор
├── get_abc_analysis — ✅ Аналитика + API
├── get_stock_forecast — ✅ Прогноз
├── get_marketplace_info — ✅ Справочник
├── search_web — ✅ Serper API
├── get_marketplace_accounts — ✅ База данных
├── update_prices — ⚠️ CONFIRMATION REQUIRED
├── update_stocks — ⚠️ CONFIRMATION REQUIRED
├── set_stop_loss — ⚠️ CONFIRMATION REQUIRED
├── bulk_protect_products — ⚠️ CONFIRMATION REQUIRED
├── get_system_logs — ✅ Admin only
```

**Статус:** ✅ PRODUCTION READY

### Слой 6: MoE Router (HYBRID AI)

```
moe-router.ts → Intent Classification
├── Local: Qwen2.5-1.5B → Для stats/simple интентов
├── Cloud: Gemini Flash → Для complex интентов
├── Fallback: Rule-based patterns
```

**Статус:** ⚠️ Local LLM требует GPU Docker stack
**Проблема:** Избыточная сложность для MVP

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1. ИЗБЫТОЧНОСТЬ n8n

| Workflow               | Функция               | Дублирует                             |
| ---------------------- | --------------------- | ------------------------------------- |
| Product Sync           | Синхронизация товаров | `sync-products` API endpoint          |
| Sentinel Price Defense | Мониторинг цен        | `check-prices` cron + SentinelService |
| Health Monitor         | Проверка здоровья     | `/api?action=health` endpoint         |
| Analytics Report       | Отчёты                | Agent tools (get_sales_stats, etc.)   |
| User Notifications     | Уведомления           | Telegram handlers                     |
| AI Ops Agent           | AI запросы            | Agent V4 orchestrator                 |

**ВЫВОД:** n8n дублирует 100% функционала, который уже есть в Vercel + Telegram

### 2. ИЗБЫТОЧНОСТЬ Inngest

- Для Vercel Hobby: только 1 cron
- Inngest Cloud: платный сервис
- Self-hosted: требует infra
- **Использование:** 0% в production

### 3. ИЗБЫТОЧНОСТЬ MоE Router

- Local LLM: требует GPU Docker stack (~5GB+ RAM)
- Для 100 пользователей MVP: overkill
- Groq llama-3.3-70b-versatile справляется отлично

---

## ✅ ЧТО РЕАЛЬНО РАБОТАЕТ И НУЖНО

### Production Stack (МИНИМАЛЬНЫЙ)

```
1. Vercel (бесплатный Hobby)
   ├── API endpoints (17 handlers)
   ├── 1 cron job (check-prices daily at 09:00)
   └── Static frontend

2. Telegram Bot (бесплатный)
   ├── Webhook → /api?action=telegram-webhook
   ├── Commands: /start, /help, /settings, /status
   ├── AI Agent через orchestrateV4
   └── Smart Actions (callbacks для кнопок)

3. Neon PostgreSQL (бесплатный Free tier)
   ├── users, products, orders, analytics
   ├── marketplace_accounts, api_keys
   └── price_rules, sentinel alerts

4. Groq (бесплатный Free tier)
   └── llama-3.3-70b-versatile для AI Agent

5. Redis/KV (опционально)
   └── Rate limiting, sessions
```

**Стоимость:** $0/месяц
**Возможности:** Полный функционал для 1000+ пользователей

---

## 📝 РЕКОМЕНДАЦИИ

### 🗑 УДАЛИТЬ (не нужно для бизнеса)

1. **n8n-workflows/** — Весь каталог (19 файлов)
2. **docker/** — GPU stack для MoE (не используется)
3. **inngest-functions.ts** — Заменяется простыми cron
4. **moe-router.ts** — Избыточная сложность

### ✂️ УПРОСТИТЬ

1. **MoE → Direct Groq** — Убрать local LLM, всё через Groq
2. **Inngest → Vercel Cron** — Достаточно 1-2 cron jobs
3. **n8n → Telegram** — Все уведомления через бот

### 🔧 УЛУЧШИТЬ (для бизнеса)

1. **Sentinel hourly** → Требует Vercel Pro ($20/мес) или QStash (бесплатный)
2. **YooKassa** → Платежи для монетизации
3. **Onboarding Flow** → Подключение API ключей через Telegram

---

## 🎯 ЦЕЛЕВАЯ АРХИТЕКТУРА (PRODUCTION MVP)

```
┌─────────────────────────────────────────────────────────────┐
│                     TELEGRAM BOT                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ /start   │ │ Messages │ │ Callbacks│ │ Alerts   │       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│       │            │            │            │              │
└───────┼────────────┼────────────┼────────────┼──────────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL API                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 api/index.ts                          │  │
│  │  ├── telegram-webhook → Agent V4 → Groq              │  │
│  │  ├── check-prices (cron) → Sentinel → Telegram       │  │
│  │  ├── products, orders, analytics                     │  │
│  │  └── payments → YooKassa                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
        │                            │
        ▼                            ▼
┌───────────────────┐    ┌───────────────────┐
│   NEON POSTGRES   │    │   GROQ (FREE)     │
│   (Free tier)     │    │   llama-3.3-70b   │
└───────────────────┘    └───────────────────┘
```

**Это всё что нужно для MVP с 1000+ пользователей!**

---

## 📋 ACTION PLAN

### Фаза 1: Очистка (сегодня)

- [ ] Архивировать n8n-workflows/ → .agent/archive/
- [ ] Архивировать docker/gpu/ → .agent/archive/
- [ ] Удалить неиспользуемые imports в api/index.ts
- [ ] Упростить moe handlers (оставить health check)

### Фаза 2: Hourly Cron (optional)

- [ ] Оценить QStash (Upstash) — бесплатный tier
- [ ] Или добавить /api?action=manual-check для ручного запуска

### Фаза 3: Монетизация

- [ ] YooKassa интеграция
- [ ] Subscription logic
- [ ] Trial period

---

## 💰 ЭКОНОМИКА РЕШЕНИЯ

| Компонент | Бесплатно    | Pro               |
| --------- | ------------ | ----------------- |
| Vercel    | ✅ Hobby     | $20/мес (3 crons) |
| Neon DB   | ✅ 0.5GB     | $19/мес           |
| Groq      | ✅ 30rpm     | -                 |
| Telegram  | ✅ Unlimited | -                 |
| n8n       | ❌ Не нужен  | -                 |
| Inngest   | ❌ Не нужен  | -                 |
| Local LLM | ❌ Не нужен  | -                 |

**MVP стоимость: $0/месяц**
**Production с hourly: $20/месяц (Vercel Pro)**

---

> **ВЫВОД:**
> Проект переусложнён. n8n, Inngest, MoE с local LLM — всё это не нужно для бизнес-MVP.
> Telegram + Vercel + Neon + Groq = полный стек за $0.

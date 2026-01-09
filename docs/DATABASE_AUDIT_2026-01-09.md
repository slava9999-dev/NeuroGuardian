# 🔍 Критический аудит базы данных — 2026-01-09

## 📋 Обзор

Полный аудит схемы БД, миграций и кода, работающего с БД.

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ (Исправлены)

### 1. ❌ Несуществующая колонка `telegram_id`

**Проблема:** Код пытался читать `telegram_id` из таблицы `users`, но такой колонки не существует!

**Схема БД:**

```sql
-- users.id BIGINT PRIMARY KEY — это и есть Telegram user ID
-- Отдельной колонки telegram_id НЕТ
```

**Затронутые файлы:**

- `src/api-lib/services/notifications.ts` — `getUserChatId()`
- `api/cron/send-daily-report.ts` — SQL запрос

**Последствия:**

- Daily Digest **НИКОГДА не отправлялся** (условие `telegram_id IS NOT NULL` всегда false)
- Уведомления пользователям не работали

**Исправление:** ✅ Заменено на `id` напрямую

### 2. ⚠️ Дублирование номера миграции 008

**Было:**

```
008_add_buyer_price_columns.sql
008_add_price_buffer_settings.sql  ← Два файла с №008!
```

**Исправление:** ✅ Переименовано в `018_add_buyer_price_columns.sql`

---

## 🟡 НЕКРИТИЧНЫЕ НЕСООТВЕТСТВИЯ

### 3. Типы TypeScript ≠ Миграции

Некоторые поля в `types.ts` отсутствуют в базовой миграции `002_create_products.sql`:

| Поле в types.ts                | Есть в миграциях?                        |
| ------------------------------ | ---------------------------------------- |
| `offer_id`                     | ✅ 007_add_offer_id.sql                  |
| `account_id`                   | ❓ Не найдено                            |
| `official_sku`                 | ✅ 009_add_cost_price.sql (supplier_sku) |
| `cost_price`                   | ✅ 009_add_cost_price.sql                |
| `category`                     | ✅ 009_add_cost_price.sql                |
| `card_discount_buffer`         | ✅ 008_add_price_buffer_settings.sql     |
| `estimated_buyer_price`        | ✅ 018_add_buyer_price_columns.sql       |
| `marketplace_discount_percent` | ✅ 018_add_buyer_price_columns.sql       |

---

## 📊 Схема таблиц (актуальная)

### users

```sql
id BIGINT PRIMARY KEY  -- Telegram user ID
username VARCHAR(255)
first_name VARCHAR(255) NOT NULL
last_name VARCHAR(255)
photo_url TEXT
is_active BOOLEAN DEFAULT true
api_key_wb TEXT
api_key_ozon TEXT
ozon_client_id VARCHAR(255)
protection_enabled BOOLEAN DEFAULT false
defense_mode VARCHAR(50) DEFAULT 'zero_stock'
subscription_plan VARCHAR(50) DEFAULT 'trial'
subscription_end TIMESTAMP
subscription_active BOOLEAN DEFAULT false
payment_method_id VARCHAR(255)
total_products INTEGER DEFAULT 0
triggered_today INTEGER DEFAULT 0
saved_amount DECIMAL(12, 2) DEFAULT 0
referral_code VARCHAR(50) UNIQUE
referred_by VARCHAR(50)
last_reminder_sent TIMESTAMP
price_buffer_percent INTEGER DEFAULT 5  -- Миграция 008
warning_threshold_percent INTEGER DEFAULT 10  -- Миграция 008
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### products

```sql
id SERIAL PRIMARY KEY
user_id BIGINT NOT NULL REFERENCES users(id)
product_id VARCHAR(255) NOT NULL
nm_id BIGINT
offer_id VARCHAR(255)  -- Миграция 007
title VARCHAR(500) NOT NULL
image_url TEXT
current_price INTEGER NOT NULL
estimated_buyer_price INTEGER  -- Миграция 018
marketplace_discount_percent DECIMAL(5,2)  -- Миграция 018
min_price INTEGER DEFAULT 0
current_stock INTEGER DEFAULT 0
marketplace VARCHAR(10) NOT NULL
status VARCHAR(50) DEFAULT 'active'
is_monitored BOOLEAN DEFAULT true
card_discount_buffer INTEGER DEFAULT 0  -- Миграция 008
cost_price INTEGER DEFAULT 0  -- Миграция 009
supplier_sku VARCHAR(100)  -- Миграция 009
category VARCHAR(255)  -- Миграция 009
pending_price INTEGER
pending_task_id BIGINT
pending_status VARCHAR(20)
pending_since TIMESTAMP
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
UNIQUE(user_id, product_id)
```

---

## ✅ Проверенные компоненты

| Компонент               | Статус        | Примечание                         |
| ----------------------- | ------------- | ---------------------------------- |
| Миграции порядок        | ✅ Исправлен  | 008 дублирование устранено         |
| getUserChatId           | ✅ Исправлен  | Использует id напрямую             |
| Daily Report CRON       | ✅ Исправлен  | Больше не фильтрует по telegram_id |
| Диагностические скрипты | ✅ Исправлены | diagnose-sentinel-prices.ts        |
| Типы DBUser             | ✅ Проверены  | Соответствуют схеме                |
| Типы DBProduct          | ✅ Проверены  | Соответствуют схеме + миграции     |

---

## 📝 Рекомендации

1. **Проверить production БД** — убедиться что все миграции применены
2. **Добавить `account_id`** — если планируется мульти-аккаунт
3. **Запустить Daily Report вручную** — проверить что теперь работает

---

## 🔧 Изменённые файлы

- `src/api-lib/services/notifications.ts` — исправлен getUserChatId
- `api/cron/send-daily-report.ts` — исправлен SQL запрос
- `scripts/diagnose-sentinel-prices.ts` — исправлен SQL запрос
- `migrations/018_add_buyer_price_columns.sql` — переименован из 008

---

**Дата аудита:** 2026-01-09
**Автор:** Antigravity Agent

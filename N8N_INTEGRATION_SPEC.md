# NeuroGUARDIAN — n8n Integration Technical Specification

## Полное техническое задание для интеграции с n8n

**Версия:** 1.0
**Дата:** 2025-12-26
**Статус:** В разработке

---

## 📋 Обзор системы

NeuroGUARDIAN — это система защиты цен для маркетплейсов (Ozon, Wildberries) с AI-агентом.

### Текущая архитектура:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Telegram Bot   │────▶│  Vercel API     │────▶│  Marketplaces   │
│  (WebApp)       │     │  (Backend)      │     │  Ozon / WB      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Целевая архитектура с n8n:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Telegram Bot   │────▶│      n8n        │────▶│  Vercel API     │
│  (WebApp)       │     │  (Orchestrator) │     │  (Backend)      │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                        ┌────────▼────────┐     ┌────────▼────────┐
                        │   Monitoring    │     │  Marketplaces   │
                        │   Dashboard     │     │  Ozon / WB      │
                        └─────────────────┘     └─────────────────┘
```

---

## 🎯 Workflows для создания

### 1. ✅ Sentinel Workflow (ГОТОВ)

**Файл:** `n8n-workflows/sentinel-workflow.json`
**Триггер:** Cron каждые 5 минут
**Функции:**

- Проверка цен всех защищённых товаров
- Обнаружение нарушений (цена ниже min_price)
- Выполнение защитных действий (price_correction / zero_stock)
- Отправка уведомлений в Telegram
- Логирование результатов в API

---

### 2. 🔧 AI Agent Workflow (СОЗДАТЬ)

**Файл:** `n8n-workflows/agent-workflow.json`
**Триггер:** Webhook от Telegram WebApp
**Функции:**

#### Входные данные:

```json
{
  "user_id": "7548070478",
  "message": "Проанализируй конкурентов для моего товара",
  "context": { "product_id": "123", "marketplace": "ozon" }
}
```

#### Nodes:

1. **Webhook Trigger** — получение запроса
2. **Validate User** — проверка авторизации
3. **Parse Intent** — определение намерения (OpenAI)
4. **Router** — маршрутизация по типу запроса:
   - `analyze_competitors` → Competitor Analysis Sub-workflow
   - `get_products` → Products API
   - `update_prices` → Price Update (с подтверждением)
   - `search_web` → Web Search (Serper)
   - `general_question` → OpenAI Chat
5. **Execute Tools** — выполнение инструментов
6. **Format Response** — форматирование ответа
7. **Send Response** — возврат через webhook

#### Поддерживаемые инструменты (Tools):

| Tool                  | Описание                     | API Endpoint                      |
| --------------------- | ---------------------------- | --------------------------------- |
| `get_products`        | Получить товары пользователя | `/api?action=get-products`        |
| `get_product_details` | Детали товара                | `/api?action=product-details`     |
| `search_web`          | Поиск в интернете            | Serper API                        |
| `analyze_competitors` | Анализ конкурентов           | `/api?action=analyze-competitors` |
| `update_prices`       | Обновить цены                | `/api?action=update-prices`       |
| `set_stop_loss`       | Установить защиту            | `/api?action=set-stop-loss`       |
| `get_sales_stats`     | Статистика продаж            | Ozon/WB API                       |

---

### 3. 🔧 Monitoring Workflow (СОЗДАТЬ)

**Файл:** `n8n-workflows/monitoring-workflow.json`
**Триггер:** Cron каждые 15 минут
**Функции:**

- Проверка здоровья API
- Мониторинг подписок пользователей
- Отслеживание ошибок
- Сбор метрик

#### Nodes:

1. **Schedule Trigger** — каждые 15 минут
2. **Health Check** — проверка `/api?action=health`
3. **Check Subscriptions** — истекающие подписки
4. **Check Errors** — ошибки за период
5. **Aggregate Metrics** — сбор статистики
6. **Send Report** — отправка в Telegram (если есть проблемы)

---

### 4. 🔧 Sync Workflow (СОЗДАТЬ)

**Файл:** `n8n-workflows/sync-workflow.json`
**Триггер:** Cron каждый час
**Функции:**

- Синхронизация товаров с маркетплейсами
- Обновление цен в базе
- Обновление остатков

#### Nodes:

1. **Schedule Trigger** — каждый час
2. **Get Active Users** — пользователи с подпиской
3. **Loop Users** — для каждого пользователя:
   - Sync Ozon Products
   - Sync WB Products
4. **Update Database** — обновление в PostgreSQL
5. **Log Results** — логирование

---

### 5. 🔧 Analytics Workflow (СОЗДАТЬ)

**Файл:** `n8n-workflows/analytics-workflow.json`
**Триггер:** Cron раз в день (00:00)
**Функции:**

- Ежедневная статистика
- Отчёт по защищённым товарам
- Сохранённые деньги

---

## 🔐 Переменные окружения

Все workflows используют переменные из `.env.n8n`:

| Переменная           | Описание       | Использование                       |
| -------------------- | -------------- | ----------------------------------- |
| `API_URL`            | URL бэкенда    | `https://neuro-guardian.vercel.app` |
| `CRON_SECRET`        | Секрет для API | Authorization header                |
| `TELEGRAM_BOT_TOKEN` | Токен бота     | Отправка сообщений                  |
| `ADMIN_CHAT_ID`      | ID админа      | Алерты                              |
| `OPENAI_API_KEY`     | Ключ OpenAI    | AI Agent                            |
| `SERPER_API_KEY`     | Ключ Serper    | Web Search                          |

---

## 📡 API Endpoints

### Существующие endpoints (backend):

| Endpoint                             | Method | Auth     | Описание        |
| ------------------------------------ | ------ | -------- | --------------- |
| `/api?action=check-prices`           | GET    | Bearer   | Проверка цен    |
| `/api?action=agent`                  | POST   | initData | AI Agent запрос |
| `/api?action=get-products`           | GET    | initData | Получить товары |
| `/api?action=sync-products`          | POST   | Bearer   | Синхронизация   |
| `/api?action=health`                 | GET    | -        | Health check    |
| `/api?action=sentinel-status`        | GET    | initData | Статус Sentinel |
| `/api?action=defense-history`        | GET    | initData | История защиты  |
| `/api?action=update-sentinel-status` | POST   | Bearer   | Обновить статус |
| `/api?action=log-defense`            | POST   | Bearer   | Лог действия    |
| `/api?action=bulk-log-defense`       | POST   | Bearer   | Массовый лог    |

---

## 🛠️ Технические требования

### n8n Setup:

- **Версия:** 2.1.4+
- **Database:** SQLite (локально) / PostgreSQL (production)
- **Docker:** Обязательно
- **Память:** 2GB+ RAM

### Интеграция с существующим кодом:

1. Backend API остаётся на Vercel
2. n8n выступает как orchestrator
3. Frontend общается с n8n webhook для AI Agent
4. Sentinel работает через cron в n8n

---

## 📊 Мониторинг и логирование

### В n8n:

- Все выполнения сохраняются в базу
- Просмотр в Executions tab
- Алерты через Telegram

### В Vercel:

- Логи в Vercel Dashboard
- KV для real-time статуса

---

## 🚀 План реализации

### Фаза 1: Базовая интеграция (Готово)

- [x] Docker setup для n8n
- [x] Environment variables
- [x] Sentinel Workflow
- [x] Auto-import script

### Фаза 2: AI Agent (В работе)

- [ ] Webhook endpoint
- [ ] OpenAI integration
- [ ] Tool execution nodes
- [ ] Response formatting

### Фаза 3: Мониторинг

- [ ] Health check workflow
- [ ] Subscription alerts
- [ ] Error tracking

### Фаза 4: Синхронизация

- [ ] Products sync workflow
- [ ] Price updates
- [ ] Stock updates

### Фаза 5: Аналитика

- [ ] Daily reports
- [ ] Statistics aggregation
- [ ] Dashboard integration

---

## 📝 Примечания

1. **Безопасность:** Все секреты хранятся в `.env.n8n` (в .gitignore)
2. **Масштабирование:** При росте нагрузки можно перейти на n8n Cloud
3. **Резервирование:** Workflows экспортируются в JSON для бэкапа

---

## 🔗 Связанные файлы

- `docker-compose.n8n.yml` — Docker конфигурация
- `scripts/import-n8n-workflow.cjs` — Автоимпорт workflows
- `scripts/master-to-n8n.cjs` — Синхронизация переменных
- `n8n-workflows/` — Директория с JSON workflows

---

_Документ создан: 2025-12-26_
_Автор: NeuroGUARDIAN Development Team_

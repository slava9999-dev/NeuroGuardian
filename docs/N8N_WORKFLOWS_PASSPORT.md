# N8N Workflows Passport — ТЗ v2.0 Production

> Документация автоматизаций согласно требованиям ТЗ v2.0 Production, раздел 4

---

## 📋 Общий обзор

| #   | Workflow                 | Триггер          | SLA             | Статус   |
| --- | ------------------------ | ---------------- | --------------- | -------- |
| 1   | Sentinel - Price Defense | 5 мин (cron)     | 99.9% uptime    | ✅ Ready |
| 2   | Product Sync             | 6 часов (cron)   | 100% completion | ✅ Ready |
| 3   | Analytics Report         | 00:00 MSK (cron) | Daily delivery  | ✅ Ready |
| 4   | Health Monitor           | 1 час (cron)     | <5 min response | ✅ Ready |
| 5   | User Notifications       | 12 часов (cron)  | >98% delivery   | ✅ Ready |
| 6   | Agent Dashboard          | Webhook          | Real-time       | ✅ Ready |

---

## 1️⃣ Sentinel - Price Defense

### Паспорт автоматизации

| #   | Параметр            | Значение                                                                                                                                                                       |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Название / ID**   | `sentinel-workflow` / Sentinel - Price Defense                                                                                                                                 |
| 2   | **Триггер**         | Cron: `*/5 * * * *` (каждые 5 минут)                                                                                                                                           |
| 3   | **Входы**           | `CRON_SECRET`, `API_URL`, `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID`                                                                                                                |
| 4   | **Шаги**            | 1. HTTP GET /api?action=check-prices<br>2. Filter violations<br>3. Execute defense (zero_stock/price_fix)<br>4. Log to DB via POST bulk-log-defense<br>5. Send Telegram report |
| 5   | **Выходы**          | DB: `sentinel_logs` записи, Telegram: отчет о защите                                                                                                                           |
| 6   | **Идемпотентность** | По `product_id + timestamp` — дубли игнорируются в БД                                                                                                                          |
| 7   | **Ретраи и DLQ**    | 3 retry с exponential backoff, DLQ через Telegram alert                                                                                                                        |
| 8   | **Алёрты**          | `ADMIN_CHAT_ID`: критические ошибки, >5 нарушений за цикл                                                                                                                      |
| 9   | **SLA**             | Время выполнения <30 сек, uptime 99.9%                                                                                                                                         |
| 10  | **Тест-сценарий**   | Manual trigger → verify DB record → check Telegram message                                                                                                                     |

### Endpoints используемые

```
GET  /api?action=check-prices&include_details=true
POST /api?action=bulk-log-defense
POST https://api.telegram.org/bot{token}/sendMessage
```

### Критерии успеха

- ✅ Цикл завершается за <30 секунд
- ✅ Все нарушения логируются в `sentinel_logs`
- ✅ Telegram уведомление доставлено
- ✅ При ошибке API — fallback в уведомление

---

## 2️⃣ Product Sync

### Паспорт автоматизации

| #   | Параметр            | Значение                                                                                                                                              |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Название / ID**   | `sync-workflow` / Product Sync                                                                                                                        |
| 2   | **Триггер**         | Cron: `0 */6 * * *` (каждые 6 часов)                                                                                                                  |
| 3   | **Входы**           | `CRON_SECRET`, `API_URL`, `TELEGRAM_BOT_TOKEN`                                                                                                        |
| 4   | **Шаги**            | 1. GET admin-list-users<br>2. Loop each user<br>3. POST sync-products (WB)<br>4. POST sync-products (Ozon)<br>5. Aggregate results<br>6. Send summary |
| 5   | **Выходы**          | DB: updated `products` table, Telegram: sync report                                                                                                   |
| 6   | **Идемпотентность** | `ON CONFLICT UPDATE` — повторный sync безопасен                                                                                                       |
| 7   | **Ретраи и DLQ**    | 2 retry на user level, продолжить при ошибке одного user                                                                                              |
| 8   | **Алёрты**          | При >50% failed syncs — critical alert                                                                                                                |
| 9   | **SLA**             | 100% completion (partial success allowed)                                                                                                             |
| 10  | **Тест-сценарий**   | Manual trigger → verify DB products count → check Telegram                                                                                            |

### Endpoints используемые

```
GET  /api?action=admin-list-users
POST /api?action=sync-products&marketplace=WB
POST /api?action=sync-products&marketplace=Ozon
```

---

## 3️⃣ Analytics Report

### Паспорт автоматизации

| #   | Параметр            | Значение                                                                 |
| --- | ------------------- | ------------------------------------------------------------------------ |
| 1   | **Название / ID**   | `analytics-workflow` / Analytics Report                                  |
| 2   | **Триггер**         | Cron: `0 0 * * *` (полночь MSK)                                          |
| 3   | **Входы**           | `CRON_SECRET`, `API_URL`, `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID`          |
| 4   | **Шаги**            | 1. GET get-analytics<br>2. Format markdown report<br>3. Send to Telegram |
| 5   | **Выходы**          | Telegram: daily analytics report                                         |
| 6   | **Идемпотентность** | Stateless — повторный запуск просто отправит новый отчет                 |
| 7   | **Ретраи и DLQ**    | 3 retry, при fail — отправить "Analytics unavailable"                    |
| 8   | **Алёрты**          | Если 3 дня подряд нет отчета — manual review                             |
| 9   | **SLA**             | Delivery by 00:05 MSK                                                    |
| 10  | **Тест-сценарий**   | Manual trigger → verify Telegram message format                          |

### Содержимое отчета

```
📊 Daily Analytics Report
━━━━━━━━━━━━━━━━━━━━
👥 Active subscriptions: X
📦 Protected products: Y
🛡️ Sentinel triggers: Z
💰 Money saved: ₽N
```

---

## 4️⃣ Health Monitor

### Паспорт автоматизации

| #   | Параметр            | Значение                                                                                                  |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | **Название / ID**   | `monitoring-workflow` / Health Monitor                                                                    |
| 2   | **Триггер**         | Cron: `0 * * * *` (каждый час)                                                                            |
| 3   | **Входы**           | `API_URL`, `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID`                                                          |
| 4   | **Шаги**            | 1. GET /api?action=health<br>2. GET get-system-metrics<br>3. Check thresholds<br>4. Send alerts if needed |
| 5   | **Выходы**          | Telegram alerts (only on issues)                                                                          |
| 6   | **Идемпотентность** | Stateless health check                                                                                    |
| 7   | **Ретраи и DLQ**    | 5 retry (API down = alert)                                                                                |
| 8   | **Алёрты**          | ❌ API down, ⚠️ Sentinel stuck, 🔴 High error rate                                                        |
| 9   | **SLA**             | Alert within 5 min of issue detection                                                                     |
| 10  | **Тест-сценарий**   | Stop API → verify alert received in <5 min                                                                |

### Алерты

| Условие                         | Severity | Сообщение                       |
| ------------------------------- | -------- | ------------------------------- |
| API недоступен                  | Critical | ❌ API is DOWN                  |
| Sentinel >10 min без активности | Warning  | ⚠️ Sentinel may be stuck        |
| >5 ошибок за час                | High     | 🔴 High error rate detected     |
| Подписки истекают сегодня       | Info     | 📅 X subscriptions expire today |

---

## 5️⃣ User Notifications

### Паспорт автоматизации

| #   | Параметр            | Значение                                                                                                                      |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Название / ID**   | `notifications-workflow` / User Notifications                                                                                 |
| 2   | **Триггер**         | Cron: `0 9,21 * * *` (09:00 и 21:00 MSK)                                                                                      |
| 3   | **Входы**           | `API_URL`, `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID`, `WEBAPP_URL`                                                                |
| 4   | **Шаги**            | 1. GET get-system-metrics (expiring subs)<br>2. Filter by expiry range<br>3. Send personalized messages<br>4. Report to admin |
| 5   | **Выходы**          | Telegram messages to users, admin summary                                                                                     |
| 6   | **Идемпотентность** | Cooldown по user_id (не чаще 1 раза в 12ч)                                                                                    |
| 7   | **Ретраи и DLQ**    | 2 retry per user, skip on persistent fail                                                                                     |
| 8   | **Алёрты**          | >10% delivery failure — admin alert                                                                                           |
| 9   | **SLA**             | >98% message delivery rate                                                                                                    |
| 10  | **Тест-сценарий**   | Create test user with expiring sub → verify message                                                                           |

### Шаблоны сообщений

```
🔴 Срочно: Подписка истекает сегодня!
Продлите сейчас, чтобы не потерять защиту цен.
[Продлить подписку]

🟡 Напоминание: Подписка истекает через X дней
Используйте промокод RENEW10 для скидки 10%!
[Продлить подписку]
```

---

## 6️⃣ Agent Dashboard

### Паспорт автоматизации

| #   | Параметр            | Значение                                                                        |
| --- | ------------------- | ------------------------------------------------------------------------------- |
| 1   | **Название / ID**   | `agent-dashboard-workflow` / Agent Dashboard                                    |
| 2   | **Триггер**         | Webhook: POST /webhook/agent-dashboard                                          |
| 3   | **Входы**           | `N8N_WEBHOOK_SECRET`, `API_URL`                                                 |
| 4   | **Шаги**            | 1. Validate secret<br>2. Parse action<br>3. Execute command<br>4. Return result |
| 5   | **Выходы**          | JSON response with action result                                                |
| 6   | **Идемпотентность** | Request ID dedup (optional)                                                     |
| 7   | **Ретраи и DLQ**    | Client-side retry                                                               |
| 8   | **Алёрты**          | High latency >5s — log warning                                                  |
| 9   | **SLA**             | Response time <2s                                                               |
| 10  | **Тест-сценарий**   | POST test action → verify response                                              |

### Поддерживаемые actions

- `check_health` — проверка состояния
- `trigger_sync` — ручной запуск синхронизации
- `get_metrics` — получение метрик
- `manual_defense` — ручная защита товара

---

## ✅ Checklist готовности

### Перед активацией

- [ ] Все 6 workflow JSON файлов импортированы
- [ ] Environment variables настроены в n8n
- [ ] `CRON_SECRET` совпадает с Vercel env
- [ ] `TELEGRAM_BOT_TOKEN` корректный
- [ ] `ADMIN_CHAT_ID` корректный
- [ ] Webhook URL доступен извне (для Agent Dashboard)

### После активации

- [ ] Sentinel выполняется каждые 5 мин (check logs)
- [ ] Health Monitor отчитывается (first alert or "healthy")
- [ ] Тестовый Product Sync успешен
- [ ] Analytics Report доставлен в полночь
- [ ] Notification delivery test passed

---

## 🔧 Troubleshooting

### Workflow не запускается

1. Проверить: `Active` toggle включен (зеленый)
2. Проверить: Cron expression корректный
3. Проверить: Credentials настроены

### API возвращает 401

1. Проверить: `CRON_SECRET` в n8n совпадает с Vercel
2. Проверить: Header `Authorization: Bearer {secret}`

### Telegram не доставляет

1. Проверить: Bot token валидный (`/getMe` работает)
2. Проверить: Chat ID корректный (number, с `-` для групп)
3. Проверить: Bot добавлен в чат и имеет права

---

_NeuroGUARDIAN n8n Automation Passports_
_TZ v2.0 Production Compliant_
_Generated: 2024-12-29_

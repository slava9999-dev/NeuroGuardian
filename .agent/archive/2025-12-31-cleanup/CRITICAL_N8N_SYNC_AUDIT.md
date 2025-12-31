# 🔴 КРИТИЧЕСКИЙ АУДИТ СИНХРОНИЗАЦИИ С N8N

> **Дата:** 2025-12-30 00:39 MSK  
> **Статус:** ⚠️ ТРЕБУЕТ ВНИМАНИЯ  
> **Аудитор:** Antigravity AI

---

## 📊 СВОДКА

| Метрика                 | Значение               | Статус      |
| ----------------------- | ---------------------- | ----------- |
| Workflows в репозитории | 11                     | ✅          |
| Workflows в n8n         | 9                      | ⚠️          |
| Активные workflows      | **0**                  | 🔴 КРИТИЧНО |
| Workflows с ошибками    | 5/9                    | 🔴 КРИТИЧНО |
| API endpoints для n8n   | 5 выделенных + 8 общих | ✅          |
| Environment sync        | ⚠️ Требует проверки    | ⚠️          |

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1. ВСЕ WORKFLOWS ДЕАКТИВИРОВАНЫ!

**Статус:** Ни один из 9 workflows не активен — автоматизация НЕ РАБОТАЕТ!

```
| Workflow                      | Статус      | Последнее выполнение |
|-------------------------------|-------------|----------------------|
| Product Sync                  | ⚪ INACTIVE | ✅ Success (23:55)   |
| Sentinel - Price Defense      | ⚪ INACTIVE | ❌ Error (23:57)     |
| Health Monitor                | ⚪ INACTIVE | ❌ Error (23:54)     |
| Analytics Report              | ⚪ INACTIVE | ✅ Success (23:54)   |
| Ops Center                    | ⚪ INACTIVE | — Не запускался      |
| AI Ops Agent                  | ⚪ INACTIVE | — Не запускался      |
| Unit Economics Monitor        | ⚪ INACTIVE | ❌ Error (23:54)     |
| AI Agent Dashboard            | ⚪ INACTIVE | ❌ Error (23:56)     |
| User Notifications            | ⚪ INACTIVE | ❌ Error (23:54)     |
```

### 2. ОШИБКИ В КРИТИЧЕСКИХ WORKFLOWS

5 из 9 workflows завершились с ошибками:

- **Sentinel** — КРИТИЧЕСКИЙ workflow для защиты цен!
- **Health Monitor** — мониторинг системы
- **Unit Economics** — расчёт маржи
- **AI Agent Dashboard** — dashboard агента
- **User Notifications** — уведомления пользователей

---

## 🔍 ДЕТАЛЬНЫЙ АНАЛИЗ

### 📁 Workflows в репозитории vs n8n

| Файл в репозитории                     | Присутствует в n8n | Статус                  |
| -------------------------------------- | ------------------ | ----------------------- |
| `sentinel-workflow.json`               | ✅ Да              | ⚪ Inactive, ❌ Error   |
| `sync-workflow.json`                   | ✅ Да              | ⚪ Inactive, ✅ Success |
| `monitoring-workflow.json`             | ✅ Да              | ⚪ Inactive, ❌ Error   |
| `analytics-workflow.json`              | ✅ Да              | ⚪ Inactive, ✅ Success |
| `notifications-workflow.json`          | ✅ Да              | ⚪ Inactive, ❌ Error   |
| `agent-dashboard-workflow.json`        | ✅ Да              | ⚪ Inactive, ❌ Error   |
| `unit-economics-monitor-workflow.json` | ✅ Да              | ⚪ Inactive, ❌ Error   |
| `ai-ops-agent-workflow.json`           | ✅ Да              | ⚪ Inactive             |
| `ops-center-workflow.json`             | ✅ Да              | ⚪ Inactive             |

**Отсутствуют в n8n (но есть в репо):**

- `credentials_import.json` (файл конфигурации)

### 🔗 API Endpoints для n8n

**Выделенные n8n endpoints (`N8N_WEBHOOK_SECRET`):**

```typescript
case 'n8n-price-check':   // handleN8nPriceCheck
case 'n8n-sync-products': // handleN8nSyncProducts
case 'n8n-health':        // handleN8nHealth
case 'n8n-send-report':   // handleN8nSendReport
case 'n8n-get-stats':     // handleN8nGetStats
```

**Общие endpoints используемые workflows:**

```
GET  /api?action=check-prices           ← Sentinel
GET  /api?action=get-system-metrics     ← Monitoring, Notifications
GET  /api?action=get-analytics          ← Analytics
POST /api?action=sync-products          ← Sync
POST /api?action=bulk-log-defense       ← Sentinel logging
GET  /api?action=health                 ← Ops Center
GET  /api?action=get-products           ← Unit Economics
POST /api?action=calculate-unit-economics ← Unit Economics
GET  /api?action=agent-status           ← Agent Dashboard
```

### 🔐 Аутентификация

**Workflows используют:**

```json
{
  "Authorization": "Bearer {{ $env.CRON_SECRET }}",
  "X-Telegram-Id": "{{ $env.ADMIN_TELEGRAM_ID }}"
}
```

**Требуемые ENV переменные в Docker:**
| Переменная | В docker-compose.yml | Статус |
|------------|---------------------|--------|
| `API_URL` | ✅ `${API_URL:-http://host.docker.internal:3001}` | ⚠️ Требует настройки |
| `CRON_SECRET` | ✅ `${CRON_SECRET}` | ⚠️ ОБЯЗАТЕЛЬНО проверить |
| `TELEGRAM_BOT_TOKEN` | ✅ `${TELEGRAM_BOT_TOKEN}` | ⚠️ Требует настройки |
| `ADMIN_CHAT_ID` | ✅ `${ADMIN_CHAT_ID}` | ⚠️ Требует настройки |
| `ADMIN_TELEGRAM_ID` | ✅ `${ADMIN_TELEGRAM_ID}` | ⚠️ Требует настройки |

---

## 🛠️ РАССИНХРОНИЗАЦИЯ КОДА

### Проблема: `N8N_WEBHOOK_SECRET` vs `CRON_SECRET`

**В n8n-webhooks.ts:**

```typescript
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET; // ← Используется этот
```

**В workflows:**

```json
"Authorization": "Bearer {{ $env.CRON_SECRET }}"  // ← А workflows используют этот!
```

**НЕСООТВЕТСТВИЕ!** Выделенные n8n endpoints (`n8n-price-check`, etc.) ожидают `N8N_WEBHOOK_SECRET`, а workflows отправляют `CRON_SECRET`.

### Проблема: Дублирование функционала

| n8n endpoint        | Общий endpoint  | Дублирование? |
| ------------------- | --------------- | ------------- |
| `n8n-price-check`   | `check-prices`  | ⚠️ Частичное  |
| `n8n-sync-products` | `sync-products` | ⚠️ Частичное  |

Workflows используют **общие endpoints** (`check-prices`, `sync-products`), а не выделенные n8n endpoints!

---

## ⚠️ ВЕРОЯТНЫЕ ПРИЧИНЫ ОШИБОК

### 1. Неправильная аутентификация

```
❌ Sentinel Error — скорее всего 401 Unauthorized
   Причина: check-prices ожидает CRON_SECRET + X-Telegram-Id
```

### 2. Несовпадение API_URL

```
❌ Если API_URL=http://host.docker.internal:3001
   А local-server-v2.mjs запущен — потенциальный конфликт
```

### 3. Отсутствие ENV переменных

```
⚠️ Если .env не настроен или не загружен в Docker
   Все вызовы API будут падать
```

---

## ✅ ПЛАН ИСПРАВЛЕНИЯ

### 🔴 СРОЧНО (сегодня)

#### 1. Проверить ENV переменные в Docker:

```bash
docker exec ng_n8n env | grep -E "(API_URL|CRON_SECRET|ADMIN_|TELEGRAM)"
```

#### 2. Синхронизировать CRON_SECRET:

```bash
# Vercel production
vercel env pull .env.vercel

# Сравнить с docker/.env
diff .env.vercel docker/.env | grep CRON_SECRET
```

#### 3. Протестировать API вручную:

```bash
curl -X GET "http://localhost:3001/api?action=check-prices&include_details=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "X-Telegram-Id: YOUR_ADMIN_ID"
```

#### 4. Активировать критические workflows:

```
1. Открыть http://localhost:5678
2. Открыть Sentinel - Price Defense
3. Исправить проблему (если есть)
4. Включить Active toggle
5. Повторить для Sync и Monitor
```

### 🟡 РЕФАКТОРИНГ (эта неделя)

#### 5. Унифицировать аутентификацию:

```typescript
// n8n-webhooks.ts — использовать CRON_SECRET везде
const AUTH_SECRET = process.env.CRON_SECRET || process.env.N8N_WEBHOOK_SECRET;
```

#### 6. Удалить дублирование:

- Удалить `n8n-price-check` если не используется
- Или перенаправить workflows на выделенные endpoints

#### 7. Добавить drift detection:

```typescript
// При каждом запуске сравнивать hash workflow в n8n с Git
await n8nGuardian.checkDrift({ workflowId, gitWorkflowJson });
```

---

## 📋 CHECKLIST ДЛЯ PRODUCTION

- [ ] Все 9 workflows импортированы в n8n
- [ ] CRON_SECRET одинаковый в Vercel и Docker
- [ ] API_URL указывает на рабочий сервер
- [ ] TELEGRAM_BOT_TOKEN настроен
- [ ] ADMIN_CHAT_ID настроен
- [ ] ADMIN_TELEGRAM_ID настроен
- [ ] Sentinel workflow активен и работает
- [ ] Sync workflow активен и работает
- [ ] Monitor workflow активен и работает
- [ ] Ошибки в Executions устранены
- [ ] Тестовое уведомление в Telegram доставлено

---

## 📊 МАТРИЦА СООТВЕТСТВИЯ ТЗ

| Требование ТЗ         | Статус         | Комментарий                     |
| --------------------- | -------------- | ------------------------------- |
| Sentinel каждые 5 мин | ❌ НЕ РАБОТАЕТ | Workflow деактивирован          |
| Sync каждый час       | ❌ НЕ РАБОТАЕТ | Workflow деактивирован          |
| Health Monitor        | ❌ НЕ РАБОТАЕТ | Workflow деактивирован + ошибки |
| Telegram уведомления  | ⚠️ Неизвестно  | Зависит от ENV                  |
| Analytics Report      | ⚠️ Работал     | Последний успех 23:54           |

---

## 🔧 РЕКОМЕНДАЦИИ

### Немедленные действия:

1. **Проверить логи ошибок** в n8n Executions
2. **Синхронизировать ENV** между Vercel и Docker
3. **Активировать критические workflows** (Sentinel, Sync, Monitor)

### Долгосрочные улучшения:

1. Добавить **автоматический import workflows** при запуске Docker
2. Реализовать **drift detection** в CI/CD
3. Создать **health endpoint** для проверки n8n состояния
4. Настроить **alerting** если critical workflows деактивированы

---

_Аудит проведён: 2025-12-30 00:39 MSK_
_NeuroGUARDIAN n8n Sync Audit v1.0_

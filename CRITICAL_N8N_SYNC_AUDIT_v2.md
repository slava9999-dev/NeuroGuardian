# 🔴 КРИТИЧЕСКИЙ АУДИТ СИНХРОНИЗАЦИИ N8N

> **Дата:** 2025-12-30 07:33 MSK  
> **Статус:** 🔴 **КРИТИЧЕСКАЯ ПРОБЛЕМА**  
> **Аудитор:** Antigravity AI

---

## 📊 EXECUTIVE SUMMARY

| Метрика                       | Значение        | Статус      |
| ----------------------------- | --------------- | ----------- |
| **Workflows в n8n**           | 9               | ✅          |
| **Активные workflows**        | 6               | ⚠️          |
| **Total Executions**          | 77              | -           |
| **Failed Executions**         | 66              | 🔴 КРИТИЧНО |
| **Failure Rate**              | **85.7%**       | 🔴 КРИТИЧНО |
| **CRON_SECRET синхронизация** | ❌ НЕ СОВПАДАЮТ | 🔴 КРИТИЧНО |

---

## 🔴 КРИТИЧЕСКАЯ ПРОБЛЕМА #1: НЕСООТВЕТСТВИЕ CRON_SECRET

### Факт

| Источник              | CRON_SECRET                        |
| --------------------- | ---------------------------------- |
| **n8n Docker**        | `neuroguardian-cron-2029`          |
| **Vercel Production** | `phIc1exX5YF08r9Cmg4blaLoSGP2wEOt` |

### Последствия

- ❌ **ВСЕ** вызовы API из n8n в Vercel терпят неудачу с `401 Unauthorized`
- ❌ Sentinel workflow НЕ ЗАЩИЩАЕТ цены (каждые 5 минут — ошибка)
- ❌ Unit Economics Monitor НЕ РАБОТАЕТ
- ❌ Analytics Report НЕ отправляется
- ❌ User Notifications НЕ доставляются

### Причина

Локальный Docker использует старый CRON_SECRET из `docker/.env`, который не синхронизирован с production Vercel.

---

## 🔴 КРИТИЧЕСКАЯ ПРОБЛЕМА #2: 85.7% FAILURE RATE

### Статистика выполнений

```
Total Production Executions: 77
Failed Executions: 66
Success Rate: ~14%
Failure Rate: ~86%
```

### Статус каждого Workflow

| Workflow                               | Active | Last Status | Частота      |
| -------------------------------------- | ------ | ----------- | ------------ |
| NeuroGUARDIAN Sentinel - Price Defense | ✅ Yes | ❌ Error    | Каждые 5 мин |
| Viktor Margin - Unit Economics Monitor | ✅ Yes | ❌ Error    | Каждый час   |
| NeuroGUARDIAN Product Sync             | ✅ Yes | ✅ Success  | Каждый час   |
| NeuroGUARDIAN User Notifications       | ✅ Yes | ❌ Error    | 2x в день    |
| NeuroGUARDIAN Analytics Report         | ✅ Yes | ❌ Error    | Ежедневно    |
| NeuroGUARDIAN AI Agent Dashboard       | ✅ Yes | ❌ Error    | Webhook      |
| NeuroGUARDIAN Health Monitor           | ❌ No  | N/A         | 6 часов      |
| NeuroGUARDIAN Ops Center               | ❌ No  | N/A         | -            |
| NeuroGUARDIAN AI Ops Agent             | ❌ No  | N/A         | -            |

---

## 🟡 ПРОБЛЕМА #3: N8N API НЕДОСТУПЕН

### Факт

```bash
curl -s "http://localhost:5678/api/v1/workflows" -H "X-N8N-API-KEY: <KEY>"
# Результат: {"message":"unauthorized"}
```

### Причина

N8N REST API требует дополнительной настройки. Даже с правильным `N8N_API_KEY=503b5211-7b8f-4380-917f-5d8b1153c426` API возвращает unauthorized.

### Последствия

- ❌ Невозможно программно управлять workflows
- ❌ Drift detection не работает
- ❌ Автоматический импорт workflows невозможен

---

## 🔍 ДЕТАЛЬНЫЙ АНАЛИЗ КОДА

### 1. Рассинхронизация секретов в коде

**n8n-webhooks.ts использует:**

```typescript
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET;
```

**Workflows используют:**

```json
"Authorization": "Bearer {{ $env.CRON_SECRET }}"
```

⚠️ **Потенциальный конфликт!** Выделенные n8n endpoints ожидают `N8N_WEBHOOK_SECRET`, а workflows отправляют `CRON_SECRET`.

### 2. Дублирование endpoints

| n8n-specific endpoint | General endpoint | Статус             |
| --------------------- | ---------------- | ------------------ |
| `n8n-price-check`     | `check-prices`   | ⚠️ Не используется |
| `n8n-sync-products`   | `sync-products`  | ⚠️ Не используется |

Workflows вызывают **общие** endpoints, а не выделенные n8n endpoints.

### 3. ENV переменные в Docker

**Текущие значения в n8n контейнере:**

```
CRON_SECRET=neuroguardian-cron-2029        ← УСТАРЕВШИЙ
API_URL=http://host.docker.internal:3001/api
TELEGRAM_BOT_TOKEN=8351360960:AAFl...       ← OK
ADMIN_CHAT_ID=7548070478                    ← OK
ADMIN_TELEGRAM_ID=7548070478                ← OK
N8N_API_KEY=503b5211-7b8f-4380-917f-5d8b1153c426
```

---

## ✅ ПЛАН НЕМЕДЛЕННОГО ИСПРАВЛЕНИЯ

### STEP 1: Синхронизировать CRON_SECRET (КРИТИЧНО!)

```powershell
# 1. Получить production CRON_SECRET из Vercel
vercel env pull .env.vercel-production --environment production

# 2. Обновить docker/.env
# Заменить CRON_SECRET=neuroguardian-cron-2029
# На: CRON_SECRET=phIc1exX5YF08r9Cmg4blaLoSGP2wEOt

# 3. Перезапустить n8n контейнер
docker-compose -f docker/docker-compose.yml restart n8n
```

### STEP 2: Включить n8n REST API

Добавить в docker-compose.yml:

```yaml
environment:
  - N8N_API_KEY=${N8N_API_KEY}
  - N8N_API_ENABLED=true
```

### STEP 3: Проверить локальный API сервер

```powershell
# API сервер должен быть запущен на порту 3001
npx tsx scripts/local-server-v2.mjs

# Проверить health
curl http://localhost:3001/api?action=health
```

### STEP 4: Тестировать Sentinel workflow

1. Открыть http://localhost:5678
2. Открыть "NeuroGUARDIAN Sentinel - Price Defense"
3. Нажать "Test Workflow"
4. Убедиться что нет 401 Unauthorized

---

## 📋 CHECKLIST ДЛЯ PRODUCTION

### Секреты

- [ ] **CRON_SECRET** в docker/.env = Vercel production
- [ ] **TELEGRAM_BOT_TOKEN** настроен
- [ ] **ADMIN_CHAT_ID** настроен
- [ ] **ADMIN_TELEGRAM_ID** настроен
- [ ] **API_URL** указывает на правильный endpoint

### Workflows

- [ ] Sentinel workflow активен и работает
- [ ] Product Sync workflow активен и работает
- [ ] Health Monitor workflow активен
- [ ] Analytics Report работает
- [ ] User Notifications доставляются

### API

- [ ] Local API server (3001) доступен из Docker
- [ ] n8n REST API включен и работает
- [ ] Все endpoints отвечают без 401

### Мониторинг

- [ ] Failure rate < 5%
- [ ] Telegram уведомления доставляются
- [ ] Sentinel logs записываются в БД

---

## 🔧 ДОЛГОСРОЧНЫЕ РЕКОМЕНДАЦИИ

1. **Автоматизировать синхронизацию ENV:**
   - Создать скрипт `sync-vercel-to-docker.cjs`
   - Запускать при каждом `docker-compose up`

2. **Drift Detection:**
   - Использовать `N8nGuardian.checkDrift()` в CI/CD
   - Блокировать deploy при обнаружении drift

3. **Alerting:**
   - Мониторить failure rate в n8n
   - Отправлять alert если >5% failures

4. **Backup workflows:**
   - Экспортировать JSON из n8n UI регулярно
   - Хранить в Git вместе с кодом

---

## 📊 СРАВНЕНИЕ С ТРЕБОВАНИЯМИ ТЗ

| Требование ТЗ                | Текущий статус    | Исправление      |
| ---------------------------- | ----------------- | ---------------- |
| Sentinel каждые 5 мин        | ❌ 401 Errors     | Sync CRON_SECRET |
| Product Sync каждые 6 часов  | ✅ Работает       | -                |
| Health Monitor каждый час    | ❌ Деактивирован  | Активировать     |
| Analytics Report ежедневно   | ❌ 401 Errors     | Sync CRON_SECRET |
| User Notifications 2x в день | ❌ 401 Errors     | Sync CRON_SECRET |
| Telegram уведомления         | ❌ Зависит от fix | Sync CRON_SECRET |

---

_Аудит проведён: 2025-12-30 07:33 MSK_  
_NeuroGUARDIAN n8n Critical Sync Audit v2.0_

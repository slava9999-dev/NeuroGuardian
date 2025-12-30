# 🛠️ NeuroGUARDIAN — Operating Runbook

**Version:** 3.0.0
**Last Updated:** 2025-12-30
**Author:** Principal Engineer

---

## 📋 Содержание

1. [Быстрый старт](#-быстрый-старт)
2. [Архитектура](#-архитектура)
3. [Локальная разработка](#-локальная-разработка)
4. [Деплой в Production](#-деплой-в-production)
5. [Мониторинг и алерты](#-мониторинг-и-алерты)
6. [Управление секретами](#-управление-секретами)
7. [n8n Workflows](#-n8n-workflows)
8. [Troubleshooting](#-troubleshooting)
9. [Ротация ключей](#-ротация-ключей)
10. [Rollback процедуры](#-rollback-процедуры)

---

## 🚀 Быстрый старт

### Минимальные требования

- Node.js 20+
- Docker + Docker Compose
- Git

### Первый запуск (5 минут)

```bash
# 1. Клонировать репозиторий
git clone https://github.com/slava9999-dev/NeuroGuardian.git
cd NeuroGuardian

# 2. Установить зависимости
npm install

# 3. Скопировать env файлы
cp .env.example .env
cp docker/.env.example docker/.env

# 4. Запустить Docker стек
npm run docker:up

# 5. Запустить локальный API сервер
npm run dev:full

# 6. Открыть в браузере
# - Frontend: http://localhost:5173
# - API: http://localhost:3001
# - n8n: http://localhost:5678
# - Adminer: http://localhost:8080
```

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRODUCTION (Vercel)                         │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React)  ←→  API (Serverless)  ←→  Neon PostgreSQL   │
│         ↑                    ↑                                  │
│         │              AI (OpenAI/Gemini)                       │
│         │                    ↓                                  │
│  Telegram Bot  ───────→  Agent V4 Orchestrator                  │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                   AUTOMATION (Docker/VPS)                        │
├─────────────────────────────────────────────────────────────────┤
│  n8n Workflows:                                                 │
│  ├── Sentinel (30min cron) → Price monitoring                  │
│  ├── AI Ops Agent → Natural language admin                     │
│  ├── Product Sync → WB/Ozon catalog sync                       │
│  └── Notifications → Telegram alerts                           │
└─────────────────────────────────────────────────────────────────┘
```

### Ключевые компоненты

| Компонент      | Технология        | Назначение          |
| -------------- | ----------------- | ------------------- |
| **Frontend**   | React 19 + Vite   | Telegram Mini App   |
| **API**        | Vercel Serverless | REST API endpoints  |
| **Database**   | Neon PostgreSQL   | Основное хранилище  |
| **KV**         | Vercel KV (Redis) | Кэш, rate limiting  |
| **AI**         | OpenAI GPT-4o     | Agent V4            |
| **Automation** | n8n               | Scheduled workflows |

---

## 💻 Локальная разработка

### Сервисы

```bash
# Полный стек (API + Frontend)
npm run dev:full

# Только Frontend
npm run dev

# Только API (для тестирования)
npm run dev:api

# Docker сервисы
npm run docker:up    # Запустить
npm run docker:down  # Остановить
npm run docker:logs  # Логи
npm run docker:reset # Сбросить данные
```

### URL сервисов

| Сервис          | URL                   | Credentials                      |
| --------------- | --------------------- | -------------------------------- |
| Frontend        | http://localhost:5173 | -                                |
| API             | http://localhost:3001 | -                                |
| n8n             | http://localhost:5678 | admin / localn8npass             |
| Adminer         | http://localhost:8080 | neuroguardian / localdevpassword |
| Redis Commander | http://localhost:8081 | -                                |

### Тестирование

```bash
# Все тесты
npm test

# С покрытием
npm run test:coverage

# В watch режиме
npm run test:watch

# E2E тесты
npm run test:e2e

# Проверка регрессий
npm run check:regression

# Полная проверка перед коммитом
npm run check:all
```

---

## 🌐 Деплой в Production

### Vercel (Автоматический)

```bash
# Deploy происходит автоматически при push в main
git push origin main

# Ручной деплой
vercel --prod
```

### Проверка деплоя

```bash
# Health check
curl https://neuro-guardian.vercel.app/api/health

# Ожидаемый ответ:
# {"status":"ok","timestamp":"...","version":"2.12.0"}
```

### Checklist перед Production

```bash
npm run check:production  # Автоматическая проверка

# Ручные проверки:
# □ Все тесты проходят
# □ TypeScript без ошибок
# □ Нет hardcoded secrets
# □ .env.production актуален
# □ Миграции применены
```

---

## 📊 Мониторинг и алерты

### Health Endpoints

| Endpoint                   | Что проверяет          |
| -------------------------- | ---------------------- |
| `/api/health`              | API, DB connection     |
| `/api/sentinel/status`     | Sentinel последний run |
| `/api/admin/logs?limit=10` | Последние логи         |

### Мониторинг Sentinel

```bash
# Проверить статус последнего цикла
curl -H "Authorization: Bearer $ADMIN_API_KEY" \
  https://neuro-guardian.vercel.app/api/sentinel/status
```

### Алерты (Telegram)

Sentinel автоматически отправляет в Telegram:

- 🛡️ Сработала защита цены
- ⚠️ Обнаружена угроза марже
- ❌ Ошибка при защите

---

## 🔐 Управление секретами

### Текущая схема

```
┌─────────────────────────────────────────────┐
│            SOURCES OF TRUTH                 │
├─────────────────────────────────────────────┤
│  Vercel Dashboard → Production env vars    │
│  docker/.env      → Local Docker           │
│  .env             → Local development      │
└─────────────────────────────────────────────┘
```

### Критические переменные

| Variable             | Описание            | Где хранить    |
| -------------------- | ------------------- | -------------- |
| `POSTGRES_URL`       | Database connection | Vercel Secrets |
| `OPENAI_API_KEY`     | GPT API             | Vercel Secrets |
| `TELEGRAM_BOT_TOKEN` | Bot token           | Vercel Secrets |
| `CRON_SECRET`        | Sentinel auth       | Vercel + n8n   |
| `ADMIN_API_KEY`      | Admin access        | Vercel Secrets |
| `ENCRYPTION_KEY`     | Data encryption     | Vercel Secrets |

### Синхронизация Vercel ↔ Local

```bash
# Скачать актуальные переменные
vercel env pull .env.local

# Загрузить переменную в Vercel
vercel env add MY_VAR production
```

---

## 🔄 n8n Workflows

### Список workflow

| Workflow                     | Назначение             | Расписание      |
| ---------------------------- | ---------------------- | --------------- |
| **Sentinel - Price Defense** | Мониторинг цен         | _/30 _ \* \* \* |
| **AI Ops Agent**             | NL операции            | on-demand       |
| **Product Sync**             | Синхронизация каталога | 0 _/6 _ \* \*   |
| **User Notifications**       | Уведомления            | event-driven    |
| **Unit Economics Monitor**   | Расчёт маржи           | 0 8 \* \* \*    |

### Экспорт/Импорт

```bash
# Экспорт всех workflow (в n8n-workflows/)
node scripts/n8n-export.mjs

# Импорт в новый n8n
node scripts/n8n-import.mjs
```

### Обновление credentials в n8n

1. Открыть http://localhost:5678
2. Settings → Credentials
3. Добавить/обновить:
   - NeuroGUARDIAN API (Header Auth)
   - Telegram Bot API
   - OpenAI API

---

## 🔧 Troubleshooting

### "Database connection failed"

```bash
# 1. Проверить Docker
docker ps | grep postgres

# 2. Проверить переменные
echo $POSTGRES_URL

# 3. Проверить доступность
pg_isready -h localhost -p 5432

# 4. Перезапустить
npm run docker:reset
```

### "n8n workflows not executing"

```bash
# 1. Проверить статус n8n
curl http://localhost:5678/healthz

# 2. Проверить логи
docker logs ng_n8n --tail 100

# 3. Проверить CRON_SECRET совпадает
grep CRON_SECRET docker/.env
grep CRON_SECRET .env
```

### "API returns 401 Unauthorized"

```bash
# 1. Для Sentinel cron:
# Проверить CRON_SECRET в header/query

# 2. Для Admin endpoints:
# Проверить ADMIN_API_KEY

# 3. Для User endpoints:
# Проверить X-Telegram-Id header
```

### "Agent returns empty response"

```bash
# 1. Проверить OPENAI_API_KEY
npm run check:production

# 2. Проверить rate limits
# OpenAI dashboard → Usage

# 3. Проверить логи
vercel logs -f
```

---

## 🔑 Ротация ключей

### OPENAI_API_KEY

```bash
# 1. Создать новый ключ в OpenAI Dashboard
# 2. Обновить в Vercel
vercel env rm OPENAI_API_KEY production
vercel env add OPENAI_API_KEY production

# 3. Redeploy
vercel --prod

# 4. Удалить старый ключ в OpenAI
```

### TELEGRAM_BOT_TOKEN

```bash
# 1. Отозвать токен через @BotFather
# 2. Получить новый токен
# 3. Обновить в Vercel
vercel env rm TELEGRAM_BOT_TOKEN production
vercel env add TELEGRAM_BOT_TOKEN production

# 4. Обновить webhook
curl -X POST "https://api.telegram.org/bot<NEW_TOKEN>/setWebhook" \
  -d "url=https://neuro-guardian.vercel.app/api/telegram"
```

### CRON_SECRET (Sentinel)

```bash
# 1. Сгенерировать новый секрет
openssl rand -hex 32

# 2. Обновить в Vercel
vercel env rm CRON_SECRET production
vercel env add CRON_SECRET production

# 3. Обновить в n8n workflow
# Settings → Environment Variables → CRON_SECRET

# 4. Проверить
curl -H "Authorization: Bearer $NEW_SECRET" \
  https://neuro-guardian.vercel.app/api/sentinel/check-prices
```

---

## ⏪ Rollback процедуры

### Vercel Rollback

```bash
# Список последних деплоев
vercel ls

# Откат к предыдущему
vercel rollback [deployment-url]

# Или через Dashboard:
# Vercel → Project → Deployments → ... → Promote to Production
```

### Database Rollback

```bash
# 1. Проверить текущее состояние миграций
npm run db:status

# 2. Откатить последнюю миграцию
# (требует создания down-миграции)
npm run db:rollback

# 3. При критической ситуации:
# Восстановить из бэкапа Neon
# Neon Console → Branches → Restore
```

### n8n Workflow Rollback

```bash
# 1. Workflows хранятся в n8n-workflows/
# 2. Откатить из git
git checkout HEAD~1 -- n8n-workflows/

# 3. Импортировать старую версию
node scripts/n8n-import.mjs
```

---

## 📞 Контакты

| Роль        | Как связаться   |
| ----------- | --------------- |
| Tech Lead   | @slava9999-dev  |
| Bot Support | @NeuroMarginBot |
| Emergency   | Telegram группа |

---

**Last Updated:** 2025-12-30
**Document Version:** 1.0.0

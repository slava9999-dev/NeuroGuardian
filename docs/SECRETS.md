# 🔐 NeuroGUARDIAN — Secrets Documentation

**Last Updated:** 2025-12-30
**Version:** 3.0.0

> ⚠️ **ВАЖНО:** Этот файл содержит ТОЛЬКО описание переменных, НЕ их значения!  
> Никогда не храните реальные секреты в репозитории.

---

## 📋 Полный список переменных окружения

### 🗄️ Database (Neon PostgreSQL)

| Variable                   | Описание                       | Required | Default           |
| -------------------------- | ------------------------------ | -------- | ----------------- |
| `POSTGRES_URL`             | Connection string с pooling    | ✅ Prod  | -                 |
| `POSTGRES_URL_NON_POOLING` | Direct connection (migrations) | ⬜ Opt   | -                 |
| `POSTGRES_PRISMA_URL`      | Для Prisma (если используется) | ⬜ Opt   | -                 |
| `POSTGRES_USER`            | Username (local Docker)        | ⬜ Local | neuroguardian     |
| `POSTGRES_PASSWORD`        | Password (local Docker)        | ⬜ Local | localdevpassword  |
| `POSTGRES_DB`              | Database name (local Docker)   | ⬜ Local | neuroguardian_dev |

### 🤖 AI Services

| Variable            | Описание                    | Required | Default |
| ------------------- | --------------------------- | -------- | ------- |
| `OPENAI_API_KEY`    | OpenAI API Key (GPT-4o)     | ✅ Prod  | -       |
| `GROQ_API_KEY`      | Groq API Key (fallback LLM) | ⬜ Opt   | -       |
| `GOOGLE_AI_API_KEY` | Google Gemini (future)      | ⬜ Opt   | -       |

### 📱 Telegram

| Variable             | Описание                   | Required | Default                   |
| -------------------- | -------------------------- | -------- | ------------------------- |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather  | ✅ Prod  | -                         |
| `ADMIN_TELEGRAM_ID`  | Telegram ID администратора | ✅ Prod  | -                         |
| `ADMIN_CHAT_ID`      | Chat ID для уведомлений    | ⬜ Opt   | Same as ADMIN_TELEGRAM_ID |

### 🏪 Marketplace APIs

| Variable         | Описание                              | Required | Default |
| ---------------- | ------------------------------------- | -------- | ------- |
| `WB_API_KEY`     | Wildberries API Key (global fallback) | ⬜ Opt   | -       |
| `OZON_CLIENT_ID` | Ozon Client ID (global fallback)      | ⬜ Opt   | -       |
| `OZON_API_KEY`   | Ozon API Key (global fallback)        | ⬜ Opt   | -       |

> **Note:** Основные ключи хранятся в БД для каждого пользователя.  
> Эти переменные — fallback для системных операций.

### 🔐 Authentication & Security

| Variable         | Описание                                     | Required | Default |
| ---------------- | -------------------------------------------- | -------- | ------- |
| `ADMIN_API_KEY`  | Master key для admin endpoints               | ✅ Prod  | -       |
| `CRON_SECRET`    | Secret для Sentinel cron                     | ✅ Prod  | -       |
| `ENCRYPTION_KEY` | AES-256 key для шифрования API ключей юзеров | ✅ Prod  | -       |
| `ENCRYPTION_IV`  | Initialization vector (hex)                  | ✅ Prod  | -       |

### ⚡ Vercel KV (Redis)

| Variable            | Описание             | Required | Default |
| ------------------- | -------------------- | -------- | ------- |
| `KV_REST_API_URL`   | Vercel KV REST URL   | ⬜ Opt   | -       |
| `KV_REST_API_TOKEN` | Vercel KV auth token | ⬜ Opt   | -       |

> Используется для кэша, rate limiting, conversation history.

### 🔄 n8n

| Variable             | Описание                | Required | Default                    |
| -------------------- | ----------------------- | -------- | -------------------------- |
| `N8N_API_KEY`        | n8n REST API key        | ⬜ Local | neuroguardian-n8n-api-2024 |
| `N8N_USER`           | n8n basic auth user     | ⬜ Local | admin                      |
| `N8N_PASSWORD`       | n8n basic auth password | ⬜ Local | localn8npass               |
| `N8N_ENCRYPTION_KEY` | n8n internal encryption | ⬜ Local | auto-generated             |

### 🌐 Deployment

| Variable     | Описание                                     | Required | Default                          |
| ------------ | -------------------------------------------- | -------- | -------------------------------- |
| `VERCEL_URL` | Auto-set by Vercel                           | ⬜ Auto  | -                                |
| `VERCEL_ENV` | Environment (production/preview/development) | ⬜ Auto  | -                                |
| `API_URL`    | Backend URL for n8n                          | ⬜ Local | http://host.docker.internal:3001 |

### 📦 Redis (Local Docker)

| Variable         | Описание                | Required | Default                |
| ---------------- | ----------------------- | -------- | ---------------------- |
| `REDIS_PASSWORD` | Redis password          | ⬜ Local | localredispass         |
| `REDIS_URL`      | Redis connection string | ⬜ Local | redis://localhost:6379 |

---

## 🗂️ Файлы окружений

### Структура

```
NeuroGUARDIAN/
├── .env                    # Local development (gitignored)
├── .env.example            # Template with all variables
├── .env.production         # Production values (gitignored)
├── .env.production.example # Production template
├── docker/
│   ├── .env               # Docker-specific (gitignored)
│   └── .env.example       # Docker template
```

### Приоритет загрузки

1. `process.env` (Vercel, Docker, CLI exports)
2. `.env.local` (local overrides)
3. `.env.production` / `.env.development` (environment-specific)
4. `.env` (default fallback)

---

## 🔄 Синхронизация между средами

### Local ↔ Vercel

```bash
# Скачать production переменные
vercel env pull .env.production.local

# Загрузить переменную в Vercel
vercel env add VARIABLE_NAME production

# Удалить переменную
vercel env rm VARIABLE_NAME production
```

### Local ↔ Docker

```bash
# Docker использует docker/.env
# Синхронизировать вручную если изменилось

# Проверить текущие в контейнерах
docker exec ng_n8n printenv | grep CRON
```

### n8n Credentials

> ⚠️ n8n хранит credentials отдельно от env vars!

1. Открыть n8n UI
2. Settings → Credentials
3. Добавить каждый credential вручную
4. Credentials НЕ экспортируются с workflows (безопасность)

---

## 🛡️ Security Best Practices

### ✅ DO

- Использовать разные ключи для dev/staging/production
- Ротировать ключи каждые 90 дней
- Использовать ENCRYPTION_KEY длиной минимум 32 байта
- Логировать access к sensitive endpoints
- Использовать Vercel Secrets для production

### ❌ DON'T

- Хранить секреты в коде или git
- Использовать одинаковые ключи везде
- Передавать секреты в URL query params
- Логировать значения секретов
- Использовать слабые пароли для local dev

---

## 🔧 Генерация безопасных ключей

```bash
# ENCRYPTION_KEY (32 bytes, hex)
openssl rand -hex 32

# ENCRYPTION_IV (16 bytes, hex)
openssl rand -hex 16

# CRON_SECRET
openssl rand -hex 32

# ADMIN_API_KEY
openssl rand -base64 32

# n8n Encryption Key
openssl rand -hex 24
```

---

## 📊 Переменные по критичности

### 🔴 CRITICAL (утечка = полный компромисс)

- `ENCRYPTION_KEY` — доступ ко всем marketplace ключам юзеров
- `ADMIN_API_KEY` — полный контроль над системой
- `POSTGRES_URL` — доступ к базе данных
- `OPENAI_API_KEY` — финансовые расходы

### 🟡 HIGH (требует немедленной ротации)

- `CRON_SECRET` — выполнение scheduled jobs
- `TELEGRAM_BOT_TOKEN` — контроль бота
- `KV_REST_API_TOKEN` — доступ к кэшу/сессиям

### 🟢 MEDIUM (ограниченный ущерб)

- `WB_API_KEY`, `OZON_API_KEY` — только fallback, основные в БД
- `N8N_API_KEY` — только при доступе к n8n host

---

## 📞 При утечке секретов

1. **Немедленно** ротировать затронутый ключ
2. Проверить audit logs на несанкционированный доступ
3. Заблокировать скомпрометированный доступ
4. Уведомить владельца проекта
5. Провести post-mortem

Смотри процедуру ротации в `docs/OPERATING_RUNBOOK.md`

---

**Последнее обновление:** 2025-12-30

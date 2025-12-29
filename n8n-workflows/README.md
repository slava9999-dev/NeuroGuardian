# NeuroGUARDIAN N8N Workflows v2.0

## 📋 Обзор

Этот каталог содержит все workflow-файлы для автоматизации NeuroGUARDIAN через n8n.

## 🔧 Список Workflows

### Core Workflows (Обязательные)

| Workflow           | Файл                       | Триггер        | Описание                               |
| ------------------ | -------------------------- | -------------- | -------------------------------------- |
| **Sentinel**       | `sentinel-workflow.json`   | Каждые 5 мин   | Защита цен от демпинга                 |
| **Product Sync**   | `sync-workflow.json`       | Каждый час     | Синхронизация товаров с маркетплейсами |
| **Health Monitor** | `monitoring-workflow.json` | Каждые 6 часов | Проверка здоровья API                  |

### Analytics & Reports

| Workflow               | Файл                                   | Триггер           | Описание                            |
| ---------------------- | -------------------------------------- | ----------------- | ----------------------------------- |
| **Analytics Report**   | `analytics-workflow.json`              | Ежедневно в 00:00 | Ежедневный отчёт в Telegram         |
| **User Notifications** | `notifications-workflow.json`          | Каждые 12 часов   | Уведомления об истекающих подписках |
| **Unit Economics**     | `unit-economics-monitor-workflow.json` | Каждый час        | Viktor Margin мониторинг            |

### Operations & AI (NEW v2.0)

| Workflow            | Файл                            | Триггер          | Описание                    |
| ------------------- | ------------------------------- | ---------------- | --------------------------- |
| **Ops Center**      | `ops-center-workflow.json`      | Webhook + 30 мин | Операционные команды        |
| **AI Ops Agent**    | `ai-ops-agent-workflow.json`    | Telegram Webhook | AI-ассистент для управления |
| **Agent Dashboard** | `agent-dashboard-workflow.json` | Каждые 6 часов   | Мониторинг AI агента        |

---

## 🚀 Установка

### 1. Настройка переменных окружения в n8n

Убедитесь, что в n8n настроены следующие env-переменные:

```env
API_URL=https://your-api.vercel.app/api
CRON_SECRET=your-cron-secret
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
ADMIN_CHAT_ID=your-telegram-id
ADMIN_TELEGRAM_ID=your-telegram-id
OPENAI_API_KEY=your-openai-key  # Для AI Agent
```

### 2. Импорт workflows

Для каждого файла:

1. Откройте n8n Dashboard
2. Нажмите **Add Workflow**
3. Нажмите на три точки → **Import from File**
4. Выберите JSON-файл
5. Нажмите **Save**
6. Активируйте workflow (toggle в правом верхнем углу)

### 3. Настройка Telegram Webhook (для AI Agent)

Для workflow `ai-ops-agent-workflow.json`:

```bash
# Замените на ваш webhook URL из n8n
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=<N8N_WEBHOOK_URL>/webhook/neuroguardian-agent"
```

---

## 📊 Архитектура v2.0

```
┌─────────────────────────────────────────────────────────────┐
│                    TELEGRAM BOT                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Commands   │  │  AI Agent   │  │    Notifications    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      N8N WORKFLOWS                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Ops Center  │  │  AI Agent    │  │  Notifications   │   │
│  │  /status     │  │  (OpenAI)    │  │  Subscription    │   │
│  │  /resync     │  │              │  │  Expiry          │   │
│  │  /sentinel   │  │              │  │                  │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                 │                   │              │
│  ┌──────┴─────────────────┴───────────────────┴──────────┐  │
│  │                NEUROGUARDIAN API                       │  │
│  │  (check-prices, sync-products, get-analytics, etc.)   │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   (Neon)        │
                    └─────────────────┘
```

---

## 🔐 Безопасность

### Стандартные Headers

Все API-запросы включают:

```json
{
  "Authorization": "Bearer {{ cronSecret }}",
  "X-Telegram-Id": "{{ adminTelegramId }}"
}
```

### Admin Check

AI Agent и Ops Center проверяют `telegram_id` отправителя против `ADMIN_TELEGRAM_ID`.

---

## 🧪 Тестирование

### Локальное тестирование

1. Запустите локальный API сервер:

   ```bash
   npx tsx scripts/local-api-server.mjs
   ```

2. В n8n, измените `API_URL` на:

   ```
   http://localhost:3001/api
   ```

3. Запустите workflow вручную (Execute Workflow)

### Проверка Sentinel

```bash
curl -X GET "http://localhost:3001/api?action=check-prices&include_details=true" \
  -H "Authorization: Bearer your-cron-secret" \
  -H "X-Telegram-Id: your-telegram-id"
```

---

## 📝 Changelog

### v2.0.0 (2025-12-29)

- ✅ Добавлен `adminTelegramId` во все Configuration ноды
- ✅ Добавлен `X-Telegram-Id` header во все API-запросы
- ✅ Новый workflow: **Ops Center** (`ops-center-workflow.json`)
- ✅ Новый workflow: **AI Ops Agent** (`ai-ops-agent-workflow.json`)
- ✅ Унифицированы таймауты (30-120 сек)
- ✅ Добавлены `continueOnFail` для graceful error handling

### v1.0.0 (2025-12-27)

- Начальная версия с базовыми workflows

---

## 🆘 Troubleshooting

### Workflow не запускается

1. Проверьте, что workflow активирован (toggle включён)
2. Проверьте env-переменные в n8n Settings
3. Проверьте логи выполнения в Executions

### Ошибка "Unauthorized"

1. Убедитесь, что `CRON_SECRET` в n8n совпадает с API
2. Проверьте, что `X-Telegram-Id` соответствует пользователю в БД

### Telegram не отвечает

1. Проверьте `TELEGRAM_BOT_TOKEN`
2. Проверьте webhook URL для AI Agent
3. Убедитесь, что бот не заблокирован

---

## 📞 Контакты

При возникновении проблем проверьте:

- `/status` команду в Telegram
- n8n Executions логи
- API `/api?action=health` endpoint

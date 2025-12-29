# NeuroGUARDIAN N8N Automation Upgrade Plan v2.0

## Date: 2025-12-29

---

## 🎯 ЦЕЛИ АПГРЕЙДА

1. **Унификация всех workflows** — единый стандарт конфигурации и обработки ошибок
2. **AI Agent Integration** — диалоговый агент для отладки и управления
3. **Ops Center** — единая точка управления системой
4. **Admin Dashboard** — веб-интерфейс для мониторинга
5. **Тестирование** — проверка работоспособности всей системы

---

## 📊 ФАЗЫ ВЫПОЛНЕНИЯ

### ФАЗА 1: СРОЧНЫЕ ФИКСЫ (30 мин)

- [x] Добавить `adminTelegramId` в Configuration всех workflows
- [x] Добавить `X-Telegram-Id` header во все HTTP Request ноды
- [ ] Добавить Error Handler ноды
- [ ] Унифицировать таймауты (60s для тяжёлых операций)

### ФАЗА 2: OPS CENTER WORKFLOW (1 час)

- [ ] Создать webhook endpoint для команд
- [ ] Реализовать команды: /status, /resync, /user, /logs, /health
- [ ] Интерактивные кнопки в Telegram
- [ ] Логирование всех операций

### ФАЗА 3: AI AGENT WORKFLOW (1.5 часа)

- [ ] Создать AI Agent ноду с OpenAI/Groq
- [ ] Диалоговое окно через Telegram
- [ ] Контекст системы (метрики, ошибки, пользователи)
- [ ] Возможность выполнять команды через агента
- [ ] История диалога

### ФАЗА 4: ADMIN DASHBOARD (2 часа)

- [ ] Веб-страница с таблицей пользователей
- [ ] Графики активности Sentinel
- [ ] Кнопки быстрых действий
- [ ] Логи в реальном времени
- [ ] Интеграция с API

### ФАЗА 5: ТЕСТИРОВАНИЕ (30 мин)

- [ ] Тест Sentinel workflow
- [ ] Тест Sync workflow
- [ ] Тест AI Agent
- [ ] Тест Ops Center команд
- [ ] Тест Admin Dashboard

---

## 🔧 ТЕХНИЧЕСКИЕ ДЕТАЛИ

### Стандартная Configuration нода (для всех workflows):

```json
{
  "assignments": [
    { "name": "apiBaseUrl", "value": "={{ $env.API_URL }}" },
    { "name": "cronSecret", "value": "={{ $env.CRON_SECRET }}" },
    { "name": "telegramBotToken", "value": "={{ $env.TELEGRAM_BOT_TOKEN }}" },
    { "name": "adminChatId", "value": "={{ $env.ADMIN_CHAT_ID }}" },
    { "name": "adminTelegramId", "value": "={{ $env.ADMIN_TELEGRAM_ID }}" },
    { "name": "openaiApiKey", "value": "={{ $env.OPENAI_API_KEY }}" }
  ]
}
```

### Стандартные Headers для API запросов:

```json
{
  "Authorization": "Bearer {{ cronSecret }}",
  "X-Telegram-Id": "{{ adminTelegramId }}",
  "Content-Type": "application/json"
}
```

### AI Agent System Prompt:

```
Ты — NeuroGUARDIAN Operations Agent. Твоя задача:
1. Мониторить здоровье системы
2. Помогать с отладкой проблем
3. Выполнять административные команды
4. Отвечать на вопросы о состоянии системы

Доступные команды:
- /status — общий статус системы
- /users — список пользователей
- /sentinel — статистика Sentinel
- /resync [user_id] — пересинхронизация товаров
- /logs [hours] — последние логи

Всегда отвечай на русском языке.
```

---

## 📁 НОВЫЕ ФАЙЛЫ

1. `n8n-workflows/ops-center-workflow.json` — Ops Center
2. `n8n-workflows/ai-agent-workflow.json` — AI Agent с диалогом
3. `src/pages/AdminDashboard.tsx` — Веб-дашборд
4. `src/api-lib/handlers/ops.ts` — API для Ops Center

---

## ✅ КРИТЕРИИ УСПЕХА

1. Все workflows работают без ошибок
2. AI Agent отвечает на команды в Telegram
3. Admin Dashboard показывает данные пользователей
4. Sentinel корректно защищает цены
5. Sync корректно синхронизирует товары

---

## 🚀 НАЧИНАЕМ ВЫПОЛНЕНИЕ

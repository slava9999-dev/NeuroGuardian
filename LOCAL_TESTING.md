# NeuroGUARDIAN — Локальное тестирование

# ========================================

## Шаг 1: Настройка переменных окружения

Создай файл `.env` в корне проекта со следующим содержимым:

```bash
# === ОБЯЗАТЕЛЬНЫЕ ДЛЯ ЛОКАЛЬНОГО ТЕСТИРОВАНИЯ ===

# База данных (скопируй из Vercel)
POSTGRES_URL=postgresql://...your-neon-connection-string...

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token

# Шифрование API ключей (32 символа)
API_KEY_ENCRYPTION_KEY=your_32_character_encryption_key

# Admin ключ для обхода авторизации
ADMIN_API_KEY=e9c1f232-1201-4cad-a72e-fe68650642d5-18962b92

# Cron секрет для Sentinel
CRON_SECRET=neuroguardian-cron-2029

# === AI АГЕНТ (хотя бы один) ===
AGENTROUTER_API_KEY=your_key
# или
GROQ_API_KEY=your_key
# или
OPENAI_API_KEY=your_key

# === ОПЦИОНАЛЬНО ===
# Web поиск для агента
SERPER_API_KEY=your_key

# Тестовый режим (бесплатная подписка)
TEST_MODE=true

# YooKassa (если тестируешь платежи)
# YOOKASSA_SHOP_ID=your_id
# YOOKASSA_SECRET_KEY=your_key
```

## Шаг 2: Запуск локального бэкенда

Vercel CLI позволяет запустить serverless функции локально:

```bash
# Остановить текущий npm run dev (Ctrl+C)
# Запустить Vercel Dev (фронтенд + бэкенд вместе)
vercel dev
```

**Что это даст:**

- Фронтенд на `http://localhost:3000`
- API на `http://localhost:3000/api`
- Горячая перезагрузка при изменении кода
- Доступ к реальной базе данных Neon
- Работа Агента, Сторожа, всех инструментов

## Шаг 3: Обновление `.env.local` для фронтенда

Убедись, что в `.env.local` есть:

```bash
VITE_DEV_MODE=true
VITE_ADMIN_API_KEY=e9c1f232-1201-4cad-a72e-fe68650642d5-18962b92
```

## Шаг 4: Тестирование

### 4.1 Проверка API

Открой в браузере:

- `http://localhost:3000/api?action=health` — должен вернуть `{"status":"ok"}`

### 4.2 Проверка фронтенда

- `http://localhost:3000/` — откроется приложение
- Должен автоматически залогиниться как `DEV_USER` (ID: 7548070478)

### 4.3 Проверка товаров

- Перейди на вкладку "Товары"
- Должны загрузиться твои 33 товара из базы

### 4.4 Проверка Агента

- Открой чат с Агентом
- Напиши: "Покажи мои товары"
- Агент должен вернуть список товаров

### 4.5 Проверка Sentinel (ручной запуск)

Открой в браузере или через curl:

```bash
curl "http://localhost:3000/api?action=check-prices&secret=neuroguardian-cron-2029"
```

Должен вернуть:

```json
{
  "success": true,
  "scanned": 1,
  "triggered": 0,
  "violations_found": 0,
  "message": "Full cycle completed"
}
```

## Шаг 5: Тестирование n8n интеграции

### 5.1 Обновить переменные в n8n

В n8n Settings → Environment Variables:

```
API_URL=http://localhost:3000/api
CRON_SECRET=neuroguardian-cron-2029
TELEGRAM_BOT_TOKEN=your_token
ADMIN_CHAT_ID=7548070478
```

### 5.2 Запустить Sentinel Workflow вручную

- Открой `http://localhost:5678/workflow/bCnfxAsjHao1b1ns`
- Нажми "Execute Workflow"
- Проверь логи

## Шаг 6: Отладка

### Логи бэкенда

`vercel dev` выводит все логи в консоль:

- `console.log()` из API handlers
- Ошибки базы данных
- Запросы к маркетплейсам

### Логи фронтенда

Открой DevTools (F12) → Console:

- Все `console.log()` из React компонентов
- Network tab — все API запросы

## Частые проблемы

### "Cannot connect to database"

- Проверь `POSTGRES_URL` в `.env`
- Убедись, что IP разрешен в Neon Dashboard

### "401 Unauthorized"

- Проверь `ADMIN_API_KEY` в `.env`
- Проверь `VITE_ADMIN_API_KEY` в `.env.local`
- Убедись, что оба совпадают

### "Agent not responding"

- Проверь наличие хотя бы одного AI ключа (AGENTROUTER/GROQ/OPENAI)
- Проверь логи в консоли `vercel dev`

### "No products found"

- Проверь, что в базе есть товары для `user_id=7548070478`
- Выполни SQL: `SELECT COUNT(*) FROM products WHERE user_id=7548070478`

## Горячие клавиши

- **Ctrl+C** — остановить `vercel dev`
- **F5** — перезагрузить страницу
- **Ctrl+Shift+R** — жесткая перезагрузка (очистка кэша)
- **F12** — открыть DevTools

## Следующие шаги

После успешного локального тестирования:

1. Закоммить изменения: `git add . && git commit -m "feat: local dev setup"`
2. Задеплоить: `vercel --prod`
3. Проверить в Telegram WebApp

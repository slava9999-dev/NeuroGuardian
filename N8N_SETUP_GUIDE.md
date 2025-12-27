# 🤖 N8N AUTOMATION SETUP GUIDE

**NeuroGUARDIAN** — Complete n8n Automation System  
**Version:** 1.0.0  
**Date:** December 27, 2024

---

## 📋 OVERVIEW

Полная система автоматизации из **5 дашбордов (workflows)**:

1. **Sentinel - Price Defense** — Защита цен каждые 5 минут
2. **Product Sync** — Синхронизация товаров каждые 6 часов
3. **Analytics Report** — Ежедневная аналитика в полночь
4. **Health Monitor** — Мониторинг системы каждый час
5. **User Notifications** — Напоминания о подписке каждые 12 часов

---

## 🚀 QUICK START

### Шаг 1: Запуск n8n

```bash
cd c:\NeuroGUARDIAN
.\start-n8n.bat
```

**Что делает скрипт:**

- Проверяет `.env.n8n`
- Запускает Docker Compose
- Открывает n8n в браузере (http://localhost:5678)

### Шаг 2: Первый вход

1. Откройте http://localhost:5678
2. Создайте аккаунт администратора
3. Логин/пароль из `.env.n8n`:
   - User: `admin` (или ваш из `N8N_BASIC_AUTH_USER`)
   - Password: из `N8N_BASIC_AUTH_PASSWORD`

### Шаг 3: Импорт workflows

**Автоматический импорт (рекомендуется):**

```bash
cd scripts
node import-all-workflows.cjs
```

**Ручной импорт:**

1. В n8n: **Workflows** → **Import from File**
2. Выберите файл из `n8n-workflows/`
3. Повторите для всех 5 файлов

---

## 📊 WORKFLOWS ОПИСАНИЕ

### 1️⃣ Sentinel - Price Defense

**Файл:** `sentinel-workflow.json`  
**Триггер:** Каждые 5 минут  
**Назначение:** Автоматическая защита цен от демпинга

**Как работает:**

1. Вызывает API `check-prices?include_details=true`
2. Получает список нарушений (цена < min_price)
3. Для каждого нарушения:
   - Определяет маркетплейс (WB/Ozon)
   - Выбирает действие (zero_stock / price_correction)
   - Выполняет защиту через API маркетплейса
4. Отправляет отчет в Telegram админу

**Переменные окружения:**

- `API_URL` — URL вашего API
- `CRON_SECRET` — секрет для авторизации
- `TELEGRAM_BOT_TOKEN` — токен бота
- `ADMIN_CHAT_ID` — ID чата админа

**Endpoints используемые:**

- `GET /api?action=check-prices&include_details=true`
- `POST /api?action=bulk-log-defense`

---

### 2️⃣ Product Sync

**Файл:** `sync-workflow.json`  
**Триггер:** Каждые 6 часов  
**Назначение:** Синхронизация товаров всех пользователей

**Как работает:**

1. Получает список активных пользователей
2. Для каждого пользователя:
   - Синхронизирует товары WB
   - Синхронизирует товары Ozon
   - Обновляет цены и остатки в БД
3. Отправляет отчет о синхронизации

**Переменные окружения:**

- `API_URL`
- `CRON_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `ADMIN_TELEGRAM_ID`

**Endpoints используемые:**

- `GET /api?action=admin-list-users`
- `POST /api?action=sync-products`

---

### 3️⃣ Analytics Report

**Файл:** `analytics-workflow.json`  
**Триггер:** Ежедневно в 00:00  
**Назначение:** Ежедневный отчет по системе

**Как работает:**

1. Вызывает `get-analytics` API
2. Получает метрики за последние 24 часа:
   - Активные подписки
   - Защищенные товары
   - Срабатывания Sentinel
   - Сэкономленные деньги
3. Форматирует красивый отчет
4. Отправляет в Telegram админу

**Метрики в отчете:**

- 📊 Подписки (активные, истекающие)
- 🛡️ Защита (товаров, пользователей)
- ⚔️ Sentinel (срабатывания, успешность)
- 💰 Экономия (сколько рублей спасено)
- 👥 Активность (пользователи за 24ч)

**Endpoints используемые:**

- `GET /api?action=get-analytics`

---

### 4️⃣ Health Monitor

**Файл:** `monitoring-workflow.json`  
**Триггер:** Каждый час  
**Назначение:** Мониторинг здоровья системы

**Как работает:**

1. Проверяет доступность API (`/api?action=health`)
2. Получает метрики системы (`get-system-metrics`)
3. Анализирует:
   - Ошибки Sentinel за последний час
   - Время последнего запуска Sentinel
   - Истекающие подписки
4. Отправляет алерты при проблемах

**Алерты отправляются если:**

- ❌ API недоступен
- ⚠️ Sentinel не запускался >10 минут
- 🔴 >5 ошибок Sentinel за час
- 📅 Подписки истекают сегодня

**Endpoints используемые:**

- `GET /api?action=health`
- `GET /api?action=get-system-metrics`

---

### 5️⃣ User Notifications

**Файл:** `notifications-workflow.json`  
**Триггер:** Каждые 12 часов  
**Назначение:** Напоминания пользователям о подписке

**Как работает:**

1. Получает список подписок, истекающих в течение 3 дней
2. Для каждого пользователя:
   - Формирует персональное сообщение
   - Добавляет кнопку "Продлить подписку"
   - Отправляет в Telegram
3. Отправляет админу отчет о количестве отправленных уведомлений

**Типы уведомлений:**

- 🔴 **Сегодня истекает** — срочное напоминание
- 🟡 **Через 1-3 дня** — предупреждение + промокод

**Endpoints используемые:**

- `GET /api?action=get-system-metrics`

---

## ⚙️ НАСТРОЙКА ПЕРЕМЕННЫХ

### Файл: `.env.n8n`

Скопируйте `.env.n8n.example` → `.env.n8n` и заполните:

```bash
# NeuroGUARDIAN API
API_URL=https://neuro-guardian.vercel.app/api
CRON_SECRET=your_secret_here_min_32_chars

# Telegram Bot
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
ADMIN_CHAT_ID=123456789
ADMIN_TELEGRAM_ID=123456789

# n8n Settings
N8N_HOST=localhost
N8N_PORT=5678
N8N_API_KEY=your_n8n_api_key

# n8n Auth (ОБЯЗАТЕЛЬНО сменить!)
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=STRONG_PASSWORD_HERE

# n8n Webhook URL
N8N_WEBHOOK_URL=http://localhost:5678/
```

### Как получить значения:

**CRON_SECRET:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**TELEGRAM_BOT_TOKEN:**

1. Напишите @BotFather в Telegram
2. Создайте бота: `/newbot`
3. Скопируйте токен

**ADMIN_CHAT_ID:**

1. Напишите боту `/start`
2. Откройте https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
3. Найдите `"chat":{"id":123456789}`

**N8N_API_KEY:**

1. В n8n: **Settings** → **API**
2. **Create API Key**
3. Скопируйте ключ

---

## 🧪 ТЕСТИРОВАНИЕ

### Тест 1: Проверка API endpoints

```bash
# Health check
curl http://localhost:3000/api?action=health

# Analytics (нужен CRON_SECRET)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api?action=get-analytics

# System metrics
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api?action=get-system-metrics
```

### Тест 2: Ручной запуск workflow

1. Откройте workflow в n8n
2. Нажмите **Execute Workflow**
3. Проверьте результаты в каждом узле

### Тест 3: Проверка Telegram уведомлений

1. Запустите **Analytics Report** вручную
2. Проверьте, пришло ли сообщение в Telegram
3. Формат должен быть красивым с эмодзи

---

## 📅 РАСПИСАНИЕ WORKFLOWS

| Workflow           | Частота    | Время                      | Назначение    |
| ------------------ | ---------- | -------------------------- | ------------- |
| **Sentinel**       | 5 мин      | Всегда                     | Защита цен    |
| **Product Sync**   | 6 часов    | 00:00, 06:00, 12:00, 18:00 | Синхронизация |
| **Analytics**      | 1 раз/день | 00:00                      | Отчет         |
| **Health Monitor** | 1 час      | Каждый час                 | Мониторинг    |
| **Notifications**  | 12 часов   | 09:00, 21:00               | Напоминания   |

---

## 🔧 TROUBLESHOOTING

### Проблема: Workflow не запускается

**Решение:**

1. Проверьте, что workflow **активирован** (переключатель вверху)
2. Проверьте логи: **Executions** → выберите execution → смотрите ошибки
3. Проверьте переменные окружения в `.env.n8n`

### Проблема: API возвращает 401 Unauthorized

**Решение:**

1. Проверьте `CRON_SECRET` в `.env.n8n`
2. Убедитесь, что в workflow используется правильный секрет
3. Проверьте формат заголовка: `Authorization: Bearer <secret>`

### Проблема: Telegram не отправляет сообщения

**Решение:**

1. Проверьте `TELEGRAM_BOT_TOKEN`
2. Убедитесь, что бот не заблокирован
3. Проверьте `ADMIN_CHAT_ID` (должен быть числом)
4. Напишите боту `/start` перед тестом

### Проблема: n8n не видит переменные окружения

**Решение:**

1. Перезапустите Docker: `docker-compose -f docker-compose.n8n.yml restart`
2. Проверьте `.env.n8n` на опечатки
3. Убедитесь, что файл в корне проекта

---

## 📊 МОНИТОРИНГ

### Где смотреть логи:

**n8n Executions:**

- http://localhost:5678/executions
- Показывает все запуски workflows
- Зеленый = успех, красный = ошибка

**Docker logs:**

```bash
docker-compose -f docker-compose.n8n.yml logs -f n8n
```

**API logs (Vercel):**

- https://vercel.com/your-project/logs
- Фильтр по `/api?action=check-prices`

### Метрики для отслеживания:

- ✅ **Success rate** Sentinel (должен быть >95%)
- ⏱️ **Execution time** (должен быть <30 секунд)
- 📊 **Violations per day** (сколько раз сработала защита)
- 💰 **Money saved** (сколько рублей спасено)

---

## 🔒 БЕЗОПАСНОСТЬ

### Обязательные действия:

1. **Смените пароль n8n:**
   - `.env.n8n` → `N8N_BASIC_AUTH_PASSWORD`
   - Минимум 16 символов

2. **Сгенерируйте новый CRON_SECRET:**

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Не коммитьте `.env.n8n` в git:**
   - Уже в `.gitignore`
   - Проверьте: `git status`

4. **Ограничьте доступ к n8n:**
   - Production: используйте reverse proxy (nginx)
   - Добавьте IP whitelist

---

## 🚀 PRODUCTION DEPLOYMENT

### Для production окружения:

1. **Измените `N8N_WEBHOOK_URL`:**

   ```bash
   N8N_WEBHOOK_URL=https://your-n8n-domain.com/
   ```

2. **Настройте HTTPS:**
   - Используйте nginx с Let's Encrypt
   - Или Cloudflare Tunnel

3. **Увеличьте ресурсы Docker:**

   ```yaml
   # docker-compose.n8n.yml
   services:
     n8n:
       deploy:
         resources:
           limits:
             memory: 2G
             cpus: '1.0'
   ```

4. **Настройте backup:**
   ```bash
   # Backup n8n data
   docker-compose -f docker-compose.n8n.yml exec n8n \
     tar -czf /backup/n8n-$(date +%Y%m%d).tar.gz /home/node/.n8n
   ```

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ РЕСУРСЫ

### Документация:

- n8n: https://docs.n8n.io/
- Telegram Bot API: https://core.telegram.org/bots/api
- NeuroGUARDIAN API: см. `README.md`

### Полезные команды:

```bash
# Перезапуск n8n
docker-compose -f docker-compose.n8n.yml restart

# Остановка n8n
docker-compose -f docker-compose.n8n.yml down

# Просмотр логов
docker-compose -f docker-compose.n8n.yml logs -f

# Импорт всех workflows
cd scripts && node import-all-workflows.cjs

# Экспорт workflow
cd scripts && node export-n8n-workflow.cjs <workflow-id>
```

---

## ✅ CHECKLIST ГОТОВНОСТИ

Перед запуском в production проверьте:

- [ ] `.env.n8n` заполнен и проверен
- [ ] Пароль n8n изменен на сильный
- [ ] CRON_SECRET сгенерирован (32+ символа)
- [ ] Telegram бот создан и токен получен
- [ ] ADMIN_CHAT_ID корректный
- [ ] Все 5 workflows импортированы
- [ ] Все workflows активированы
- [ ] Тестовый запуск каждого workflow прошел успешно
- [ ] Telegram уведомления приходят
- [ ] API endpoints отвечают корректно
- [ ] Логи не показывают ошибок
- [ ] Backup настроен (для production)

---

## 🎯 ИТОГ

**5 дашбордов автоматизации готовы к работе!**

Система обеспечивает:

- ⚡ Автоматическую защиту цен 24/7
- 📊 Ежедневную аналитику
- 🔍 Мониторинг здоровья системы
- 📬 Напоминания пользователям
- 🔄 Синхронизацию товаров

**Следующий шаг:** Запустите `start-n8n.bat` и импортируйте workflows!

---

_Last Updated: December 27, 2024, 20:35 MSK_  
_NeuroGUARDIAN Automation System v1.0.0_

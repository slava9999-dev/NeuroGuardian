# 🧠 SESSION CONTEXT — NeuroGUARDIAN MVP

**Дата:** 2024-12-22  
**Задача:** Завершить реализацию "Реалистичного плана MVP" (с 77% до 100%)

---

## 📦 Проект: NeuroGUARDIAN

**Что это:** Telegram Mini App для защиты маржи продавцов WB/Ozon  
**Стек:** React 19 + Vite + TypeScript + FastAPI-style API на Vercel + PostgreSQL + Vercel KV  
**Репозиторий:** `c:\NeuroGUARDIAN`  
**Деплой:** Vercel (https://neuro-guardian.vercel.app)

---

## ✅ Что уже реализовано (77%):

### Ядро системы:

- [x] **Auth** — Telegram WebApp валидация (HMAC-SHA256)
- [x] **Users** — PostgreSQL, подписки, триал
- [x] **Products API** — синхронизация WB/Ozon товаров
- [x] **Sentinel** — защита цен (min_price, zero_stock, price_correction)
- [x] **AI Agent** — OpenAI GPT-4o-mini + Function Calling
- [x] **Task Queue** — фоновые задачи на Vercel KV
- [x] **Notifications** — Telegram уведомления

### AI Agent Tools (Function Calling):

- [x] `get_products` — список товаров
- [x] `get_sales_stats` — статистика продаж
- [x] `calculate_unit_economics` — юнит-экономика
- [x] `set_stop_loss` — установка Stop-Loss (с подтверждением)
- [x] `bulk_protect_products` — массовая защита (с подтверждением)
- [x] `update_prices` — изменение цен WB API (с подтверждением)

### Cron Jobs:

- [x] `check-prices` — проверка цен каждые 15 мин
- [x] `send-reminders` — напоминания об истечении подписки
- [ ] `process-tasks` — обработка фоновых задач (нужно добавить в vercel.json)

---

## ❌ Что НЕ реализовано (23%):

### Неделя 5 — Проактивность (60% готово):

- [ ] **CompetitorTool** — сканирование конкурентов по артикулу
- [ ] **Кастомные правила** — "Если конкурент < X, то снизить на Y%"
- [ ] **Ежедневный дайджест** — отправка отчёта в 9:00

### Неделя 6 — Полировка (40% готово):

- [ ] **UI очереди задач** — компонент в Mini App для отображения background tasks
- [ ] **Полная документация** — README для пользователей
- [ ] **Load testing** — тест на 50 пользователей

---

## 📁 Ключевые файлы:

| Файл                                                       | Описание                          |
| ---------------------------------------------------------- | --------------------------------- |
| `api/index.ts`                                             | Главный API handler (3300+ строк) |
| `src/server/services/agent/agent.service.ts`               | AI Agent сервис                   |
| `src/server/services/agent/agent.tools.ts`                 | Tools для Function Calling        |
| `src/server/services/queue/task.queue.ts`                  | Очередь задач (Vercel KV)         |
| `src/server/services/queue/task.processor.ts`              | Обработчик задач                  |
| `src/server/services/notification/notification.service.ts` | Telegram уведомления              |
| `src/server/services/product/product.service.ts`           | Сервис товаров                    |
| `vercel.json`                                              | Cron jobs конфигурация            |

---

## 🔐 Environment Variables (Vercel):

```
POSTGRES_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
TELEGRAM_BOT_TOKEN=...
OPENAI_API_KEY=...
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
API_KEY_ENCRYPTION_KEY=...
ADMIN_API_KEY=...
CRON_SECRET=...
TEST_MODE=true
```

---

## 🎯 Задачи для следующей сессии:

### Приоритет 1 (Critical):

1. Добавить cron `process-tasks` в vercel.json
2. Реализовать CompetitorTool (сканирование конкурентов)

### Приоритет 2 (High):

3. Добавить кастомные правила пользователя
4. Ежедневный дайджест в 9:00

### Приоритет 3 (Medium):

5. UI компонент для очереди задач в Mini App
6. Обновить README с документацией

---

## 💡 Команды для работы:

```bash
# Локальный dev
npm run dev

# Build
npm run build

# Deploy
git add -A && git commit -m "..." && git push

# Тест API
curl "https://neuro-guardian.vercel.app/api?action=health"

# Тест check-prices (с ключом)
curl "https://neuro-guardian.vercel.app/api?action=check-prices&key=$ADMIN_API_KEY"
```

---

## 📊 План файла "Реалистичный план":

Файл: `🎯 РЕАЛИСТИЧНЫЙ ПЛАН NeuroAgent MVP.txt`

- **Неделя 1:** Валидация, AuditLog, CircuitBreaker ✅
- **Неделя 2:** Agent Core + RAG Lite ✅
- **Неделя 3:** Tools Hub + Валидация ✅
- **Неделя 4:** Фоновые воркеры ✅
- **Неделя 5:** Проактивность + Правила ⚠️ 60%
- **Неделя 6:** Интеграция + Полировка ⚠️ 40%

---

**Готов продолжить с любой задачи!**

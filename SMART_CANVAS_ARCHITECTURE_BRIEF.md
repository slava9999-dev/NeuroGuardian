# 🎨 Визуализация NeuroGUARDIAN — Краткая Версия

**Проект:** AI-система защиты цен на маркетплейсах  
**Стек:** React + Vercel + PostgreSQL + OpenAI

---

## 📐 Диаграмма 1: Общая Архитектура

```
Telegram App (React)
        ↓
Vercel API (/api/index.ts)
        ↓
    ┌───┴───┬────────┬─────────┐
    ↓       ↓        ↓         ↓
  Auth   Agent-V4  Products  Sentinel
    ↓       ↓        ↓         ↓
    └───┬───┴────────┴─────────┘
        ↓
  ┌─────┴─────┬──────────┐
  ↓           ↓          ↓
Postgres   OpenAI   WB/Ozon APIs
```

**Цвета:**

- Frontend: синий `#3B82F6`
- Backend: зелёный `#10B981`
- Database: оранжевый `#F59E0B`
- AI: розовый `#EC4899`
- External: фиолетовый `#8B5CF6`

---

## 🤖 Диаграмма 2: V4 Agent (AI Pipeline)

```
User Message
     ↓
[Phase 1: PLANNER] (GPT-4o-mini, 250ms)
  → Решает какие инструменты вызвать
  → Выход: { tools: ["get_products"], args: {...} }
     ↓
[Phase 2: EXECUTOR] (150ms)
  → Выполняет инструменты
  → Выход: { data: [...products] }
     ↓
[Phase 3: ANSWERER] (GPT-4o, 800ms)
  → Форматирует ответ
  → Выход: { message: "...", links: [...] }
     ↓
Response (Total: ~1200ms)
```

**Инструменты:**

- get_products
- get_sales_stats
- update_prices (с подтверждением)
- set_stop_loss (с подтверждением)

---

## 🛡️ Диаграмма 3: Sentinel (Защита Цен)

```
Cron (каждые 5 мин)
     ↓
Получить защищённых пользователей
     ↓
Для каждого пользователя:
  ├─ Получить товары с min_price
  ├─ Проверить текущие цены (WB/Ozon API)
  └─ Если цена < min_price:
       ↓
    [НАРУШЕНИЕ ОБНАРУЖЕНО]
       ↓
    Выбрать действие:
    ├─ zero_stock → Обнулить остатки
    └─ price_correction → Поднять цену
       ↓
    ├─ Записать в лог
    └─ Отправить Telegram уведомление
```

---

## 🔄 Диаграмма 4: n8n Workflow (Упрощённо)

```
1. [Cron Trigger] (каждые 5 мин)
        ↓
2. [HTTP] GET /api?action=check-prices
        ↓
3. [IF] violations > 0?
        ↓ Yes
4. [HTTP] GET /api?action=sentinel-logs
        ↓
5. [Loop] Для каждого нарушения:
        ↓
6. [Switch] По типу защиты:
    ├─ zero_stock → [HTTP] POST stock=0
    └─ price_correction → [HTTP] POST price=min
        ↓
7. [HTTP] POST Telegram notification
        ↓
8. [End] Сохранить результат
```

---

## 📊 База Данных (Основные Таблицы)

```
users
├─ id
├─ api_key_wb (encrypted)
├─ api_key_ozon (encrypted)
├─ protection_enabled
└─ defense_mode

products
├─ id
├─ user_id → users.id
├─ product_id
├─ current_price
├─ min_price (stop-loss)
└─ marketplace (WB/Ozon)

sentinel_logs
├─ id
├─ user_id → users.id
├─ detected_price
├─ min_price
├─ defense_action
└─ saved_amount
```

---

## 🎯 Ключевые Метрики

**Agent V4:**

- Planning: 250ms
- Execution: 150ms
- Answering: 800ms
- **Total: ~1200ms**

**Sentinel:**

- Интервал: 5 минут
- Пользователей за раз: ~50
- Нарушений: 2-5 за запуск
- Успешность защиты: 95%

---

## 🚀 Что Визуализировать

1. **Архитектуру** — блок-схема с цветами
2. **Agent Pipeline** — 3 фазы со стрелками
3. **Sentinel Flow** — от Cron до уведомления
4. **n8n Workflow** — 8 нодов

**Формат:** Интерактивная диаграмма с анимацией потока данных

---

**Готово для умного холста!** 🎨

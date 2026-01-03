# 🔧 Viktor AI — Полный Аудит Инструментов

> **Дата аудита:** 2026-01-03
> **Версия агента:** V5.0.0
> **Системный промпт:** `prompts/system-v5.ts`

---

## 📊 СВОДКА

| Категория              | Инструментов | Состояние          |
| ---------------------- | ------------ | ------------------ |
| **Товары и продажи**   | 6            | ✅ Все работают    |
| **Склад**              | 2            | ✅ Все работают    |
| **Конкуренты и рынок** | 3            | ✅ Все работают    |
| **Отзывы**             | 1            | ✅ Работает        |
| **Действия**           | 4            | ✅ Все работают    |
| **Админ**              | 1            | ✅ Работает        |
| **ИТОГО**              | **17**       | ✅ **100% готово** |

---

## 📦 ТОВАРЫ И ПРОДАЖИ (6 инструментов)

### 1. `get_products`

**Описание:** Получить список товаров с ценами и остатками
**Аргументы:**

```json
{ "limit": 20, "marketplace": "WB"|"Ozon" }
```

**Исполнитель:** `executeGetProducts` (tool-executors.ts:83-130)

### 2. `get_sales_stats`

**Описание:** Статистика продаж с трендами и рекомендациями
**Аргументы:**

```json
{ "period": "today"|"week"|"month" }
```

**Исполнитель:** `executeGetSalesStats` (tool-executors.ts:132-379)

### 3. `get_orders`

**Описание:** Последние заказы
**Аргументы:**

```json
{ "limit": 10, "status": "all"|"new"|"processing"|"delivered"|"cancelled" }
```

**Исполнитель:** `executeGetOrders` (tool-executors.ts:381-462)

### 4. `get_abc_analysis`

**Описание:** ABC анализ — какие товары приносят больше денег
**Аргументы:**

```json
{ "period": "month" }
```

**Исполнитель:** `executeGetAbcAnalysis` (tool-executors.ts:661-850)

### 5. `calculate_unit_economics`

**Описание:** Расчёт прибыли по товару с учётом всех комиссий
**Аргументы:**

```json
{ "product_id": "...", "cost_price": 500 }
```

**Исполнитель:** `executeCalculateUnitEconomics` (tool-executors.ts:546-659)

### 6. `get_low_margin_products`

**Описание:** Найти убыточные/низкомаржинальные товары
**Аргументы:**

```json
{ "threshold": 10 }
```

**Исполнитель:** `executeGetLowMarginProducts` (tool-executors.ts:1714-1793)

---

## 📦 СКЛАД (2 инструмента)

### 7. `get_warehouse_stocks`

**Описание:** Остатки на складах в реальном времени
**Аргументы:**

```json
{ "low_stock_only": true }
```

**Исполнитель:** `executeGetWarehouseStocks` (tool-executors.ts:464-544)

### 8. `get_stock_forecast`

**Описание:** Прогноз когда закончится товар
**Аргументы:** `{}`
**Исполнитель:** `executeGetStockForecast` (tool-executors.ts:852-997)

---

## 🌍 КОНКУРЕНТЫ И РЫНОК (3 инструмента)

### 9. `search_web`

**Описание:** Поиск информации в интернете (через Serper API)
**Аргументы:**

```json
{ "query": "..." }
```

**Исполнитель:** `executeSearchWeb` (tool-executors.ts:1043-1168)

### 10. `get_competitor_price`

**Описание:** Узнать цену конкурента по артикулу
**Аргументы:**

```json
{ "nm_id": "12345678", "marketplace": "WB" }
```

**Исполнитель:** `executeGetCompetitorPrice` (tool-executors.ts:1488-1673)
**Примечание:** WB API заблокирован, использует web search fallback

### 11. `get_marketplace_info`

**Описание:** Справка по комиссиям, логистике, акциям
**Аргументы:**

```json
{ "topic": "commissions"|"logistics"|"promotions"|"legal"|"tips" }
```

**Исполнитель:** `executeGetMarketplaceInfo` (tool-executors.ts:1001-1041)

---

## ⭐ ОТЗЫВЫ (1 инструмент)

### 12. `get_reviews`

**Описание:** Посмотреть отзывы покупателей
**Аргументы:**

```json
{ "limit": 10, "is_replied": false }
```

**Исполнитель:** `executeGetReviews` (tool-executors.ts:1675-1712)

---

## ⚡ ДЕЙСТВИЯ (4 инструмента) — требуют подтверждения

### 13. `update_prices`

**Описание:** Изменить цену товара
**Аргументы:**

```json
{ "products": [{ "product_id": "...", "new_price": 1000 }] }
```

**Исполнитель:** `executeUpdatePrices` (tool-executors.ts:1210-1292)
**Подтверждение:** ✅ ОБЯЗАТЕЛЬНО

### 14. `set_stop_loss`

**Описание:** Установить минимальную цену (защита от демпинга)
**Аргументы:**

```json
{ "product_id": "...", "min_price": 800 }
```

**Исполнитель:** `executeSetStopLoss` (tool-executors.ts:1348-1389)
**Подтверждение:** ✅ ОБЯЗАТЕЛЬНО

### 15. `bulk_protect_products`

**Описание:** Защитить все товары сразу
**Аргументы:**

```json
{ "percentage": 10, "only_unprotected": true }
```

**Исполнитель:** `executeBulkProtectProducts` (tool-executors.ts:1391-1436)
**Подтверждение:** ✅ ОБЯЗАТЕЛЬНО

### 16. `update_stocks`

**Описание:** Изменить остатки (только FBS)
**Аргументы:**

```json
{ "products": [{ "product_id": "...", "new_stock": 5 }] }
```

**Исполнитель:** `executeUpdateStocks` (tool-executors.ts:1294-1346)
**Подтверждение:** ✅ ОБЯЗАТЕЛЬНО

---

## 🔐 АДМИН (1 инструмент)

### 17. `get_system_logs`

**Описание:** Получить системные логи (только для админов)
**Аргументы:**

```json
{ "limit": 50, "severity": "error" }
```

**Исполнитель:** `executeGetSystemLogs` (tool-executors.ts:1438-1486)
**Доступ:** Только ADMIN

---

## 📋 СИСТЕМНЫЙ ПРОМПТ V5

### Режим Планировщика (PLANNER_PROMPT_V5)

- Минималистичный технический язык
- Надёжная генерация JSON
- Правила выбора инструментов:
  - Вопрос про продажи → `get_sales_stats`
  - "Что продаётся лучше" → `get_abc_analysis`
  - Вопрос про прибыль/маржу → `calculate_unit_economics` или `get_low_margin_products`
  - Вопрос про конкурентов → `get_competitor_price` или `search_web`
  - Приветствие/благодарность → пустой список tools
  - Изменение данных → `requires_confirmation: true`

### Режим Ответа (SYSTEM_PROMPT_V5)

- **Личность:** Виктор — ИИ-управляющий магазинами
- **Стиль:** Простой, конкретный, заботливый, честный, проактивный
- **Предупреждения:**
  - Ozon Card (-5% для 40% покупателей = -2% в среднем)
  - Хранение WB (штрафы после 60 дней)
  - Принудительные скидки маркетплейсов

### Заботливый тон

- "Заметил кое-что важное для вашего бизнеса..."
- "Хорошие новости! Вижу что..."
- "Не беспокойтесь, это легко исправить..."
- "Поздравляю! Ваш магазин растёт!"

---

## ⚙️ Архитектура Orchestrator V4

```
┌─────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR V4                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1️⃣ SIMPLE INTENT CHECK                                        │
│     └── Быстрый ответ без LLM для приветствий                  │
│                                                                 │
│  2️⃣ PHASE 1: PLANNER                                           │
│     ├── buildPlannerPrompt()                                   │
│     ├── callLLMWithFallback() [Groq → OpenAI → Local]          │
│     └── PlanSchema validation                                  │
│                                                                 │
│  3️⃣ PHASE 2: EXECUTOR                                          │
│     ├── executePlanSteps() [parallel execution]                │
│     └── executeTool(toolName, args, userId)                    │
│                                                                 │
│  4️⃣ PHASE 3: ANSWERER                                          │
│     ├── buildAnswererPrompt()                                  │
│     ├── callLLMWithFallback()                                  │
│     └── AnswerSchema validation                                │
│                                                                 │
│  5️⃣ PHASE 4: VALIDATION                                        │
│     ├── validateAnswerLinks() — удаление галлюцинаций          │
│     └── sanitizeAnswerLinks() — очистка невалидных URL         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ ГОТОВНОСТЬ К PRODUCTION

| Компонент        | Файл               | Строк | Статус         |
| ---------------- | ------------------ | ----- | -------------- |
| Системный промпт | system-v5.ts       | 341   | ✅ Готов       |
| Схемы            | schemas-v4.ts      | 503   | ✅ Готовы      |
| Исполнители      | tool-executors.ts  | 1794  | ✅ Все 17 tool |
| Оркестратор      | orchestrator-v4.ts | 851   | ✅ Готов       |

**Общий размер кода агента:** ~3,500 строк TypeScript

---

> **Виктор готов к работе. 17 инструментов. Человечный стиль. Производственная надёжность.**

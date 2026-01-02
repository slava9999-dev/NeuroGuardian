# 🛠 АНАЛИЗ ИНСТРУМЕНТОВ АГЕНТА

> **Дата:** 2026-01-01
> **Цель:** Аудит готовых инструментов и рекомендации

---

## ✅ ТЕКУЩИЕ ИНСТРУМЕНТЫ (15 штук)

| #   | Инструмент                 | Статус              | Описание                     | API              |
| --- | -------------------------- | ------------------- | ---------------------------- | ---------------- |
| 1   | `get_products`             | ✅ Работает         | Список товаров пользователя  | PostgreSQL       |
| 2   | `get_sales_stats`          | ✅ Работает         | Статистика продаж с трендами | WB/Ozon API      |
| 3   | `get_orders`               | ✅ Работает         | История заказов              | WB/Ozon API      |
| 4   | `get_warehouse_stocks`     | ✅ Работает         | Остатки на складах           | WB/Ozon API      |
| 5   | `calculate_unit_economics` | ✅ Работает         | Расчёт Викторальности        | Калькулятор      |
| 6   | `get_abc_analysis`         | ✅ Работает         | ABC анализ товаров           | PostgreSQL + API |
| 7   | `get_stock_forecast`       | ✅ Работает         | Прогноз остатков             | Алгоритм         |
| 8   | `get_marketplace_info`     | ✅ Работает         | Справка о маркетплейсах      | Статичные данные |
| 9   | `get_marketplace_accounts` | ✅ Работает         | Подключённые аккаунты        | PostgreSQL       |
| 10  | `search_web`               | ✅ Работает         | Поиск в интернете            | Serper.dev API   |
| 11  | `update_prices`            | ⚠️ С подтверждением | Изменение цен                | WB/Ozon API      |
| 12  | `update_stocks`            | ⚠️ С подтверждением | Изменение остатков           | WB/Ozon API      |
| 13  | `set_stop_loss`            | ⚠️ С подтверждением | Установка минимальной цены   | PostgreSQL       |
| 14  | `bulk_protect_products`    | ⚠️ С подтверждением | Массовая защита              | PostgreSQL       |
| 15  | `get_system_logs`          | 🔒 Admin only       | Системные логи               | PostgreSQL       |

---

## 🔍 АНАЛИЗ КОНКУРЕНТОВ

### Текущая реализация:

**1. Web Search (Serper.dev) — ✅ РАБОТАЕТ**

```typescript
// specialists/competitors.ts
search_web({
  query: 'панно деревянное site:ozon.ru цена',
  topic: 'competitors',
});
```

- Использует Google Search API
- Возвращает реальные ссылки и цены
- Требует SERPER_API_KEY

**2. Direct Competitor Monitor — ✅ РАБОТАЕТ для WB**

```typescript
// services/competitor-monitor.ts
fetchWbCompetitorData(nmId: 12345678)
// → { price: 899, stock: 45, available: true }
```

- Парсит публичный API Wildberries
- Получает актуальную цену и остатки
- Ozon НЕ поддерживается (нужен скрапер)

### Проблемы:

| Проблема                                 | Статус               | Решение                             |
| ---------------------------------------- | -------------------- | ----------------------------------- |
| Ozon competitor parsing                  | ⚠️ Не работает       | Нужен прокси/скрапер сервис         |
| competitor-monitor не подключён к агенту | 🔴 Не интегрирован   | Создать tool `get_competitor_price` |
| search_web иногда не находит цены        | ⚠️ Зависит от Google | Fallback на direct parsing          |

---

## 🚀 РЕКОМЕНДУЕМЫЕ УЛУЧШЕНИЯ

### 1. Новый инструмент: `get_competitor_price`

```typescript
// Предложение: добавить к агенту
export async function executeGetCompetitorPrice(
  userId: number,
  rawArgs: unknown
): Promise<ToolResult> {
  // args: { nm_id: number, marketplace: 'WB' | 'Ozon' }

  const data = await fetchWbCompetitorData(args.nm_id);

  return {
    success: true,
    data: {
      nm_id: args.nm_id,
      price: data.price,
      basicPrice: data.basicPrice,
      stock: data.stock,
      available: data.available,
    },
  };
}
```

**Применение:**

```
Пользователь: "Какая цена у конкурента 12345678?"
Агент:
1. Вызывает get_competitor_price({ nm_id: 12345678, marketplace: 'WB' })
2. Получает: { price: 899, stock: 45 }
3. Отвечает: "Цена конкурента 899₽, в наличии 45 шт."
```

### 2. Усиление search_web для конкурентов

Текущий search_web хорош, но можно добавить:

- Автоматическое извлечение цен из сниппетов
- Парсинг "Цена от X₽" из Google результатов

### 3. Автоматический мониторинг конкурентов

В price_rules есть поле `competitor_nmids`:

```sql
competitor_tracking BOOLEAN DEFAULT false,
competitor_nmids TEXT  -- JSON array of competitor nm_ids
```

Можно добавить в Sentinel:

```typescript
// В Sentinel при проверке цен:
if (rule.competitor_tracking && rule.competitor_nmids) {
  const competitorPrices = await fetchCompetitorPrices(rule.competitor_nmids);
  const avgCompetitorPrice = average(competitorPrices);

  if (currentPrice > avgCompetitorPrice * 1.2) {
    // Алерт: "Ваша цена на 20% выше конкурентов!"
  }
}
```

---

## 📊 ПОЛЕЗНЫЕ ИНСТРУМЕНТЫ ДЛЯ ДОБАВЛЕНИЯ

| Инструмент                 | Сложность | Ценность | Описание                                    |
| -------------------------- | --------- | -------- | ------------------------------------------- |
| `get_competitor_price`     | 🟢 Легко  | ⭐⭐⭐   | Парсинг цены конкурента по nmId             |
| `compare_with_competitors` | 🟡 Средне | ⭐⭐⭐   | Сравнение своей цены с конкурентами         |
| `get_category_analytics`   | 🔴 Сложно | ⭐⭐     | Аналитика категории (нужен MPStats/Similar) |
| `get_seo_keywords`         | 🟡 Средне | ⭐⭐     | Популярные ключевые слова                   |
| `calculate_optimal_price`  | 🟡 Средне | ⭐⭐⭐   | Расчёт оптимальной цены по юнит-экономике   |
| `get_reviews_summary`      | 🔴 Сложно | ⭐       | AI-summary отзывов (нужен парсинг)          |

---

## 🎯 ПРИОРИТЕТНЫЙ ПЛАН

### Сегодня (быстрые улучшения):

1. ✅ **Подключить `get_competitor_price`** — уже есть код, нужно добавить в агент

### Эта неделя:

2. **Интегрировать competitor tracking в Sentinel** — автоматические алерты
3. **Добавить `compare_with_competitors`** — сравнение с конкурентами

### Позже:

4. Ozon competitor parsing (требует прокси)
5. Category analytics (требует платный API)

---

## ⚙️ ПРОВЕРКА SERPER API

Для работы search_web нужен ключ:

```env
SERPER_API_KEY=your-key-here
```

**Как получить:**

1. Зарегистрируйся на https://serper.dev
2. Бесплатный план: 2500 запросов/месяц
3. Добавь ключ в Vercel Environment Variables

**Проверка:**

```bash
curl https://neuro-guardian.vercel.app/api?action=agent-v4 \
  -H "X-Admin-Key: YOUR_KEY" \
  -d '{"message": "найди конкурентов для держателя для полотенец на wildberries"}'
```

---

## 🔑 ВЫВОДЫ

1. **search_web работает** — конкуренты находятся через Google
2. **WB competitor parsing готов** — но не подключён к агенту
3. **Ozon competitor не работает** — нужен scraping service
4. **Легко добавить** — `get_competitor_price` tool за 30 минут

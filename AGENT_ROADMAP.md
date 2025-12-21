# 🤖 NeuroAgent — Roadmap прокачки AI-агента

> **Дата создания:** 2024-12-21
> **Версия:** 2.4.0
> **Цель:** Создать умного AI-ассистента для селлеров WB/Ozon, который заменит платные аналитические сервисы (25 000+ руб/мес)

---

## 🎯 МИССИЯ ПРОЕКТА

Демократизировать доступ к аналитике маркетплейсов. Дать малому бизнесу инструменты, которые крупные игроки получают за огромные деньги.

---

## ✅ УЖЕ РЕАЛИЗОВАНО (v2.4.0)

### Инфраструктура:

- [x] React 19 + Vite + TypeScript фронтенд
- [x] Vercel Serverless API (монолит в `api/index.ts`)
- [x] Vercel Postgres для хранения данных
- [x] Telegram WebApp интеграция
- [x] YooKassa платежи (Pro 999₽/мес, Yearly 9990₽/год)

### AI-агент (базовый):

- [x] Чат-интерфейс на вкладке "Агент"
- [x] Интеграция OpenAI GPT (gpt-4o-mini / gpt-4o)
- [x] SYSTEM_PROMPT с контекстом селлера
- [x] Передача данных пользователя в GPT (товары, статистика)
- [x] Fallback на статическую логику если GPT недоступен
- [x] Подтверждение действий (actionRequired)

### Защита товаров (Sentinel):

- [x] Stop-Loss защита (минимальная цена)
- [x] Режимы: Zero Stock / Price Correction
- [x] Cron-мониторинг каждые 2 минуты
- [x] Логи срабатываний

### API маркетплейсов:

- [x] WB API: синхронизация товаров, цен, остатков
- [x] Ozon API: базовая интеграция
- [x] Шифрование API-ключей (AES-256-GCM)

---

## 🚀 ROADMAP: Прокачка агента

### ЭТАП 1: Function Calling (GPT Tools)

**Цель:** GPT сам понимает какую функцию вызвать и вызывает её.

```typescript
// Пример tools для GPT
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_sales_stats',
      description: 'Получить статистику продаж за период',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['today', 'week', 'month'] },
          marketplace: { type: 'string', enum: ['WB', 'Ozon', 'all'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_stop_loss',
      description: 'Установить Stop-Loss для товара',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          minPrice: { type: 'number' },
          percentFromCurrent: { type: 'number' },
        },
      },
    },
  },
];
```

**Файлы для изменения:**

- `api/index.ts` — добавить tools в callOpenAI, обработать tool_calls

---

### ЭТАП 2: Юнит-экономика

**Цель:** Расчёт реальной прибыли на каждый товар.

**Формула:**

```
Чистая прибыль = Цена продажи
               - Себестоимость
               - Комиссия WB/Ozon (%)
               - Логистика
               - Хранение
               - Налог
```

**API endpoints WB для данных:**

- `/api/v1/supplier/reportDetailByPeriod` — детальный отчёт
- `/api/v1/supplier/stocks` — остатки
- `/api/v1/supplier/orders` — заказы

**Что добавить:**

- Поле `cost_price` в таблицу products
- Функция `calculateUnitEconomics(productId)`
- AI-инструмент `get_unit_economics`

---

### ЭТАП 3: ABC-XYZ анализ

**Цель:** Классификация товаров по прибыльности и стабильности продаж.

| Категория | Описание                 |
| --------- | ------------------------ |
| A         | 80% выручки (топ товары) |
| B         | 15% выручки (средние)    |
| C         | 5% выручки (аутсайдеры)  |

**XYZ** — стабильность спроса (коэффициент вариации).

**Что добавить:**

- Функция `calculateABCAnalysis()`
- AI-инструмент `get_abc_analysis`
- Визуализация на фронте (матрица ABC-XYZ)

---

### ЭТАП 4: Прогноз остатков

**Цель:** Предсказать когда товар закончится, когда заказывать поставку.

**Алгоритм:**

1. Средние продажи за 30 дней
2. Текущий остаток
3. Дней до нуля = Остаток / Среднедневные продажи
4. Учёт сезонности (опционально)

**Что добавить:**

- Функция `forecastStockout(productId)`
- AI-инструмент `get_stock_forecast`
- Push-уведомления "Товар X закончится через 5 дней"

---

### ЭТАП 5: Работа с отзывами

**Цель:** Мониторинг отзывов, автогенерация ответов на негатив.

**WB API:**

- `/api/v1/feedbacks` — получение отзывов
- `/api/v1/feedbacks/answer` — ответ на отзыв

**Что добавить:**

- Синхронизация отзывов в БД
- AI-инструмент `get_reviews`
- AI-инструмент `generate_review_response`
- Опция автоответа на негатив (с подтверждением)

---

### ЭТАП 6: Рекламная аналитика

**Цель:** ROI рекламных кампаний, оптимизация ставок.

**WB API:**

- `/adv/v1/promotion/campaigns` — список кампаний
- `/adv/v1/fullstat` — статистика рекламы

**Что добавить:**

- Расчёт ROI = (Выручка - Расходы) / Расходы \* 100%
- Рекомендации по ставкам
- AI-инструмент `get_ad_performance`

---

## 📁 СТРУКТУРА КОДА

```
api/index.ts          # Монолит API (все endpoints)
├── callOpenAI()      # Вызов GPT
├── AGENT_SYSTEM_PROMPT
├── case 'agent':     # Обработчик чата
└── tools/            # (добавить) Function definitions

src/
├── pages/AgentPage.tsx    # UI чата
├── lib/agentApi.ts        # API клиент для агента
└── components/ui/         # Компоненты чата
```

---

## 🔧 ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ (Vercel)

| Переменная               | Описание                        |
| ------------------------ | ------------------------------- |
| `OPENAI_API_KEY`         | Ключ OpenAI для GPT             |
| `TELEGRAM_BOT_TOKEN`     | Токен Telegram бота             |
| `YOOKASSA_SHOP_ID`       | ID магазина YooKassa            |
| `YOOKASSA_SECRET_KEY`    | Секретный ключ YooKassa         |
| `API_KEY_ENCRYPTION_KEY` | 32 символа для шифрования       |
| `TEST_MODE`              | "true" для бесплатного Pro всем |

---

## 💡 ВАЖНЫЕ ЗАМЕТКИ

1. **Лимиты OpenAI:** gpt-4o дороже чем gpt-4o-mini, использовать только для сложных задач
2. **Лимиты WB API:** Есть rate limits, нужен exponential backoff (уже реализован)
3. **Безопасность:** API-ключи пользователей шифруются AES-256-GCM
4. **Vercel Hobby:** Лимит 12 serverless functions → используем монолит

---

## 🎓 КАК НАЧАТЬ СЛЕДУЮЩУЮ СЕССИЮ

1. Прочитай этот файл
2. Изучи `api/index.ts` (особенно case 'agent')
3. Спроси пользователя какой этап реализовать
4. Начни с малого, тестируй каждый шаг

---

**Создатель:** Slava (Telegram: @Vyacheslav_Neuro)
**Репозиторий:** github.com/slava9999-dev/NeuroGuardian

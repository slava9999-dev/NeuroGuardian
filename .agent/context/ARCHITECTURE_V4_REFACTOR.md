# NeuroGUARDIAN V4 Architecture Refactor

## Critical Issues & Solutions

**Created:** 2024-12-25
**Priority:** P0 (без этого ничего не заработает)

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1. LLM генерирует URL → галлюцинации

**Текущее:** Агент может "придумать" ссылку на Ozon/WB
**Решение:** Ссылки ТОЛЬКО из tool results, валидация на сервере

### 2. 1200 строк промпта → игнорирование правил

**Текущее:** Монолит с бизнес-логикой, примерами, персоной
**Решение:** 80-100 строк "конституции", остальное в код/RAG

### 3. Free-text output → HTML, неконсистентность

**Текущее:** Модель возвращает текст, который может содержать HTML
**Решение:** Structured Output через `response_format: {type: "json_schema"}`

### 4. Sentinel внутри агента → ненадёжность

**Текущее:** Stop-loss зависит от ответа LLM
**Решение:** Детерминированный cron job каждые 5 минут

### 5. Marketplace как "просьба" в промпте

**Текущее:** "Покажи только WB" — модель может проигнорировать
**Решение:** Фильтр на уровне данных, до LLM

---

## 📐 ЦЕЛЕВАЯ АРХИТЕКТУРА

```
[User Query]
    ↓
[Router] — определяет intent (не LLM!)
    ↓
[Planner LLM] — возвращает JSON с планом tools
    ↓
[Tool Executor] — детерминированное выполнение
    ↓
[Answer LLM] — форматирует ответ из tool results
    ↓
[Validator] — проверяет links против tool results
    ↓
[Response]
```

---

## 🛠 ПЛАН РЕАЛИЗАЦИИ

### Phase 1: Structured Output (День 1)

- [ ] Создать Zod-схемы для PlanSchema и AnswerSchema
- [ ] Интегрировать OpenAI Structured Outputs
- [ ] Убрать dangerouslySetInnerHTML из фронта
- [ ] Ссылки рендерить ТОЛЬКО из `links[]` поля

### Phase 2: Two-Phase Pipeline (День 1-2)

- [ ] Planner: получает query → возвращает plan (какие tools вызвать)
- [ ] Executor: запускает tools детерминированно
- [ ] Answerer: получает tool results → форматирует ответ
- [ ] Validator: проверяет links ⊆ tool_results.urls

### Phase 3: Prompt Minimization (День 2)

- [ ] System prompt до 80 строк
- [ ] Бизнес-правила (комиссии) → в RAG или tool
- [ ] Few-shot примеры → убрать из system
- [ ] Персона → 2-3 предложения максимум

### Phase 4: Sentinel Extraction (День 2-3)

- [ ] Создать `/api/cron/check-prices.ts` как независимый job
- [ ] Убрать stop-loss логику из агента
- [ ] Агент только ЧИТАЕТ статус защиты
- [ ] Исполнение — отдельный детерминированный сервис

### Phase 5: Data-Level Filtering (День 3)

- [ ] Marketplace фильтр до вызова LLM
- [ ] Агент получает уже отфильтрованные данные
- [ ] Схема с `marketplace: z.enum(['WB', 'Ozon'])`

---

## 📦 НОВЫЕ СХЕМЫ

### PlanSchema (Planner возвращает это)

```typescript
const PlanSchema = z.object({
  reasoning: z.string().describe('Почему выбран этот план'),
  tools: z.array(
    z.object({
      name: z.enum(['get_products', 'search_web', 'get_sales_stats', 'calculate_unit_economics']),
      args: z.record(z.any()),
      reason: z.string(),
    })
  ),
});
```

### AnswerSchema (Answerer возвращает это)

```typescript
const AnswerSchema = z.object({
  message: z.string().describe('Ответ пользователю, plain text, NO HTML'),
  links: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        source: z.enum(['search_web', 'marketplace']),
      })
    )
    .optional(),
  actions: z
    .array(
      z.object({
        type: z.enum(['confirm_price_change', 'set_stop_loss']),
        details: z.record(z.any()),
      })
    )
    .optional(),
  data: z.record(z.any()).optional().describe('Структурированные данные для UI'),
});
```

---

## ⚠️ МИНИМАЛЬНЫЙ SYSTEM PROMPT (80 строк)

```
Ты — AI-ассистент для управления ценами на маркетплейсах WB и Ozon.

ТВОЯ ЗАДАЧА:
1. Составить план вызова инструментов
2. Сформировать ответ ТОЛЬКО на основе результатов инструментов

ЖЁСТКИЕ ПРАВИЛА:
1. НИКОГДА не генерируй URL. Используй только результаты search_web.
2. marketplace — это enum: "WB" или "Ozon". Без исключений.
3. Если нужна информация извне — ВЫЗОВИ search_web.
4. Ответ — валидный JSON по схеме. HTML = ошибка.
5. Не придумывай данные. Если нет информации — честно скажи.

ДОСТУПНЫЕ ИНСТРУМЕНТЫ:
- get_products: товары пользователя
- get_sales_stats: статистика продаж
- search_web: поиск в интернете (ЕДИНСТВЕННЫЙ источник URL!)
- calculate_unit_economics: расчёт маржинальности
- get_marketplace_info: справка по комиссиям

ФОРМАТ ОТВЕТА:
{
  "message": "текст ответа без HTML",
  "links": [{"title": "...", "url": "...", "source": "search_web"}],
  "actions": [{"type": "...", "details": {...}}]
}
```

---

## ✅ КРИТЕРИИ УСПЕХА

1. **Ссылки**: 100% ссылок приходят из tool results
2. **HTML**: 0% ответов содержат HTML-теги
3. **Marketplace**: Фильтрация на уровне данных
4. **Sentinel**: Cron job работает независимо от агента
5. **Latency**: < 5 секунд для простых запросов

---

## 🔗 СВЯЗАННЫЕ ФАЙЛЫ

- `src/api-lib/agent/orchestrator.ts` — основной рефакторинг
- `src/api-lib/agent/schemas.ts` — новые Zod-схемы
- `api/cron/check-prices.ts` — Sentinel cron job
- `src/api-lib/agent/prompts/system-v4.ts` — минимальный промпт

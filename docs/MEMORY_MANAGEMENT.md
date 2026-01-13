# 🧠 Memory Management — NeuroGUARDIAN

## Обзор

Memory Management — ключевой компонент профессиональной архитектуры агента V5, согласно курсу "Профессиональная Мультимодальная Архитектура Агента".

**Статус:** ✅ **Полностью интегрирован** (Session 47, 2026-01-13)

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                   AgentOrchestratorV5                           │
├─────────────────────────────────────────────────────────────────┤
│   1. Receive Message                                            │
│   2. saveMessage(userId, 'user', message)     ←── SHORT-TERM   │
│   3. Resolve Context                                            │
│   4. Plan & Execute Tools                                       │
│   5. Generate Answer                                            │
│   6. saveMessage(userId, 'assistant', answer) ←── SHORT-TERM   │
│   7. extractAndSaveFacts(...)                 ←── LONG-TERM    │
│   8. Return Result                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Компоненты

### 1. Short-Term Memory (Краткосрочная память)

**Таблица:** `agent_messages`

```sql
CREATE TABLE agent_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,           -- 'user' | 'assistant'
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Методы:**

- `saveMessage(userId, role, content)` — сохранить сообщение
- `getRecentHistory(userId, limit)` — получить последние N сообщений

**Использование:**

- Хранит историю диалога
- Автоматически архивируется (последние 50 сообщений)
- Используется для контекста в промптах

---

### 2. Long-Term Memory (Долгосрочная память)

**Таблица:** `memory_facts`

```sql
CREATE TABLE memory_facts (
  id TEXT PRIMARY KEY,            -- Уникальный хеш факта
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,             -- 'user_preference' | 'product_info' | 'business_rule' | 'resolved_issue'
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 0
);
```

**Типы фактов:**

| Type              | Описание                  | Пример                             |
| ----------------- | ------------------------- | ---------------------------------- |
| `user_preference` | Предпочтения пользователя | "Предпочитает краткие ответы"      |
| `product_info`    | Информация о товарах      | "Себестоимость 'Рейлинги' = 500₽"  |
| `business_rule`   | Бизнес-правила            | "Минимальная маржа 15%"            |
| `resolved_issue`  | Решённые проблемы         | "Проблема с ценой товара X решена" |

**Методы:**

- `saveImportantFact(userId, fact, type, overwrite)` — сохранить факт
- `searchRelevantFacts(userId, query)` — поиск релевантных фактов
- `getUserPreferences(userId)` — получить предпочтения пользователя
- `accessFact(factId)` — обновить статистику доступа

---

### 3. Memory Summaries (Суммирование памяти)

**Таблица:** `memory_summaries`

```sql
CREATE TABLE memory_summaries (
  user_id INTEGER PRIMARY KEY,
  total_facts INTEGER DEFAULT 0,
  last_summary_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  summary TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Методы:**

- `summarizeAndArchive(userId)` — суммировать и архивировать старую память
- `getMemoryStats(userId)` — получить статистику памяти

---

## Интеграция в Orchestrator V5

### Автоматическое сохранение сообщений

```typescript
// В AgentOrchestratorV5.orchestrate():

// Сохраняем сообщение пользователя
if (this.memoryEnabled) {
  await memoryManager.saveMessage(context.userId, 'user', message);
}

// ... обработка ...

// Сохраняем ответ ассистента
if (this.memoryEnabled) {
  await memoryManager.saveMessage(context.userId, 'assistant', answer.message);
  await this.extractAndSaveFacts(context.userId, message, answer.message, toolResults);
}
```

### Автоматическое извлечение фактов

Метод `extractAndSaveFacts` автоматически извлекает и сохраняет:

1. **Из результатов инструментов:**
   - `set_cost_price` → `product_info`: "Себестоимость X = Y₽"
   - `set_stop_loss` → `product_info`: "Минимальная цена X = Y₽"

2. **Из сообщений пользователя:**
   - Слова "кратко", "коротко" → `user_preference`: "Предпочитает краткие ответы"
   - Слова "подробно", "детально" → `user_preference`: "Предпочитает подробные ответы"
   - Паттерн "маржа не менее X%" → `business_rule`: "Минимальная маржа X%"

---

## Файлы

| Файл                                    | Описание                          |
| --------------------------------------- | --------------------------------- |
| `src/agent/core/MemoryManager.ts`       | Основной класс управления памятью |
| `src/agent/core/AgentOrchestratorV5.ts` | Интеграция памяти в оркестратор   |
| `docs/MEMORY_MANAGEMENT.md`             | Эта документация                  |

---

## API Reference

### MemoryManager

```typescript
class MemoryManager {
  // Short-term memory
  saveMessage(userId: number, role: 'user' | 'assistant', content: string): Promise<void>;
  getRecentHistory(userId: number, limit?: number): Promise<AgentMessage[]>;

  // Long-term memory
  saveImportantFact(
    userId: number,
    fact: string,
    type: FactType,
    overwrite?: boolean
  ): Promise<void>;
  searchRelevantFacts(userId: number, query: string): Promise<string[]>;
  getUserPreferences(userId: number): Promise<Record<string, string>>;
  accessFact(factId: string): Promise<void>;

  // Maintenance
  summarizeAndArchive(userId: number): Promise<void>;
  clearMemory(userId: number): Promise<void>;
  getMemoryStats(
    userId: number
  ): Promise<{ messageCount: number; factCount: number; lastSummaryAt?: Date }>;
}

// Singleton
export const memoryManager = new MemoryManager();
```

### FactType

```typescript
type FactType =
  | 'user_preference' // Предпочтения пользователя
  | 'product_info' // Информация о товарах
  | 'business_rule' // Бизнес-правила
  | 'resolved_issue'; // Решённые проблемы
```

---

## Тестирование

```typescript
import { memoryManager } from './src/agent/core/MemoryManager.js';

// Сохранить факт
await memoryManager.saveImportantFact(123456, 'Себестоимость "Рейлинги" = 500₽', 'product_info');

// Поиск релевантных фактов
const facts = await memoryManager.searchRelevantFacts(123456, 'рейлинги себестоимость');
console.log(facts); // ['Себестоимость "Рейлинги" = 500₽']

// Получить статистику
const stats = await memoryManager.getMemoryStats(123456);
console.log(stats); // { messageCount: 42, factCount: 5 }
```

---

## Соответствие курсу

| Концепция курса      | Реализация               |
| -------------------- | ------------------------ |
| Memory Management    | ✅ MemoryManager.ts      |
| Short-term memory    | ✅ agent_messages table  |
| Long-term memory     | ✅ memory_facts table    |
| Memory summarization | ✅ summarizeAndArchive() |
| Fact extraction      | ✅ extractAndSaveFacts() |
| Keyword search       | ✅ searchRelevantFacts() |

---

## TODO / Улучшения

- [ ] Добавить векторный поиск (embeddings) для более точного поиска фактов
- [ ] Интегрировать факты в промпты через PromptBuilder
- [ ] Добавить автоматическое суммирование по расписанию (cron)
- [ ] Улучшить извлечение фактов с помощью LLM

---

**Дата создания:** 2026-01-13
**Автор:** Antigravity AI
**Версия:** 1.0.0

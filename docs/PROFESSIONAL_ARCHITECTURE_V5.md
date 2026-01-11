# 🎯 NeuroGUARDIAN v5 — Профессиональная Мультиагентная Архитектура

## 📋 Документ разработан по принципам:

1. **Один класс = Одна задача** (Single Responsibility)
2. **Легко расширять** (Open/Closed Principle)
3. **Масштабируемость** (горизонтальная и вертикальная)
4. **Предсказуемость** (детерминированное поведение)
5. **Курс по AI архитектуре** (Dynamic Prompt, State, Memory, RAG)

---

# 🔍 КРИТИЧЕСКИЙ АНАЛИЗ ТЕКУЩЕЙ СИСТЕМЫ

## ❌ Архитектурные проблемы

### 1. МОНОЛИТНЫЙ TOOL-EXECUTORS (1990 строк!)

```
tool-executors.ts — 66KB, 33 функции
```

**Нарушает:** Single Responsibility, сложно тестировать, сложно расширять

### 2. СТАТИЧЕСКИЙ ПРОМПТ (570 строк!)

```
system-v5.ts — вся логика в одной строке
```

**Нарушает:** Курс (нужна динамическая сборка), дорого по токенам

### 3. GOD-CLASS: SentinelService

```
sentinel-service.ts — делает всё: мониторинг, защиту, уведомления, отчёты
```

**Нарушает:** Single Responsibility, сложно тестировать

### 4. ДУБЛИРОВАНИЕ ЛОГИКИ

- `price-guard.ts` и `price-shield.ts` — похожий функционал
- `yookassa.ts` и `yookassa-service.ts` — дублируют друг друга
- Три разных способа работы с ценами в разных файлах

### 5. ОТСУТСТВУЕТ STATE MANAGEMENT

- Агент "забывает" что спрашивал
- Нет отслеживания pending actions
- Нет контекстных ответов ("2500" → это ответ на какой вопрос?)

### 6. MEMORY SERVICE НЕ ИНТЕГРИРОВАН

- MemoryService существует, но orchestrator его НЕ использует
- Long-term memory не работает

---

# 🏗️ НОВАЯ АРХИТЕКТУРА v5

## Философия: "Lego-блоки"

Каждый компонент — независимый блок. Можно:

- Заменить один блок, не трогая остальные
- Добавить новый блок без изменения существующих
- Тестировать блоки изолированно

---

## 📁 Новая структура директорий

```
src/
├── core/                          # 🧠 ЯДРО (не меняется часто)
│   ├── types/                     # Все типы и интерфейсы
│   │   ├── agent.types.ts
│   │   ├── marketplace.types.ts
│   │   ├── user.types.ts
│   │   └── index.ts
│   ├── errors/                    # Типизированные ошибки
│   │   ├── AgentError.ts
│   │   ├── MarketplaceError.ts
│   │   └── index.ts
│   ├── config/                    # Конфигурация
│   │   ├── constants.ts
│   │   ├── env.ts
│   │   └── index.ts
│   └── utils/                     # Чистые утилиты
│       ├── currency.ts
│       ├── date.ts
│       └── validation.ts
│
├── domain/                        # 📋 БИЗНЕС-ЛОГИКА (чистая, без зависимостей)
│   ├── entities/                  # Бизнес-сущности
│   │   ├── Product.ts             # class Product { ... }
│   │   ├── User.ts
│   │   ├── Order.ts
│   │   ├── PriceRule.ts
│   │   └── Threat.ts
│   ├── services/                  # Бизнес-правила (stateless)
│   │   ├── UnitEconomicsCalculator.ts    # ТОЛЬКО расчёт экономики
│   │   ├── ThreatAnalyzer.ts             # ТОЛЬКО анализ угроз
│   │   ├── PriceOptimizer.ts             # ТОЛЬКО оптимизация цен
│   │   └── AbcAnalyzer.ts                # ТОЛЬКО ABC анализ
│   └── events/                    # Доменные события
│       ├── PriceChanged.ts
│       ├── ThreatDetected.ts
│       └── DefenseTriggered.ts
│
├── infrastructure/                # 🔌 ВНЕШНИЙ МИР (адаптеры)
│   ├── database/                  # Работа с PostgreSQL
│   │   ├── PostgresRepository.ts  # Базовый репозиторий
│   │   ├── UserRepository.ts
│   │   ├── ProductRepository.ts
│   │   ├── OrderRepository.ts
│   │   └── migrations/
│   ├── marketplace/               # API маркетплейсов
│   │   ├── MarketplaceAdapter.ts  # Интерфейс
│   │   ├── WildberriesAdapter.ts  # Реализация WB
│   │   ├── OzonAdapter.ts         # Реализация Ozon
│   │   └── MockMarketplace.ts     # Для тестов
│   ├── llm/                       # Провайдеры LLM
│   │   ├── LLMProvider.ts         # Интерфейс
│   │   ├── OpenRouterProvider.ts
│   │   ├── GroqProvider.ts
│   │   ├── OllamaProvider.ts
│   │   └── LLMRouter.ts           # Fallback логика
│   ├── messaging/                 # Отправка сообщений
│   │   ├── TelegramMessenger.ts
│   │   └── EmailMessenger.ts
│   ├── cache/                     # Кэширование
│   │   ├── RedisCache.ts
│   │   └── MemoryCache.ts
│   └── search/                    # Поисковые сервисы
│       ├── SerperSearch.ts
│       └── BrowserSearch.ts
│
├── agent/                         # 🤖 МУЛЬТИАГЕНТ (Viktor AI)
│   ├── core/                      # Ядро агента
│   │   ├── AgentOrchestrator.ts   # Главный координатор
│   │   ├── StateManager.ts        # Управление состоянием
│   │   ├── MemoryManager.ts       # Short + Long term memory
│   │   └── PromptBuilder.ts       # Динамическая сборка промпта
│   ├── planning/                  # Фаза планирования
│   │   ├── Planner.ts             # Выбор инструментов
│   │   ├── IntentClassifier.ts    # Классификация намерения
│   │   └── ContextResolver.ts     # Разрешение контекста ("2500" → cost_price)
│   ├── execution/                 # Фаза выполнения
│   │   ├── ToolRegistry.ts        # Реестр инструментов
│   │   ├── ToolExecutor.ts        # Выполнение инструментов
│   │   └── tools/                 # ОТДЕЛЬНЫЙ ФАЙЛ НА КАЖДЫЙ ИНСТРУМЕНТ
│   │       ├── GetProductsTool.ts
│   │       ├── GetSalesStatsTool.ts
│   │       ├── CalculateEconomicsTool.ts
│   │       ├── UpdatePriceTool.ts
│   │       ├── SetStopLossTool.ts
│   │       ├── SearchWebTool.ts
│   │       └── index.ts           # Регистрация всех
│   ├── answering/                 # Фаза ответа
│   │   ├── Answerer.ts            # Формирование ответа
│   │   ├── ResponseFormatter.ts   # Форматирование
│   │   └── LinkValidator.ts       # Валидация ссылок
│   ├── knowledge/                 # RAG и знания
│   │   ├── KnowledgeBase.ts
│   │   ├── DocumentRetriever.ts
│   │   └── documents/
│   │       ├── wb-commissions.md
│   │       ├── ozon-commissions.md
│   │       └── faq.md
│   └── prompts/                   # Промпты (модульные)
│       ├── core/
│       │   ├── personality.ts     # Личность Viktor (20 строк)
│       │   ├── rules.ts           # Правила (20 строк)
│       │   └── format.ts          # Формат ответа
│       ├── tools/
│       │   ├── tool-descriptions.ts
│       │   └── tool-examples.ts
│       └── dynamic/
│           ├── user-context.ts    # Генерация контекста пользователя
│           └── few-shot.ts        # Динамические примеры
│
├── sentinel/                      # 🛡️ SENTINEL (Автономный страж)
│   ├── SentinelOrchestrator.ts    # Координатор цикла
│   ├── PriceMonitor.ts            # ТОЛЬКО мониторинг цен
│   ├── ThreatDetector.ts          # ТОЛЬКО детекция угроз
│   ├── DefenseExecutor.ts         # ТОЛЬКО выполнение защиты
│   ├── ReportGenerator.ts         # ТОЛЬКО генерация отчётов
│   └── AlertSender.ts             # ТОЛЬКО отправка алертов
│
├── application/                   # 🎯 USE CASES (сценарии)
│   ├── commands/                  # Команды (изменяют данные)
│   │   ├── UpdatePriceCommand.ts
│   │   ├── SetProtectionCommand.ts
│   │   ├── SyncProductsCommand.ts
│   │   └── ProcessPaymentCommand.ts
│   ├── queries/                   # Запросы (только читают)
│   │   ├── GetDashboardQuery.ts
│   │   ├── GetAnalyticsQuery.ts
│   │   └── GetProductsQuery.ts
│   └── handlers/                  # Обработчики событий
│       ├── OnPriceDropped.ts
│       ├── OnThreatDetected.ts
│       └── OnPaymentReceived.ts
│
└── presentation/                  # 🌐 ТОЧКИ ВХОДА
    ├── api/                       # REST API handlers
    │   ├── AgentHandler.ts
    │   ├── SentinelHandler.ts
    │   ├── ProductsHandler.ts
    │   └── PaymentHandler.ts
    ├── telegram/                  # Telegram webhook
    │   ├── TelegramHandler.ts
    │   ├── CallbackHandler.ts
    │   └── CommandHandler.ts
    └── cron/                      # CRON jobs
        ├── SentinelCron.ts
        └── ReportCron.ts
```

---

## 🔄 ПОТОК ДАННЫХ (Data Flow)

### Запрос от пользователя:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           USER MESSAGE                                    │
│                         "какая прибыль на рейлинги"                      │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         1. PRESENTATION LAYER                             │
│                                                                           │
│   TelegramHandler.ts                                                     │
│   ├── Извлечь userId, message                                            │
│   ├── Валидировать входные данные                                        │
│   └── Передать в AgentOrchestrator                                       │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          2. AGENT LAYER                                   │
│                                                                           │
│   AgentOrchestrator.ts                                                   │
│   ├── StateManager.getState(userId)         // Загрузить состояние       │
│   ├── MemoryManager.getHistory(userId)      // Загрузить историю         │
│   ├── ContextResolver.resolve(message)      // Понять контекст           │
│   ├── PromptBuilder.build(state, history)   // Собрать промпт            │
│   │                                                                       │
│   │   ┌─────────────────────────────────────────────────────────────┐    │
│   │   │ DYNAMIC PROMPT ASSEMBLY                                      │    │
│   │   │                                                              │    │
│   │   │ [Core Personality]     — 20 tokens                          │    │
│   │   │ + [User State]         — 10 tokens (marketplace, products)  │    │
│   │   │ + [RAG: Commission]    — 30 tokens (если нужно)             │    │
│   │   │ + [History]            — 50 tokens (последние 3 сообщения)  │    │
│   │   │ + [Tool Descriptions]  — 100 tokens (только нужные)         │    │
│   │   │ = ~210 tokens (вместо 1500!)                                │    │
│   │   └─────────────────────────────────────────────────────────────┘    │
│   │                                                                       │
│   ├── Planner.plan(prompt, message)         // LLM: какие tool вызвать   │
│   ├── ToolExecutor.execute(plan)            // Выполнить tools           │
│   ├── Answerer.answer(results)              // LLM: сформировать ответ   │
│   ├── LinkValidator.validate(answer)        // Проверить ссылки          │
│   ├── StateManager.saveState(userId, state) // Сохранить состояние       │
│   └── MemoryManager.saveExchange(userId)    // Сохранить в память        │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         3. DOMAIN LAYER                                   │
│                                                                           │
│   Чистая бизнес-логика (вызывается из tools):                            │
│   ├── UnitEconomicsCalculator.calculate(product, costPrice)              │
│   ├── ThreatAnalyzer.analyze(product, livePrice, minPrice)               │
│   └── AbcAnalyzer.analyze(salesHistory)                                  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       4. INFRASTRUCTURE LAYER                             │
│                                                                           │
│   Адаптеры к внешнему миру:                                               │
│   ├── ProductRepository.findByUserId(userId)                             │
│   ├── WildberriesAdapter.fetchPrices(apiKey, nmIds)                      │
│   └── LLMRouter.complete(messages)                                        │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           5. RESPONSE                                     │
│                                                                           │
│   "📊 Рейлинг металлический, артикул 12345:                              │
│    Цена: 1500₽, Себестоимость: 500₽                                       │
│    Чистая прибыль: 650₽ (43%)"                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🧠 STATE MANAGEMENT (Критически важно!)

```typescript
// agent/core/StateManager.ts

interface UserState {
  // === STATIC (редко меняется) ===
  marketplace: 'WB' | 'Ozon' | 'both';
  hasApiKeys: boolean;
  productsCount: number;
  subscriptionTier: 'free' | 'basic' | 'pro';

  // === DYNAMIC (каждая сессия) ===
  currentIntent?: string; // "calculate_profit"
  pendingAction?: {
    // Ожидаем подтверждения?
    type: 'update_price' | 'set_stop_loss';
    productId: string;
    params: Record<string, unknown>;
  };
  awaitingInput?: {
    // Ожидаем ввод?
    type: 'cost_price' | 'period' | 'product_name';
    forProductId?: string;
    question: string;
  };
  lastMentionedProducts: string[]; // Последние упомянутые товары

  // === META ===
  lastActiveAt: Date;
  sessionStartedAt: Date;
  totalQueries: number;
}

class StateManager {
  async getState(userId: number): Promise<UserState>;
  async updateState(userId: number, partial: Partial<UserState>): Promise<void>;
  async clearPendingAction(userId: number): Promise<void>;
  async setAwaitingInput(userId: number, type: string, forProductId?: string): Promise<void>;
}
```

### Пример использования State:

```
Пользователь: "посчитай прибыль на рейлинги"
→ Agent находит товар, но нет cost_price
→ Agent: "Какая себестоимость у рейлингов?"
→ StateManager.setAwaitingInput('cost_price', 'product_123')

Пользователь: "2500"
→ StateManager.getState() → awaitingInput.type === 'cost_price'
→ ContextResolver: "2500" — это ответ на вопрос о себестоимости!
→ Agent вызывает calculate_unit_economics({ product_id: 'product_123', cost_price: 2500 })
```

---

## 📊 MEMORY MANAGEMENT

```typescript
// agent/core/MemoryManager.ts

class MemoryManager {
  // === SHORT-TERM (в промпте) ===
  async getRecentHistory(userId: number, limit: number = 5): Promise<Message[]>;

  // === LONG-TERM (в векторной БД) ===
  async saveImportantFact(userId: number, fact: string, type: FactType): Promise<void>;
  async searchRelevantFacts(userId: number, query: string): Promise<string[]>;

  // === AUTO SUMMARIZATION ===
  async summarizeAndArchive(userId: number): Promise<void>;
}

// Типы фактов для long-term memory
type FactType =
  | 'user_preference' // "Пользователь предпочитает краткие ответы"
  | 'product_info' // "Себестоимость рейлингов = 500₽"
  | 'business_rule' // "Минимальная маржа 15%"
  | 'resolved_issue'; // "Проблема с ценой товара X решена"
```

---

## 🔧 TOOL REGISTRATION (Расширяемость)

```typescript
// agent/execution/ToolRegistry.ts

interface Tool {
  name: string;
  description: string;
  schema: z.ZodSchema;
  execute: (userId: number, args: unknown) => Promise<ToolResult>;

  // Метаданные для промпта
  category: 'read' | 'write' | 'analyze';
  requiresConfirmation: boolean;
  examples?: string[];
}

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getToolsForPrompt(categories?: string[]): string {
    // Возвращает описания только нужных tools
  }

  async execute(toolName: string, userId: number, args: unknown): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) throw new ToolNotFoundError(toolName);

    const validated = tool.schema.parse(args);
    return tool.execute(userId, validated);
  }
}

// Регистрация инструмента (один файл = один tool)
// agent/execution/tools/GetProductsTool.ts

export const getProductsTool: Tool = {
  name: 'get_products',
  description: 'Получить список товаров пользователя',
  schema: z.object({
    search: z.string().optional(),
    marketplace: z.enum(['WB', 'Ozon']).optional(),
    limit: z.number().default(20),
  }),
  category: 'read',
  requiresConfirmation: false,
  examples: [
    'User: "покажи мои товары" → get_products({})',
    'User: "найди рейлинги" → get_products({ search: "рейлинг" })',
  ],

  async execute(userId, args) {
    const repo = new ProductRepository();
    const products = await repo.findByUserId(userId, args);
    return { success: true, data: products };
  },
};

// Регистрация всех tools
// agent/execution/tools/index.ts

import { toolRegistry } from '../ToolRegistry';
import { getProductsTool } from './GetProductsTool';
import { getSalesStatsTool } from './GetSalesStatsTool';
// ... все tools

export function registerAllTools() {
  toolRegistry.register(getProductsTool);
  toolRegistry.register(getSalesStatsTool);
  // ...
}
```

### Добавление нового инструмента:

```typescript
// 1. Создать файл: agent/execution/tools/NewTool.ts
export const newTool: Tool = { ... };

// 2. Зарегистрировать в index.ts
import { newTool } from './NewTool';
toolRegistry.register(newTool);

// 3. ВСЁ! Промпт обновится автоматически
```

---

## 🛡️ SENTINEL РЕФАКТОРИНГ

Текущий SentinelService (617 строк) → 5 классов:

```typescript
// sentinel/SentinelOrchestrator.ts — КООРДИНАТОР
class SentinelOrchestrator {
  constructor(
    private priceMonitor: PriceMonitor,
    private threatDetector: ThreatDetector,
    private defenseExecutor: DefenseExecutor,
    private reportGenerator: ReportGenerator,
    private alertSender: AlertSender,
  ) {}

  async runCycle(): Promise<CycleResult> {
    const users = await this.getActiveUsers();

    for (const user of users) {
      // 1. Мониторинг
      const prices = await this.priceMonitor.fetchAll(user);

      // 2. Детекция угроз
      const threats = await this.threatDetector.analyze(user, prices);

      // 3. Защита
      for (const threat of threats) {
        await this.defenseExecutor.execute(user, threat);
      }

      // 4. Отчёт
      const report = await this.reportGenerator.generate(user, threats);

      // 5. Алерт
      await this.alertSender.send(user, report);
    }
  }
}

// sentinel/PriceMonitor.ts — ТОЛЬКО мониторинг
class PriceMonitor {
  async fetchAll(user: User): Promise<Map<string, number>> { ... }
}

// sentinel/ThreatDetector.ts — ТОЛЬКО анализ
class ThreatDetector {
  analyze(user: User, prices: Map<string, number>): Threat[] { ... }
}

// sentinel/DefenseExecutor.ts — ТОЛЬКО защита
class DefenseExecutor {
  async execute(user: User, threat: Threat): Promise<DefenseResult> { ... }
}

// sentinel/ReportGenerator.ts — ТОЛЬКО отчёты
class ReportGenerator {
  generate(user: User, threats: Threat[]): Report { ... }
}

// sentinel/AlertSender.ts — ТОЛЬКО отправка
class AlertSender {
  async send(user: User, report: Report): Promise<void> { ... }
}
```

---

## 📈 ПЛАН МИГРАЦИИ

### Фаза 1: Core и Infrastructure (3-4 часа)

1. Создать `core/types/` с интерфейсами
2. Создать `core/errors/` с типизированными ошибками
3. Создать `infrastructure/llm/LLMRouter.ts`

### Фаза 2: State и Memory (2-3 часа)

1. Создать `agent/core/StateManager.ts`
2. Интегрировать существующий MemoryService
3. Добавить таблицу `user_state` в PostgreSQL

### Фаза 3: Dynamic Prompt (2-3 часа)

1. Разбить system-v5.ts на модули
2. Создать `agent/core/PromptBuilder.ts`
3. Интегрировать RAG (KnowledgeBase)

### Фаза 4: Tool Registry (3-4 часа)

1. Создать `agent/execution/ToolRegistry.ts`
2. Разбить tool-executors.ts на отдельные файлы
3. Создать автоматическую регистрацию

### Фаза 5: Sentinel Refactor (2-3 часа)

1. Разбить SentinelService на 5 классов
2. Создать `sentinel/SentinelOrchestrator.ts`

### Фаза 6: Интеграция и тесты (2-3 часа)

1. Подключить новую архитектуру
2. Написать unit-тесты на ключевые компоненты
3. E2E тест полного цикла

---

## ✅ ИТОГО

| Компонент           | Было                   | Станет                     | Выгода                |
| ------------------- | ---------------------- | -------------------------- | --------------------- |
| tool-executors.ts   | 1990 строк             | 20 файлов по ~80 строк     | Легко добавлять tools |
| system-v5.ts        | 570 строк, статический | Динамический, ~200 токенов | -70% стоимости LLM    |
| sentinel-service.ts | 617 строк, 1 класс     | 5 классов по ~100 строк    | Легко тестировать     |
| State Management    | ❌ Нет                 | ✅ StateManager            | Контекстные ответы    |
| Memory              | Не используется        | ✅ Интегрировано           | Long-term память      |

---

**ГОТОВ НАЧАТЬ РЕАЛИЗАЦИЮ?**

Предлагаю начать с **Фазы 1 + 2** (Core + State) — это фундамент.

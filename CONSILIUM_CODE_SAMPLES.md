# 📝 ПРИМЕРЫ КОДА ДЛЯ АНАЛИЗА КОНСИЛИУМОМ

**Дата:** 2025-12-28  
**Цель:** Предоставить конкретные примеры кода для каждой роли консилиума

---

## 🔴 Для Security Auditor

### Пример 1: Admin API Authentication

```typescript
// api/handlers/admin.ts (строки ~15-30)
export async function POST(req: Request) {
  try {
    const adminKey = req.headers.get('x-admin-key');

    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }

    const body = await req.json();
    const { action } = body;

    // ... обработка действий
  } catch (error) {
    logger.error('Admin API error', { error });
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
    });
  }
}
```

**Вопросы для анализа:**

- ✅ Достаточно ли безопасна проверка `adminKey !== process.env.ADMIN_API_KEY`?
- ⚠️ Можно ли провести timing attack?
- ⚠️ Есть ли rate limiting?
- ⚠️ Логируется ли попытка несанкционированного доступа?

---

### Пример 2: Database Reset Endpoint

```typescript
// api/handlers/admin.ts (строки ~100-120)
async function handleResetDb(confirm?: string) {
  const isProduction = process.env.VERCEL_ENV === 'production';

  if (isProduction) {
    return {
      success: false,
      error: 'DISABLED in production for safety',
    };
  }

  if (confirm !== 'RESET_ALL_DATA') {
    return {
      success: false,
      error: 'Confirmation required',
    };
  }

  await sql`TRUNCATE TABLE users CASCADE`;
  await sql`TRUNCATE TABLE products CASCADE`;
  // ... остальные таблицы

  return { success: true };
}
```

**Вопросы для анализа:**

- ✅ Правильно ли проверяется production environment?
- ⚠️ Достаточно ли защиты через `confirm` параметр?
- ⚠️ Нужен ли дополнительный audit log?
- ⚠️ Что если `VERCEL_ENV` не установлен?

---

### Пример 3: User Input Validation

```typescript
// src/api-lib/agent/tool-executors.ts (строки ~200-220)
export async function executeUpdatePrices(args: unknown, userId: string): Promise<ToolResult> {
  try {
    // Zod validation
    const validated = updatePricesArgsSchema.parse(args);
    const { product_ids, new_prices, marketplace } = validated;

    // Fetch products
    const products = await getProductsByIds(product_ids, userId);

    // Update prices
    for (let i = 0; i < product_ids.length; i++) {
      const product = products.find(p => p.id === product_ids[i]);
      if (!product) continue;

      await updateProductPrice(product.id, new_prices[i], marketplace);
    }

    return { success: true, data: { updated: product_ids.length } };
  } catch (error) {
    logger.error('Price update failed', { error, userId });
    return { success: false, error: 'Failed to update prices' };
  }
}
```

**Вопросы для анализа:**

- ✅ Используется ли Zod validation?
- ⚠️ Проверяется ли, что пользователь владеет продуктами?
- ⚠️ Есть ли защита от SQL injection?
- ⚠️ Логируются ли изменения цен для аудита?

---

## 🟡 Для QA Engineer

### Пример 4: Тест для Price Updates

```typescript
// tests/marketplace/price-updates.test.ts (строки ~50-80)
describe('executeUpdatePrices', () => {
  it('should update prices for valid products', async () => {
    const userId = 'test-user';
    const args = {
      product_ids: [1, 2],
      new_prices: [1000, 2000],
      marketplace: 'wildberries',
    };

    const result = await executeUpdatePrices(args, userId);

    expect(result.success).toBe(true);
    expect(result.data.updated).toBe(2);
  });

  it('should reject invalid prices', async () => {
    const args = {
      product_ids: [1],
      new_prices: [-100], // Отрицательная цена
      marketplace: 'wildberries',
    };

    await expect(executeUpdatePrices(args, 'user')).rejects.toThrow();
  });
});
```

**Вопросы для анализа:**

- ⚠️ Покрыты ли все edge cases?
  - Что если `product_ids` пустой?
  - Что если `new_prices.length !== product_ids.length`?
  - Что если API маркетплейса недоступен?
  - Что если пользователь не владеет продуктом?
- ⚠️ Есть ли тесты для concurrent updates?
- ⚠️ Тестируется ли rollback при ошибке?

---

### Пример 5: Отсутствующие тесты

```typescript
// src/api-lib/agent/tool-executors.ts
// ❌ НЕТ ТЕСТОВ для этих функций:

export async function executeSetStopLoss(args: unknown, userId: string) {
  // ~50 строк кода
  // Критическая функция для защиты от демпинга
  // ❌ НЕТ UNIT ТЕСТОВ
}

export async function executeBulkProtectProducts(args: unknown, userId: string) {
  // ~80 строк кода
  // Массовая операция
  // ❌ НЕТ INTEGRATION ТЕСТОВ
}

export async function executeUpdateStocks(args: unknown, userId: string) {
  // ~60 строк кода
  // Обновление остатков на складе
  // ❌ НЕТ E2E ТЕСТОВ
}
```

**Задачи для QA:**

- [ ] Написать unit тесты для `executeSetStopLoss`
- [ ] Написать integration тесты для `executeBulkProtectProducts`
- [ ] Написать E2E тесты для `executeUpdateStocks`
- [ ] Добавить тесты для error handling в каждой функции

---

## 🟢 Для DevOps Architect

### Пример 6: CI Pipeline

```yaml
# .github/workflows/ci.yml (строки 13-56)
lint-build-test:
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run ESLint
      run: npm run lint

    - name: TypeScript Check
      run: npm run typecheck

    - name: Build
      run: npm run build

    - name: Run Unit & Integration Tests
      run: npm test

    - name: Check bundle size
      run: |
        if [ -d "dist/assets" ]; then
          BUNDLE_SIZE=$(du -sb dist/assets/*.js 2>/dev/null | awk '{sum+=$1} END {print sum}')
          MAX_SIZE=500000
          if [ ! -z "$BUNDLE_SIZE" ] && [ $BUNDLE_SIZE -gt $MAX_SIZE ]; then
            echo "❌ Bundle size ($BUNDLE_SIZE bytes) exceeds limit ($MAX_SIZE bytes)"
            exit 1
          fi
          echo "✅ Bundle size OK: $BUNDLE_SIZE bytes"
        fi
```

**Вопросы для анализа:**

- ⚠️ Что происходит после успешного CI?
  - Автоматический deploy?
  - Manual approval?
- ⚠️ Есть ли staging environment?
- ⚠️ Как откатиться, если production сломался?
- ⚠️ Есть ли smoke tests после деплоя?
- ⚠️ Мониторится ли production после деплоя?

---

### Пример 7: Deployment на Vercel

```json
// vercel.json (если существует)
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "outputDirectory": "dist"
}
```

**Вопросы для анализа:**

- ⚠️ Есть ли health check endpoint?
- ⚠️ Настроены ли environment variables?
- ⚠️ Есть ли preview deployments для PR?
- ⚠️ Настроены ли алерты на ошибки?

---

## 🔵 Для Code Reviewer

### Пример 8: Сложная функция (Code Smell)

```typescript
// src/api-lib/agent/orchestrator-v4.ts (строки ~150-250)
export async function orchestrateAgentRequest(
  userMessage: string,
  userId: string,
  conversationId: string,
  chatHistory: ChatMessage[]
): Promise<AgentResponse> {
  // ⚠️ Функция ~100 строк (слишком много!)

  // 1. Загрузка pending actions из KV
  const pendingKey = `pending:${userId}:${conversationId}`;
  const pendingAction = await kv.get<PendingAction>(pendingKey);

  // 2. Проверка на confirmation
  if (pendingAction && isConfirmationMessage(userMessage)) {
    // ... 20 строк обработки подтверждения
  }

  // 3. Вызов LLM для планирования
  const planPrompt = buildPlanPrompt(userMessage, chatHistory);
  const planResponse = await callSpecialist('planner', planPrompt);

  // 4. Парсинг плана
  const plan = parsePlanResponse(planResponse);

  // 5. Выполнение инструментов
  const toolResults = [];
  for (const tool of plan.tools) {
    const result = await executeToolCall(tool, userId);
    toolResults.push(result);
  }

  // 6. Генерация ответа
  const answerPrompt = buildAnswerPrompt(userMessage, toolResults);
  const answer = await callSpecialist('answerer', answerPrompt);

  // 7. Сохранение в историю
  await saveChatHistory(conversationId, userMessage, answer);

  return {
    message: answer,
    toolCalls: plan.tools,
    results: toolResults,
  };
}
```

**Вопросы для анализа:**

- ⚠️ Нужно ли разбить на меньшие функции?
- ⚠️ Слишком много ответственностей?
- ⚠️ Сложно тестировать?
- ⚠️ Сложно поддерживать?

**Предложение:**

```typescript
// Рефакторинг:
async function orchestrateAgentRequest(...) {
  const pendingAction = await loadPendingAction(userId, conversationId);

  if (pendingAction && isConfirmation(userMessage)) {
    return await handleConfirmation(pendingAction, userMessage, userId);
  }

  const plan = await generatePlan(userMessage, chatHistory);
  const results = await executeTools(plan.tools, userId);
  const answer = await generateAnswer(userMessage, results);

  await saveHistory(conversationId, userMessage, answer);

  return { message: answer, toolCalls: plan.tools, results };
}
```

---

### Пример 9: Дублирование кода

```typescript
// src/api-lib/services/marketplace.ts

// ⚠️ Дублирование: Wildberries price update
async function updateWildberriesPrice(productId: number, price: number) {
  const response = await fetch('https://suppliers-api.wildberries.ru/public/api/v1/prices', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ nmId: productId, price }]),
  });

  if (!response.ok) {
    throw new Error(`WB API error: ${response.status}`);
  }

  return await response.json();
}

// ⚠️ Дублирование: Ozon price update
async function updateOzonPrice(offerId: string, price: number) {
  const response = await fetch('https://api-seller.ozon.ru/v1/product/import/prices', {
    method: 'POST',
    headers: {
      'Client-Id': clientId,
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prices: [{ offer_id: offerId, price: String(price) }] }),
  });

  if (!response.ok) {
    throw new Error(`Ozon API error: ${response.status}`);
  }

  return await response.json();
}
```

**Проблема:** Почти идентичная логика, только URL и формат разные

**Предложение:**

```typescript
// Рефакторинг с использованием стратегии
interface MarketplaceAdapter {
  updatePrice(productId: string, price: number): Promise<void>;
  updateStock(productId: string, stock: number): Promise<void>;
}

class WildberriesAdapter implements MarketplaceAdapter {
  async updatePrice(nmId: string, price: number) {
    return this.makeRequest('/prices', [{ nmId: Number(nmId), price }]);
  }

  private async makeRequest(endpoint: string, body: any) {
    // Общая логика для всех WB запросов
  }
}

class OzonAdapter implements MarketplaceAdapter {
  async updatePrice(offerId: string, price: number) {
    return this.makeRequest('/import/prices', {
      prices: [{ offer_id: offerId, price: String(price) }],
    });
  }

  private async makeRequest(endpoint: string, body: any) {
    // Общая логика для всех Ozon запросов
  }
}
```

---

## 🟣 Для Product Owner

### Пример 10: Критическая функция без мониторинга

```typescript
// api/handlers/sentinel.ts (строки ~50-100)
export async function checkPricesAndProtect() {
  logger.info('🛡️ Sentinel: Starting price check');

  // Получаем все продукты с защитой
  const protectedProducts = await sql`
    SELECT * FROM products 
    WHERE stop_loss_enabled = true
  `;

  for (const product of protectedProducts) {
    // Проверяем текущую цену на маркетплейсе
    const currentPrice = await fetchCurrentPrice(product);

    // Если цена упала ниже минимальной
    if (currentPrice < product.min_price) {
      logger.warn('🚨 Price drop detected', {
        productId: product.id,
        currentPrice,
        minPrice: product.min_price,
      });

      // Устанавливаем защитную цену
      await setDefensePrice(product);

      // ❌ НЕТ: Уведомления пользователя
      // ❌ НЕТ: Метрики для мониторинга
      // ❌ НЕТ: Алерта в Telegram
    }
  }

  logger.info('✅ Sentinel: Price check completed');
}
```

**Вопросы для Product Owner:**

- ⚠️ Насколько критична эта функция для бизнеса?
- ⚠️ Что произойдёт, если она сломается?
  - Пользователи потеряют деньги из-за демпинга?
  - Как быстро мы узнаем о проблеме?
- ⚠️ Какие метрики нужно отслеживать?
  - Количество срабатываний защиты в день?
  - Средняя разница между текущей и минимальной ценой?
  - Процент успешных обновлений цен?
- ⚠️ Нужны ли алерты?
  - Telegram уведомление при срабатывании?
  - Email при ошибке?
  - Dashboard для мониторинга?

---

### Пример 11: Фейковая аналитика (исправлено, но нужен мониторинг)

```typescript
// src/api-lib/agent/tool-executors.ts (строки ~400-450)
export async function executeGetAbcAnalysis(args: unknown, userId: string): Promise<ToolResult> {
  // ✅ ИСПРАВЛЕНО: Теперь использует реальные данные
  const orders = await sql`
    SELECT 
      p.id,
      p.title,
      SUM(mo.quantity * mo.price) as revenue
    FROM marketplace_orders mo
    JOIN products p ON p.id = mo.product_id
    WHERE p.user_id = ${userId}
      AND mo.order_date >= NOW() - INTERVAL '90 days'
    GROUP BY p.id, p.title
    ORDER BY revenue DESC
  `;

  // Классификация ABC
  const totalRevenue = orders.reduce((sum, o) => sum + o.revenue, 0);
  let cumulative = 0;

  const classified = orders.map(order => {
    cumulative += order.revenue;
    const percentage = (cumulative / totalRevenue) * 100;

    let category;
    if (percentage <= 80) category = 'A';
    else if (percentage <= 95) category = 'B';
    else category = 'C';

    return { ...order, category };
  });

  return {
    success: true,
    data: {
      products: classified,
      summary: {
        total_revenue: totalRevenue,
        a_products: classified.filter(p => p.category === 'A').length,
        b_products: classified.filter(p => p.category === 'B').length,
        c_products: classified.filter(p => p.category === 'C').length,
      },
    },
  };
}
```

**Вопросы для Product Owner:**

- ✅ Функция исправлена и использует реальные данные
- ⚠️ Но нужен ли мониторинг использования?
  - Сколько раз в день пользователи запрашивают ABC-анализ?
  - Какой средний размер выборки?
  - Есть ли проблемы с производительностью?
- ⚠️ Нужна ли валидация результатов?
  - Что если у пользователя нет заказов за 90 дней?
  - Что если все продукты в категории C?
- ⚠️ Нужны ли дополнительные метрики?
  - Conversion rate по категориям?
  - Profit margin по категориям?

---

## 📊 МАТРИЦА ПОКРЫТИЯ ТЕСТАМИ

| Функция                      | Unit | Integration | E2E | Приоритет |
| ---------------------------- | ---- | ----------- | --- | --------- |
| `executeUpdatePrices`        | ✅   | ✅          | ❌  | P0        |
| `executeUpdateStocks`        | ❌   | ❌          | ❌  | P0        |
| `executeSetStopLoss`         | ❌   | ❌          | ❌  | P0        |
| `executeBulkProtectProducts` | ❌   | ❌          | ❌  | P1        |
| `executeGetAbcAnalysis`      | ✅   | ❌          | ❌  | P1        |
| `executeGetStockForecast`    | ✅   | ❌          | ❌  | P1        |
| `checkPricesAndProtect`      | ❌   | ❌          | ❌  | P0        |
| `syncSalesHistory`           | ❌   | ❌          | ❌  | P1        |
| `handleResetDb`              | ❌   | ✅          | ❌  | P0        |
| `orchestrateAgentRequest`    | ✅   | ✅          | ❌  | P0        |

**Легенда:**

- ✅ Есть тесты
- ❌ Нет тестов
- P0 = Критично
- P1 = Важно

---

## 🎯 КОНКРЕТНЫЕ ЗАДАЧИ ДЛЯ КОНСИЛИУМА

### Security Auditor:

1. Проверить все примеры 1-3
2. Найти дополнительные security issues
3. Предложить конкретные исправления
4. Оценить риски (Low/Medium/High/Critical)

### QA Engineer:

1. Проанализировать матрицу покрытия
2. Написать тест-кейсы для функций без тестов
3. Найти edge cases в примерах 4-5
4. Предложить стратегию тестирования

### DevOps Architect:

1. Проанализировать примеры 6-7
2. Предложить улучшения CI/CD
3. Спроектировать систему мониторинга
4. Разработать стратегию deployment

### Code Reviewer:

1. Найти code smells в примерах 8-9
2. Предложить рефакторинг
3. Оценить cyclomatic complexity
4. Проверить соблюдение best practices

### Product Owner:

1. Оценить бизнес-риски в примерах 10-11
2. Приоритизировать функции
3. Предложить метрики для мониторинга
4. Определить acceptance criteria

---

**Используйте эти примеры как отправную точку для глубокого анализа!**

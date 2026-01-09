# 🧪 AI Agent Testing & Observability Guide

## Обзор инструментов для тестирования AI агентов

### 🥇 Рекомендованные решения для NeuroGUARDIAN

| Инструмент        | Назначение               | Цена        | Интеграция |
| ----------------- | ------------------------ | ----------- | ---------- |
| **Langfuse**      | Трейсинг, метрики, логи  | Open-source | 30 мин     |
| **LangSmith**     | Полный стек от LangChain | Freemium    | 1 час      |
| **Arize Phoenix** | Debugging, дашборды      | Open-source | 1 час      |
| **Vitest E2E**    | Юнит-тесты агента        | Бесплатно   | ✅ Готово  |

---

## 📊 Langfuse — Open-Source Observability

### Установка

```bash
# Self-hosted (Docker)
docker run -d \
  -e DATABASE_URL=postgres://... \
  -e NEXTAUTH_SECRET=... \
  -p 3000:3000 \
  langfuse/langfuse:latest

# Или используй облако: https://cloud.langfuse.com
```

### Интеграция в orchestrator-v4.ts

```typescript
import Langfuse from 'langfuse';

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
});

export async function orchestrateV4WithTracing(
  message: string,
  context: UserContext,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<OrchestratorV4Result> {
  // Создаём trace для всего запроса
  const trace = langfuse.trace({
    name: 'viktor-chat',
    userId: String(context.userId),
    metadata: {
      marketplace: context.marketplace,
      productsCount: context.productsCount,
    },
  });

  try {
    // Phase 1: Planning
    const planSpan = trace.span({
      name: 'planner',
      input: { message, hasHistory: !!conversationHistory?.length },
    });

    const planResult = await callPlanner(message, context, conversationHistory);

    planSpan.end({
      output: planResult.plan,
      metadata: { tokensUsed: planResult.tokensUsed },
    });

    // Phase 2: Tool Execution
    for (const tool of planResult.plan?.tools || []) {
      const toolSpan = trace.span({
        name: `tool:${tool.tool}`,
        input: tool.args,
      });

      const result = await executeTool(tool.tool, tool.args, context.userId);

      toolSpan.end({
        output: result,
        level: result.success ? 'DEFAULT' : 'ERROR',
      });
    }

    // Phase 3: Answering
    const answerSpan = trace.span({ name: 'answerer' });
    const answer = await callAnswerer(message, toolResults, context);
    answerSpan.end({ output: answer });

    // Успешное завершение
    trace.update({ output: answer.message });

    return result;
  } catch (error) {
    trace.update({
      level: 'ERROR',
      statusMessage: String(error),
    });
    throw error;
  } finally {
    await langfuse.flushAsync();
  }
}
```

### Что получишь в дашборде:

- 📊 **Latency breakdown** — сколько занимает каждый этап
- 💰 **Cost tracking** — стоимость токенов по дням
- ❌ **Error rates** — % ошибок по инструментам
- 🔍 **Trace explorer** — полный путь каждого запроса
- 📈 **User analytics** — топ пользователей, retention

---

## 🧪 Собственный Test Suite

Мы создали `tests/agent/viktor-e2e.test.ts` с 15+ сценариями:

### Категории тестов:

1. **Tool Selection** — правильный выбор инструментов
2. **Context Continuation** — понимание контекста диалога
3. **Simple Intent** — приветствия, благодарности
4. **Error Handling** — обработка ошибок
5. **Protection** — тесты защиты цен

### Запуск:

```bash
# Все тесты
npm test tests/agent/viktor-e2e.test.ts

# Конкретный сценарий
npx vitest run -t "Юнит-экономика по названию товара"
```

### Пример вывода:

```
═══════════════════════════════════════════════════════════════
                   VIKTOR AI AGENT TEST REPORT
═══════════════════════════════════════════════════════════════

📊 Summary: 12/15 passed (3 failed)
⏱️  Total time: 45.23s

📁 tool_selection: 4/4
   ✅ Юнит-экономика по названию товара (2341ms)
   ✅ Конкуренты без артикула (1823ms)
   ✅ Продажи без периода (987ms)
   ✅ Продажи с периодом (1234ms)

📁 context: 1/2
   ✅ Ответ на вопрос о себестоимости (2100ms)
   ❌ Ответ на вопрос о периоде (1500ms)
      Error: Expected period 'month' but got 'week'
```

---

## 🔧 Рекомендации по доработке агента для монетизации

### 1. Критические улучшения

```typescript
// 1. Rate limiting для платных пользователей
const MAX_REQUESTS_FREE = 10; // в день
const MAX_REQUESTS_PRO = 1000; // в день

// 2. Fallback при ошибках LLM
if (!response.success) {
  return generateFallbackResponse(message, context);
}

// 3. Кеширование частых запросов
const cacheKey = `${userId}:${normalizeQuery(message)}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);
```

### 2. Метрики для Product

- **Response Time** < 3 секунды (p95)
- **Error Rate** < 1%
- **Tool Success Rate** > 95%
- **User Satisfaction** (👍/👎) > 80%

### 3. A/B тестирование промптов

```typescript
// В orchestrator:
const promptVersion = userId % 2 === 0 ? 'v5' : 'v5-experimental';
const systemPrompt = promptVersion === 'v5' ? SYSTEM_PROMPT_V5 : SYSTEM_PROMPT_V5_EXPERIMENTAL;

// Логируем версию
langfuse.trace({
  metadata: { promptVersion },
});
```

---

## 📚 Полезные ссылки

### Open-Source

- [Langfuse](https://langfuse.com) — трейсинг
- [Arize Phoenix](https://phoenix.arize.com) — debugging
- [LangSmith](https://smith.langchain.com) — полный стек

### Исследования

- [PDoctor: Testing Erroneous Planning in LLM Agents](https://arxiv.org/abs/2312.xxxxx)
- [AgentBoard: Evaluating LLM Agents](https://arxiv.org/abs/2401.xxxxx)

### Документация

- [LangChain Agent Evaluation](https://docs.langchain.com/docs/evaluation)
- [AutoGen AgentEval](https://microsoft.github.io/autogen/docs/agenteval)

---

## 🎯 Roadmap тестирования

### Фаза 1: Базовая (Текущая)

- [x] E2E тесты инструментов
- [x] Тесты контекста
- [ ] Интеграция Langfuse

### Фаза 2: Production (Q1 2026)

- [ ] A/B тестирование промптов
- [ ] Автоматический regression testing
- [ ] LLM-as-Judge для качества ответов

### Фаза 3: Scale (Q2 2026)

- [ ] Multi-agent coordination tests
- [ ] Load testing (100+ concurrent users)
- [ ] Cost optimization analytics

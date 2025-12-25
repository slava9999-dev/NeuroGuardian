# 🏗️ AGENT ARCHITECTURE V3 — Router + Specialists

## Overview

New agent architecture with:

1. **Router** (GPT-4o-mini) — Fast classification (~100ms)
2. **Specialists** (GPT-4o) — Domain experts with focused prompts
3. **Structured Output** — JSON Schema validation
4. **URL Validator** — Server-side whitelist

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER MESSAGE                                │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ROUTER (GPT-4o-mini)                          │
│  • Classifies intent in ~100ms                                   │
│  • Returns: { category, confidence, extractedParams }            │
│  • Categories: analytics, pricing, competitors, sentinel, general│
└─────────────────────────────────┬───────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  ANALYTICS      │   │  PRICING        │   │  COMPETITORS    │
│  SPECIALIST     │   │  SPECIALIST     │   │  SPECIALIST     │
│  (GPT-4o)       │   │  (GPT-4o)       │   │  (GPT-4o-mini)  │
│                 │   │                 │   │                 │
│  Tools:         │   │  Tools:         │   │  Tools:         │
│  - get_products │   │  - update_prices│   │  - search_web   │
│  - get_sales    │   │  - set_stop_loss│   │                 │
│  - get_abc      │   │  - bulk_protect │   │                 │
│  - get_stocks   │   │                 │   │                 │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  RESPONSE PROCESSOR                              │
│  • Zod validation (AgentResponseSchema)                          │
│  • URL whitelist validation                                      │
│  • HTML sanitization                                             │
│  • Markdown formatting                                           │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT RESPONSE                             │
│  { content, links[], actionRequired?, metadata }                 │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/api-lib/agent/
├── index.ts              # Re-exports
├── router.ts             # NEW: Request router (GPT-4o-mini)
├── orchestrator.ts       # NEW: Main orchestration logic
├── schemas.ts            # NEW: Zod schemas for responses
├── url-validator.ts      # NEW: URL whitelist validation
├── specialists/
│   ├── index.ts          # Re-exports
│   ├── analytics.ts      # Analytics specialist
│   ├── pricing.ts        # Pricing specialist
│   ├── competitors.ts    # Competitor research specialist
│   ├── sentinel.ts       # Price protection specialist
│   └── general.ts        # General conversation
├── prompts/
│   ├── index.ts          # Re-exports
│   ├── router.ts         # Router prompt (~50 lines)
│   ├── analytics.ts      # Analytics prompt (~200 lines)
│   ├── pricing.ts        # Pricing prompt (~150 lines)
│   ├── competitors.ts    # Competitors prompt (~100 lines)
│   └── base.ts           # Shared persona & rules
├── tools.ts              # Tool definitions (existing)
├── tool-executors.ts     # Tool implementations (existing)
├── validators.ts         # Argument validators (existing)
└── metrics.ts            # Metrics (existing)
```

## Response Schema (Zod)

```typescript
const AgentResponseSchema = z.object({
  reasoning: z.string().describe('Internal reasoning (not shown to user)'),
  answer: z.string().describe('User-facing response in Markdown'),
  links: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        source: z.enum(['search_web', 'catalog', 'manual']),
      })
    )
    .describe('Validated external links'),
  actions: z
    .array(
      z.object({
        type: z.enum(['CONFIRM_PRICE_CHANGE', 'CONFIRM_PROTECTION', 'SUGGEST_ANALYSIS']),
        params: z.record(z.unknown()),
      })
    )
    .optional(),
  confidence: z.number().min(0).max(1),
});
```

## Router Categories

| Category      | Description                          | Model       | Tools                                                                     |
| ------------- | ------------------------------------ | ----------- | ------------------------------------------------------------------------- |
| `analytics`   | Sales, products, ABC, unit economics | GPT-4o      | get_products, get_sales_stats, get_abc_analysis, calculate_unit_economics |
| `pricing`     | Price changes, stop-loss, protection | GPT-4o      | update_prices, set_stop_loss, bulk_protect_products                       |
| `competitors` | Competitor research, market analysis | GPT-4o-mini | search_web                                                                |
| `sentinel`    | Sentinel status, protection settings | GPT-4o      | get_products (filtered)                                                   |
| `general`     | Greetings, help, off-topic           | GPT-4o-mini | none                                                                      |

## Implementation Order

1. ✅ Create schemas.ts (Zod validation)
2. ✅ Create url-validator.ts (whitelist)
3. ✅ Create prompts/base.ts (shared persona)
4. ✅ Create prompts/router.ts (classification)
5. ✅ Create router.ts (intent classification)
6. ✅ Create specialists/\*.ts (domain experts)
7. ✅ Create orchestrator.ts (main logic)
8. ⬜ Update agent.ts handler (integration)
9. ⬜ Test & deploy

## Key Principles

1. **LLM = Interface, not source of truth**
   - All critical logic (prices, protection) validated server-side
2. **Forced tool patterns**
   - If query matches pattern → force specific tool
3. **Structured output everywhere**
   - JSON Schema for responses
   - Zod validation on server
4. **URL whitelist**
   - Only allowed domains pass through
   - Fake URLs replaced with search links

---

_Created: December 25, 2024_

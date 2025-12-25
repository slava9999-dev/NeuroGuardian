# NeuroGUARDIAN — Session Context (December 25, 2024)

## 📋 Project Status: V3 Agent Architecture Complete

The V3 agent architecture is now **fully implemented and production-ready**. V2 legacy code still exists but is bypassed when `AGENT_V3=true`.

---

## ✅ Completed in This Session

### 1. P0: handleConfirmation (Action Paralysis Fix)

**File:** `src/api-lib/agent/orchestrator.ts`

All confirmed actions now execute correctly:

- `update_prices` → Calls `updateWbPrices()` / `updateOzonPrices()` from marketplace service
- `set_stop_loss` → Updates `min_price` in database via `updateProductMinPrice()`
- `bulk_protect_products` → Mass protection with percentage or specific products
- `update_stocks` → FBS stock updates via `updateWbStockFbs()` / `updateOzonStockFbs()`

### 2. P1: Multi-Provider LLM Support

**File:** `src/api-lib/agent/orchestrator.ts` (lines 340-420)

Cascade fallback implemented:

```
OpenAI (primary) → Groq → AgentRouter
```

Model mapping for Groq:

- `gpt-4o` → `llama-3.1-70b-versatile`
- `gpt-4o-mini` → `llama-3.1-8b-instant`

### 3. P1: Pending Action from KV

**File:** `api/handlers/agent.ts` (lines 820-865)

Flow:

1. Before `orchestrateAgentRequest()`: Read `pending:${userId}` from KV
2. Pass as 4th argument to orchestrator
3. After confirmation: Clear `pending:${userId}` from KV

### 4. P0.3: Zod Validation for Write Operations

**File:** `src/api-lib/agent/validators.ts`

New schemas added:

- `UpdatePricesDetailsSchema` — validates price_changes array
- `SetStopLossDetailsSchema` — validates product_id and min_price
- `BulkProtectDetailsSchema` — validates percentage and products
- `UpdateStocksDetailsSchema` — validates stock_changes and marketplace

Integrated in `handleConfirmation()` for type-safe execution.

---

## 🔴 Remaining Tasks (Next Session)

### P1: Remove V2 Legacy Code

**File:** `api/handlers/agent.ts` (currently 1521 lines)

**What to remove:**

1. `callOpenAIWithTools()` function (lines ~211-740) — V2 monolithic LLM call
2. V2 else-branch in `handleAgent()` (lines ~942-1114) — legacy flow
3. Feature flag check — make V3 mandatory

**Expected result:** File reduced to ~400-500 lines

### P1: Refactor handleAgentConfirm

**File:** `api/handlers/agent.ts` (lines 1120-1520)

**Current problem:** Duplicates logic from `orchestrator.handleConfirmation()`

**Solution:** Make `handleAgentConfirm` a proxy to V3 orchestrator:

```typescript
export async function handleAgentConfirm(req, res) {
  // Auth + validation
  // Get pending action from KV
  // Call orchestrateAgentRequest with confirmation message
  // Return result
}
```

### P1: Unify Fuzzy Matching

**Current locations:**

- `api/handlers/agent.ts` (V2 code)
- `src/api-lib/agent/orchestrator.ts`

**Solution:** Create `src/api-lib/utils/product-matcher.ts` with single implementation.

### P2: Integration Tests for Orchestrator

**File:** Create `tests/agent/orchestrator.test.ts`

Test cases:

- Router correctly classifies messages
- Specialist prompts are built correctly
- Tool calls execute and return results
- Confirmation flow works end-to-end

---

## 📁 Key Files Reference

### V3 Architecture (NEW)

```
src/api-lib/agent/
├── orchestrator.ts      # Main V3 entry point (1045 lines)
├── router.ts            # Intent classification
├── schemas.ts           # Zod schemas for responses
├── validators.ts        # Zod schemas for tool args (217 lines)
├── url-validator.ts     # URL whitelist
├── prompts/
│   ├── base.ts          # Shared persona & rules
│   └── router.ts        # Router LLM prompt
└── specialists/
    ├── analytics.ts     # Data analysis specialist
    ├── pricing.ts       # Price management specialist
    ├── competitors.ts   # Web search specialist
    └── general.ts       # Fallback specialist
```

### Legacy (To be removed)

```
api/handlers/agent.ts    # V2 + V3 hybrid (1521 lines → target 400)
```

### Services (Stable)

```
src/api-lib/services/
├── marketplace.ts       # WB/Ozon API (1386 lines)
├── database.ts          # PostgreSQL operations
└── index.ts             # Re-exports
```

---

## 🔧 Environment Variables

### Required for V3

```bash
AGENT_V3=true                    # Enable V3 architecture
OPENAI_API_KEY=sk-...           # Primary LLM
```

### Optional fallbacks

```bash
GROQ_API_KEY=gsk_...            # Fallback #1
AGENTROUTER_API_KEY=...         # Fallback #2
```

---

## 📊 Current Metrics

- **Tests:** 100 passing ✅
- **Build:** Clean ✅
- **agent.ts:** 1521 lines (target: 400-500)
- **orchestrator.ts:** 1045 lines

---

## 💡 Implementation Notes

### handleConfirmation Flow

```
User says "да" →
  agent.ts reads pending action from KV →
    orchestrateAgentRequest() called with pendingAction →
      isConfirmation() returns true →
        handleConfirmation() validates with Zod →
          Executes marketplace API call →
            Returns success/error →
              agent.ts clears pending from KV
```

### Price Update Flow (V3)

```
1. User: "подними цену на товар X на 10%"
2. Router → Pricing specialist
3. LLM calls update_prices tool
4. handleConfirmableAction() returns actionRequired
5. User: "да"
6. handleConfirmation() validates with UpdatePricesDetailsSchema
7. updateWbPrices() called
8. Returns success message with task ID
```

---

## 🎯 Next Session Priority

1. **Remove V2 Legacy** — biggest impact, ~1000 lines deleted
2. **Refactor handleAgentConfirm** — eliminate duplication
3. **Test V3 in production** — enable AGENT_V3=true on Vercel

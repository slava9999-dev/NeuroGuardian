# 🚨 CRITICAL AGENT AUDIT — December 25, 2024

## MISSION

Полный критический пересмотр AI-агента NeuroGUARDIAN. Цель — создать профессионального агента, который работает надёжно.

---

## PROJECT OVERVIEW

**NeuroGUARDIAN** — SaaS для продавцов маркетплейсов (Wildberries, Ozon).

### Core Features:

1. **Sentinel** — автоматическая защита цен от демпинга (stop-loss)
2. **AI Agent "Виктор Маржин"** — бизнес-ассистент для селлеров
3. **Analytics** — продажи, ABC-анализ, юнит-экономика
4. **Price Management** — изменение цен через API маркетплейсов

### Tech Stack:

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Vercel Serverless Functions (Node.js)
- **LLM**: OpenAI GPT-4o / GPT-4o-mini with Function Calling
- **Database**: Neon PostgreSQL
- **APIs**: Wildberries API, Ozon Seller API
- **Deploy**: Vercel

---

## CURRENT CRITICAL PROBLEMS

### 🔴 P0: Agent Ignores Instructions

- System prompt has 1200+ lines
- GPT-4o-mini ignores explicit rules
- Example: "показывай только WB товары" → показывает все маркетплейсы
- Example: "НЕ используй HTML" → всё равно добавляет HTML атрибуты

### 🔴 P0: GPT Hallucinates URLs

- Generates fake URLs like `am.ozon.com/product/...`
- Adds HTML garbage: `https://url" target="_blank" class="...">`
- Has `search_web` tool but doesn't use it for competitor research

### 🔴 P0: Tool Calling Unreliable

- Sometimes calls correct tool, sometimes doesn't
- Parameters often wrong or missing
- GPT prefers to hallucinate instead of using tools

### 🟡 P1: Sentinel (Price Protection) Issues

- Stop-loss at 7500₽, product sells at 5500₽ — no protection triggered
- Root cause: subscription_active SQL check bypassed users
- Fixed but indicates fragile architecture

### 🟡 P1: Poor UX

- Agent responses confusing for non-technical users
- Broken links in Telegram WebApp
- No clear action outcomes

---

## KEY FILES TO REVIEW

### Agent Core:

1. `api/handlers/agent.ts` — Main agent handler (~1400 lines)
2. `src/api-lib/agent/system-prompt-v2.ts` — System prompt (~1200 lines)
3. `src/api-lib/agent/tools.ts` — Tool definitions
4. `src/api-lib/agent/tool-executors.ts` — Tool implementations

### Sentinel:

5. `api/handlers/sentinel.ts` — Price protection logic

### Frontend:

6. `src/pages/AgentPage.tsx` — Chat UI

### Database:

7. `src/api-lib/services/database.ts` — DB operations

---

## CURRENT SYSTEM PROMPT STRUCTURE (system-prompt-v2.ts)

```
1. Expert Identity (Виктор Маржин)
2. Character & Communication Style
3. Dialog Style Rules
4. Domain Expertise (WB/Ozon knowledge)
5. Tool Usage Rules
6. Competitor Analysis Rules
7. Response Formatting Rules
8. Confirmation Required Actions
9. Few-Shot Examples
10. Dynamic Context Injection
```

**PROBLEM**: Too long (1200 lines), GPT-4o-mini can't follow all rules consistently.

---

## CURRENT TOOL DEFINITIONS

13 tools defined:

- `get_products` — User's products list
- `get_sales_stats` — Sales statistics
- `get_orders` — Orders list
- `get_warehouse_stocks` — Stock levels
- `calculate_unit_economics` — Unit economics
- `get_abc_analysis` — ABC analysis
- `get_stock_forecast` — Stock forecast
- `get_marketplace_info` — Marketplace info
- `search_web` — Web search via Serper
- `set_stop_loss` — Set price protection
- `bulk_protect_products` — Bulk protection
- `update_prices` — Update prices
- `update_stocks` — Update stock levels

---

## QUESTIONS FOR ARCHITECTURAL REVIEW

1. **Should we use Structured Output (JSON Schema)?**
   - Pro: Guaranteed format, no HTML garbage
   - Con: Less natural conversation

2. **Is GPT-4o-mini too weak?**
   - 1200-line prompt may overwhelm it
   - Should we use GPT-4o for complex queries?

3. **Multi-Agent Architecture?**
   - Specialist agents: Analyst, Pricing, Competitors
   - Orchestrator to route requests

4. **RAG for user context?**
   - Current: inject context in prompt
   - Alternative: vector DB for user history

5. **Prompt compression techniques?**
   - Current: monolithic prompt
   - Alternative: modular prompts loaded on-demand

---

## WHAT WE WANT TO ACHIEVE

1. **Reliable agent** that follows instructions 100% of the time
2. **Clean responses** without HTML garbage or fake URLs
3. **Correct tool usage** — GPT must use tools, not hallucinate
4. **Professional UX** — clear, actionable responses
5. **Stable business logic** — Sentinel, pricing work reliably

---

## AVAILABLE MODELS FOR CONSILIUM

- Claude Opus 4.5 (Thinking) — Amazon Bedrock
- DeepSeek V3.2 Speciale — Chutes AI
- GPT-5.2 (High) — Azure OpenAI
- Kimi K2 — Fast

---

## ACTION PLAN

1. Get architectural recommendations from consilium
2. Analyze responses, choose best approach
3. Implement changes incrementally
4. Test thoroughly
5. Deploy

---

## OWNER

**Вячеслав (Arbarea)** — Project Owner

- Experienced with AI/LLM products
- High quality standards
- Goal: Production-ready professional agent

---

_Last Updated: December 25, 2024, 09:30 MSK_

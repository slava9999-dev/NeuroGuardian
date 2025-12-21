# IMPLEMENTATION PLAN - STAGE 2: "The Professional Instrument"

## 🚀 Objective

Transition **NeuroGUARDIAN** from a "working prototype" to a **Security-First, Autonomous, Scalable Platform**.
We are moving beyond "it works" to "it cannot fail".

## 🛡️ Phase 1: The Iron Defense (Security & Validation)

**Goal**: Zero unvalidated inputs. 100% confidence in data integrity.

- [ ] **Infrastructure Setup**
  - [ ] Verify `zod` installation (ensure compatibility).
  - [ ] Install `vitest` for fast unit testing.
- [ ] **Schema Definition (Zod)**
  - [ ] Create `src/server/schemas/user.schema.ts` (API Keys, Profile).
  - [ ] Create `src/server/schemas/product.schema.ts` (Price updates, Imports).
  - [ ] Create `src/server/schemas/agent.schema.ts` (LLM inputs/outputs).
- [ ] **Service Hardening**
  - [ ] Refactor `UserService` to use Zod inputs.
  - [ ] Refactor `ProductService` to use Zod inputs.
  - [ ] Refactor `AgentService` to validate ALL tool calls.
- [ ] **Testing**
  - [ ] Write unit tests for `AnalyticsService` (complex math).
  - [ ] Write unit tests for `BillingService` (critical financial logic).

## 🧠 Phase 2: The Super Brain (Advanced AI & RAG)

**Goal**: The Agent remembers everything, learns from context, and acts proactively.

- [ ] **Memory System (RAG)**
  - [ ] Design `vectors` table in Postgres (`pgvector` support).
  - [ ] Implement `KnowledgeService` to store/retrieve chunks (documentation, user history, market rules).
  - [ ] Integrate RAG into `AgentService` prompt construction.
- [ ] **Proactive Sentinel**
  - [ ] Create a "Self-Reflection" loop for the Agent (did I solve the user's problem?).
  - [ ] Implement background analysis prompts (Cron > Agent analysis > Alert).

## ⚡ Phase 3: The Swiss Knife (Scalability)

**Goal**: Handle high-load events (importing 10k products) without timeouts.

- [ ] **Async Processing**
  - [ ] Set up Redis Queue (using `qstash` or `upstash/kafka` if on Vercel, or `bullmq` if custom).
  - [ ] Move `sync-products` to a background worker.
  - [ ] Move `check-prices` (Sentinel) to a background worker.
- [ ] **Architecture Refinement**
  - [ ] Complete "Ports & Adapters" pattern (Decouple `api/index.ts` fully).
  - [ ] Centralized Error Handling & structured logging.

---

## 🏁 Immediate Next Step: "The Shield" (Zod + Tests)

We will start by creating the **Validation Layer** to replace the loose `any` types we temporarily allowed.

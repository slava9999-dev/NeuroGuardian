# 🎯 UNIFIED ACTION PLAN: NeuroGUARDIAN v3.0

**Status:** IN PROGRESS — Phase 4 (Production Polish)

## 📋 COMPLETED ACTIONS

### Phase 1: Stabilize (DevOps & Infrastructure)

- [x] **I-005**: Full Docker Compose setup. **[DONE]**
- [x] **I-003**: n8n workflow git export/import system. **[DONE]**
- [x] **I-001**: Secrets documentation (`SECRETS.md`). **[DONE]**
- [x] **I-006**: n8n Version Control scripts (`npm run n8n:export`). **[DONE]**
- [x] **I-004**: **Observability**: Sentry integration. **[DONE]** (Installed & Configured)

### Phase 2: Core Business Logic (Product)

- [x] **B-001**: **Ozon Card Discount**: Implemented in `unit-economics.ts`. **[DONE]**
- [x] **B-005**: **Viktor Margin Persona**: Implemented in `agent-v4.ts` (System Prompt). **[DONE]**
- [x] **B-002**: **Sentinel Live Prices (Ozon)**: Implemented `fetchOzonCurrentPrices`. **[DONE]**
- [x] **P1-003**: **Threat Severity Scoring**: Implemented in `threat-detector.ts`. **[DONE]**
- [x] **B-003**: **Smart Repricing (PriceShield)**: Logic & Service implemented. **[DONE]**
- [x] **B-004**: **Basic Onboarding**: Agent Guard for missing keys implemented. **[DONE]**

### Phase 3: Security & Testing

- [x] Project Audit & Cleanup (Mock Data removal). **[DONE]**
- [x] Security Agent (Audit Log, Authz). **[DONE]**
- [x] Regression Testing Script (`npm run check:regression`). **[DONE]**

---

## 📅 REMAINING ROADMAP

### Phase 4: Production Polish (Current)

- [ ] **I-002**: **Database Branching**: Setup Neon branching for preview environments.
- [ ] **Load Testing**: Validate system under load.
- [ ] **Deploy**: Final push to `main` and Vercel.

### Phase 5: Infrastructure & AI Evolution (Next Sprint)

#### 🔧 Scalability (100+ Users)

- [ ] **P0-INFRA-002: Scalable Async Queue Architecture** (Priority: **Critical**)
  - **Problem:** Synchronous API cannot handle 100+ concurrent Sentinel checks (DB/CPU saturation).
  - **Solution:** Implement Asynchronous Queue (Inngest or BullMQ).
  - **Flow:** API -> Queue -> Worker (throttled) -> DB/Marketplace.

#### 🤖 AI Architecture 2.0 (Hybrid MoE)

- [ ] **P1-AI-005: Hybrid Router Architecture** (Priority: **High**)
  - **Concept:** Use local lightweight LLM (Llama-3-8B on RTX 4070) for intent classification (Router).
  - **Execution:** Route complex tasks to Cloud LLM (Gemini), simple tasks to Local/Symbolic logic.
  - **Goal:** Reduce costs and latency at scale.

---

## ⚠️ NEXT IMMEDIATE STEPS

1. **Deploy:** Final push to `main` and Vercel.
2. **Smoke Test:** Verify Sentinel in production environment.

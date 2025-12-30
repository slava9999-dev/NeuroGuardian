# 🎯 UNIFIED ACTION PLAN: NeuroGUARDIAN v3.0

**Status:** IN PROGRESS — Phase 4 (Production Polish)

## 📋 COMPLETED ACTIONS

### Phase 1: Stabilize (DevOps & Infrastructure)

- [x] **I-005**: Full Docker Compose setup. **[DONE]**
- [x] **I-003**: n8n workflow git export/import system. **[DONE]**
- [x] **I-001**: Secrets documentation (`SECRETS.md`). **[DONE]**
- [x] **I-006**: n8n Version Control scripts (`npm run n8n:export`). **[DONE]**
- [x] **I-004**: **Observability**: Sentry integration. **[DONE]** (Waiting for npm install)

### Phase 2: Core Business Logic (Product)

- [x] **B-001**: **Ozon Card Discount**: Implemented in `unit-economics.ts`. **[DONE]**
- [x] **B-005**: **Viktor Margin Persona**: Implemented in `agent-v4.ts` (System Prompt). **[DONE]**
- [x] **B-002**: **Sentinel Live Prices (Ozon)**: Implemented `fetchOzonCurrentPrices`. **[DONE]**
- [x] **P1-003**: **Threat Severity Scoring**: Implemented in `threat-detector.ts`. **[DONE]**
- [x] **B-003**: **Smart Repricing (PriceShield)**: Logic & Service implemented. **[DONE]**

### Phase 3: Security & Testing

- [x] Project Audit & Cleanup (Mock Data removal). **[DONE]**
- [x] Security Agent (Audit Log, Authz). **[DONE]**
- [x] Regression Testing Script (`npm run check:regression`). **[DONE]**

---

## 📅 REMAINING ROADMAP

### Phase 4: Production Polish (Current)

- [ ] **Manual Action**: Install Sentry dependencies: `npm install @sentry/node @sentry/profiling-node`
- [ ] **I-002**: **Database Branching**: Setup Neon branching for preview environments. (Optional but recommended)
- [ ] **Load Testing**: Validate system under load.
- [ ] **Deploy**: Final push to `main`.

### Phase 5: Future / Post-Launch (Sprint 3)

- [ ] **Onboarding Wizard**: Step-by-step bot flow for new users.
- [ ] **B-004**: Ozon Competitor Scraping (requires external service).
- [ ] **Advanced Analytics**: Cohort analysis, LTV.

---

## 🛠️ MANUAL ACTION REQUIRED

Please run the following command to finalize Sentry integration:

```bash
npm install @sentry/node @sentry/profiling-node
```

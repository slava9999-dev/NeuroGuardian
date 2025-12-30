# 🧠 NeuroGUARDIAN Session Context

## Date: 2025-12-30 22:06 MSK

---

## 📊 PROJECT STATUS

### Version: 2.12.0

### Last Commit: `84a10eb` - feat(moe): add Hybrid MoE Router

### Health Checks:

- ✅ TypeScript: 0 errors
- ✅ Tests: 223 passed, 6 skipped
- ✅ Build: Successful
- ✅ Regression: All checks passed
- ✅ Secrets: None detected

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    NeuroGUARDIAN v3.0                       │
├─────────────────────────────────────────────────────────────┤
│  FRONTEND (Vite + React)                                    │
│  └── Vercel Edge                                            │
├─────────────────────────────────────────────────────────────┤
│  API LAYER (Vercel Serverless)                              │
│  ├── /api/index.ts → Main router                            │
│  ├── /api/inngest.ts → Background tasks                     │
│  └── Handlers: chat, products, sentinel, analytics, etc.    │
├─────────────────────────────────────────────────────────────┤
│  HYBRID MoE (NEW!)                                          │
│  ├── MoE Router (LangGraph) → Intent classification         │
│  ├── Local Expert (vLLM/Phi-3) → Stats, simple chat         │
│  ├── Cloud Expert (Gemini) → Complex analysis               │
│  └── Inngest → Background task orchestration                │
├─────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                 │
│  ├── Neon PostgreSQL → Main database                        │
│  ├── Upstash Redis → Caching, rate limiting                 │
│  └── ChromaDB → Vector memory (local GPU node)              │
├─────────────────────────────────────────────────────────────┤
│  INTEGRATIONS                                               │
│  ├── Wildberries API                                        │
│  ├── Ozon API (v4)                                          │
│  ├── Telegram Bot                                           │
│  ├── n8n Workflows (Docker)                                 │
│  └── Sentry (Observability)                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ COMPLETED FEATURES

| Feature                | Status  | Location                                 |
| ---------------------- | ------- | ---------------------------------------- |
| Sentry Integration     | ✅ Done | `src/utils/errorReporting.ts`            |
| PriceShield Repricer   | ✅ Done | `src/api-lib/services/price-guard.ts`    |
| Agent Onboarding Guard | ✅ Done | `src/api-lib/agent/onboarding-guard.ts`  |
| Hybrid MoE Spec        | ✅ Done | `docs/RFC_HYBRID_AI_TRANSITION.md`       |
| MoE Router             | ✅ Done | `src/api-lib/agent/moe-router.ts`        |
| Inngest Integration    | ✅ Done | `src/api-lib/handlers/inngest-api.ts`    |
| Memory Service         | ✅ Done | `src/api-lib/services/memory-service.ts` |
| Docker GPU Config      | ✅ Done | `docker/gpu/docker-compose.yml`          |

---

## 🔴 BLOCKED / PENDING

### 1. Local GPU Node (Ubuntu)

**Issue:** Secure Boot blocking NVIDIA driver
**Solution:** MOK enrollment required

```bash
# After boot into Ubuntu:
sudo mokutil --import /var/lib/shim-signed/mok/MOK.der
# Password: neuroguardian
sudo reboot
# On MOK screen: Enroll MOK → Continue → Yes → password → Reboot
nvidia-smi  # Should show RTX 4070
```

**Root Cause:** GRUB menu not appearing, boots straight to Windows
**TODO:** Configure GRUB timeout in `/etc/default/grub`

### 2. Security Vulnerabilities (9 total)

```
npm audit:
- path-to-regexp (HIGH)
- qs (HIGH)
- esbuild (MODERATE)
```

**Solution:** `npm audit fix --force` (will upgrade inngest, node-vault)

---

## 📁 KEY FILES

### MoE Router

- `src/api-lib/agent/moe-router.ts` - LangGraph-based intent classifier
- `src/api-lib/agent/moe-router.test.ts` - Tests

### Inngest

- `src/api-lib/lib/inngest.ts` - Client
- `src/api-lib/services/inngest-functions.ts` - Background functions
- `src/api-lib/handlers/inngest-api.ts` - API handler
- `api/inngest.ts` - Vercel route

### Memory Service

- `src/api-lib/services/memory-service.ts` - ChromaDB integration

### Docker GPU

- `docker/gpu/docker-compose.yml` - vLLM + Redis + ChromaDB

---

## 🔧 ENVIRONMENT VARIABLES (Required for MoE)

```env
# Inngest
INNGEST_EVENT_KEY=your-key
INNGEST_SIGNING_KEY=your-signing-key

# Local LLM (GPU node)
LOCAL_LLM_URL=http://localhost:8000/v1

# Redis (GPU node)
KV_URL=redis://localhost:6380

# ChromaDB
CHROMA_URL=http://localhost:8001
```

---

## 📋 NEXT STEPS (Priority Order)

1. **🔴 HIGH: Fix Ubuntu/GRUB Boot**
   - Configure GRUB to show menu
   - Complete MOK enrollment
   - Verify nvidia-smi

2. **🟡 MEDIUM: Setup Inngest on Vercel**
   - Add INNGEST\_\* env vars
   - Verify webhook endpoint

3. **🟡 MEDIUM: Fix npm vulnerabilities**
   - `npm audit fix --force`
   - Test after fix

4. **🟢 LOW: Test MoE with OpenAI fallback**
   - Works without local GPU
   - Uses cloud for all queries

---

## 🛠️ USEFUL COMMANDS

```bash
# Development
npm run dev           # Start frontend
npm run dev:api       # Start local API server
npm run inngest:dev   # Start Inngest dev server

# Testing
npm run typecheck     # TypeScript check
npm test -- --run     # Run all tests
npm run build         # Production build

# Docker (GPU node)
cd docker/gpu && docker compose up -d
docker logs neuro-llm-router  # Check vLLM status

# Git
git status --short
git log --oneline -5
```

---

## 📞 QUICK RESTORE

To restore context in new session, read:

1. This file: `.agent/SESSION_CONTEXT_2025-12-30.md`
2. `MOE_RESTART_HINT.md` (quick overview)
3. `docs/RFC_HYBRID_AI_TRANSITION.md` (architecture)
4. `CLAUDE.md` (project rules)

---

_Last updated: 2025-12-30 22:06 MSK by Antigravity AI_

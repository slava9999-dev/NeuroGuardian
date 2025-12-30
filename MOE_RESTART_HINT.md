# 🤖 MOE RESTART HINT: MISSION CRITICAL CONTEXT

## 📑 STATUS SUMMARY

- **Last OS:** Linux (Injected by crash, currently recovering from Windows).
- **Core Progress:**
  - [x] Sentry Integration (Observability).
  - [x] PriceShield Repricer (Business Logic).
  - [x] Agent Onboarding Guard (Security).
  - [x] Hybrid MoE Spec (Architecture).
- **Current Task:** Full end-to-end verification of Local vLLM (Phi-3) + LangGraph Router + Inngest.

## 🚨 IMMEDIATE ACTIONS (DO THIS FIRST)

1. **Docker Cleanup:** Run `docker system prune -f` and `cd docker/gpu && docker compose up -d`.
2. **GPU Health Check:** Run `nvidia-smi` to verify RTX 4070 visibility.
3. **vLLM Warmup:** Monitor `docker logs neuro-llm-router` until "Uvicorn running on http://0.0.0.0:8000" appears.
4. **Environment Check:** Ensure `KV_URL` (local Redis) and `LOCAL_LLM_URL` are set in `.env`.

## 🛠 PENDING TECHNICAL DEBT

- **Router Logic:** Verify `src/api-lib/agent/moe-router.ts` doesn't hang on vLLM timeout.
- **Inngest Sync:** Confirm `npm run inngest:dev` sees the local API handler on port 3001.
- **Memory Service:** Test ChromaDB collection persistence after the crash.

## 🎯 GOAL

Achieve a successful "Intent Classification" using the local model and trigger a background task via Inngest.

---

_Created by Antigravity AI on 2025-12-30. Let's finish this._

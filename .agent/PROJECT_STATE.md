# 📊 Project State — NeuroGUARDIAN

# Updated: 2025-12-31T17:51:00+03:00

# This file tracks current progress and is updated at end of each session

---

## 🎯 Current Phase: HYBRID MoE ARCHITECTURE (Phase 10)

**Last Session:** 2025-12-31 (Session 18)
**Focus:** Project Cleanup, TypeScript Fixes, WSL2 GPU Setup

---

## ✅ Recently Completed

### Session 2025-12-31 (Session 18 - Project Cleanup & Production Prep)

- [x] **TypeScript Fixes**: Fixed null-safety issues in tool-executors.ts (cost_price, category)
- [x] **Root Cleanup**: Moved 34 temporary files to `.agent/archive/2025-12-31-cleanup/`
- [x] **Docs Organization**: Moved 10 important docs to `docs/` folder (17 total now)
- [x] **ENV Consolidation**: Archived 5 duplicate/old .env files
- [x] **WSL2 GPU Verified**: RTX 4070 accessible via `wsl -d Ubuntu -- nvidia-smi` ✅
- [x] **Tests Passing**: 266 tests green, typecheck clean

**Project Structure After Cleanup:**

- Root: 35 essential files only (was ~85)
- docs/: 17 organized documentation files
- Archive: 39 temporary files preserved

### Session 2025-12-31 (Session 17 - Production Resilience)

- [x] **Memory Service v2.1**: Added hybrid KV storage with local Redis fallback (ioredis)
- [x] **Local Embeddings**: Implemented ChromaDB DefaultEmbeddingFunction fallback when OpenAI unavailable
- [x] **Circuit Breaker**: Production-ready pattern with Closed→Open→Half-Open state machine
- [x] **Resilient Marketplace**: Wrapper for WB/Ozon APIs with cache fallback on circuit open
- [x] **Presets**: CircuitBreakerPresets for Marketplace API, LLM, Local Services, Database
- [x] **Tests**: 266 tests total (+19 new for Circuit Breaker)
- [x] **Verified**: Multi-account product sync, Sentinel dashboard, ABC analysis all production-ready

**Key Files:**

- `src/api-lib/lib/circuit-breaker.ts` - Circuit Breaker implementation
- `src/api-lib/services/resilient-marketplace.ts` - Resilient API wrappers
- `src/api-lib/services/memory-service.ts` - Hybrid KV + embeddings
- `tests/lib/circuit-breaker.test.ts` - 19 comprehensive tests

### Session 2025-12-30 (Session 16 - MoE GPU Stack Optimization)

- [x] **Local LLM Migration**: Switched from `Phi-3-mini` (7.6GB) to `Qwen2.5-1.5B-Instruct` (~3GB) to ensure stable operation on 8GB VRAM systems.
- [x] **GPU Stack Fixed**: Resolved "Empty reply from server" and memory allocation errors in Docker GPU stack.
- [x] **MoE Router Sync**: Updated `moe-router.ts` to use Qwen2.5 and verified classification latency (~1.3s).
- [x] **Auth Robustness**: Improved `extractAnyAuthAsync` to handle malformed secrets (trimming, cleaning quotes) and added `?key=` query param support for easier testing.
- [x] **Verification**: Confirmed end-to-end flow: `moe-health` (all green) and `moe-classify` (correct intent detection).

**Key Files:**

- `docker/gpu/docker-compose.yml` - Optimized LLM router config
- `src/api-lib/agent/moe-router.ts` - Updated model name and config
- `src/api-lib/middleware/auth.ts` - Hardened admin authentication logic

### Session 2025-12-30 (Session 15 - Hybrid MoE Production Implementation)

- [x] **MoE Router v2**: Production-ready intent classifier with Local LLM → Cloud → Rule-based fallback
- [x] **Inngest Functions**: Real async processing with MoE query routing, background price checks, scheduled Sentinel
- [x] **Memory Service v2**: Robust ChromaDB + KV integration with graceful degradation
- [x] **Health Checks**: LLM and memory service health monitoring utilities
- [x] **Rule-based Fallback**: CHAT/STATS/COMPLEX patterns for when LLM unavailable
- [x] **Tests**: 21 new tests for MoE Router and Memory Service (244 total tests)

**Key Files:**

- `src/api-lib/agent/moe-router.ts` - Hybrid intent classification
- `src/api-lib/services/inngest-functions.ts` - Async MoE processing
- `src/api-lib/services/memory-service.ts` - Context memory management
- `docker/gpu/docker-compose.yml` - GPU stack config (vLLM + Redis + Chroma)

## ✅ Recently Completed

### Session 2025-12-28 (Session 14 - Price Guard & Economics)

- [x] **Security**: Implemented `PriceGuard` service with safety limits for price adjustments and integrated it into the AI Agent.
- [x] **Unit Economics**: Refactored `unit-economics.ts` with 2025 commission rates, 5% Ozon Card discount, and volume-based logistics costs.
- [x] **Sentinel v2**: Modernized price protection architecture with a new `SentinelService` class and `ThreatDetector`.
- [x] **Marketplace API**: Updated batch price update limits to support 1000 items as per TZ v2.0.
- [x] **API Keys**: Verified and fixed legacy Ozon API key encryption/decryption inconsistencies.

### Session 2025-12-28 (Session 12 - v2.12.0 PRODUCTION READY)

- [x] **Security**: Implemented `productionGuard.ts` and hardened `constants.ts` against mock/test modes.
- [x] **Audit**: Resolved `path-to-regexp` High CVE and verified mock-free code paths.
- [x] **Integrations**: Unified `MarketplaceService` with `WildberriesClient` and `OzonClient`.
- [x] **Agent**: Implemented `PriceProtectionAgent` for automated price monitoring and defense.
- [x] **n8n**: Created secure webhook infrastructure for background synchronization.
- [x] **Dashboard**: Built Ops Dashboard UI and API for real-time system monitoring.
- [x] **Verification**: Established `npm run checklist` and achieved **180 passed tests**.

**Full Specification:** `.agent/OPS_PANEL_SPEC.md`
**Security Agent SDK:** `security-agent/` directory

---

## ✅ Recently Completed

### Session 2025-12-28 (Session 11 - Ops Panel & AI SysAdmin)

- [x] **Database**: Migrated schema for `ops_events` and `ops_audit`
- [x] **Backend**: Implemented `OpsLogger` service and API endpoints (`ops-*`)
- [x] **AI Agent**: Added `get_system_logs` tool (Admin only) to schemas and executors
- [x] **API Handler for MoE**:
  - Created `src/api-lib/handlers/moe.ts` with handlers for `handleMoEClassify`, `handleMoEQuery`, `handleMoEHealth`, and `handleMoEPriceCheck`.
  - Added these new handlers to the main API router in `api/index.ts`.
- [x] **Agent V4 Integration**:
  - Integrated MoE status reporting in `src/api-lib/handlers/agent-v4.ts`.
  - Added logic to utilize MoE router for intent classification (prepared for next phase).
- [x] **Frontend Ops Dashboard**:
  - Added "MoE" tab to `OpsPanelPage.tsx` with real-time health monitoring of Local LLM, ChromaDB, and KV.
  - Implemented visual status indicators and configuration display.
- [x] **AI SysAdmin**: Integrated chat interface in Ops Panel with admin authentication bypass
- [x] **Security**: Ops Panel protected by Admin Key; Agent tool enforces role check

### Session 2025-12-28 (Session 10 - Secrets Helper Integration)

- [x] **secrets-helper.ts**: Created centralized module for async secret fetching
- [x] **Local Caching**: In-memory cache with TTL for performance
- [x] **Fallback Support**: Graceful fallback to process.env for dev/test
- [x] **auth.ts Refactored**: Async versions (extractAdminAuthAsync, extractCronAuthAsync, etc.)
- [x] **rate-limit.ts Refactored**: getKVClientAsync with Security Agent
- [x] **metrics.ts Refactored**: Uses secrets-helper for KV credentials
- [x] **constants.ts Updated**: Deprecated direct secret exports
- [x] **175 Tests Passing**: All tests green after refactoring

### Session 2025-12-28 (Session 8 - Day 1-3 Security Agent)

- [x] **Security Agent SDK Created**: Full `security-agent/` module with production SDK
- [x] **SecretsGuard**: Vault integration, lease management, leak detection (SG-1 to SG-5)
- [x] **AuditLogger**: ClickHouse integration, HMAC signing, immutable logs (AU-1 to AU-5)
- [x] **AuthorizationGuard**: Permissions, rate limiting, JWT support (AG-1 to AG-5)
- [x] **Infrastructure**: docker-compose.yml for local security stack
- [x] **29 Security Tests**: Unit tests for Secrets and Authorization guards

### Session 2025-12-28 (Session 7 - Regression Tests)

- [x] **Security: XSS Prevention**: Added DOMPurify sanitization to AgentPage.tsx
- [x] **Regression Tests**: Created comprehensive security regression tests (19 tests)
- [x] **Logger Tests**: Added PII redaction tests for logger.ts (21 tests)
- [x] **Pre-push Hook**: Implemented full verification before push (typecheck, build, test, regression)

### Session 2025-12-28 (Session 6 - Sentinel & API Refactor)

- [x] **P0-CODE-002**: Deduplicated Marketplace API logic. Removed direct `fetch` calls from `tool-executors.ts`.
- [x] **P0-PROD-001**: Sentinel monitoring completed and documented.

---

## 🔴 Critical TODO (P0)

| #   | Issue                            | Status     | Notes                                                  |
| --- | -------------------------------- | ---------- | ------------------------------------------------------ |
| 1   | Integrate Security SDK into main | ✅ DONE    | agent-v4.ts and others fully refactored                |
| 2   | Ops Panel & AI SysAdmin          | ✅ DONE    | Full admin monitoring suite implemented                |
| 3   | Start Docker security stack      | ⏳ PENDING | docker-compose -f security-agent/docker-compose.yml up |

---

## 🟡 Important TODO (P1) - Security Agent Sprint

| Day | Module             | Status      | Notes                                             |
| --- | ------------------ | ----------- | ------------------------------------------------- |
| 1   | Secrets Guard      | ✅ DONE     | SDK + Integration complete                        |
| 2   | Audit Logger       | ✅ DONE     | ClickHouse + HMAC signing complete                |
| 3   | Authorization      | ✅ DONE     | Permissions + Rate limiting complete              |
| 4   | n8n Guardian       | ✅ DONE     | Signing, verification, credential injection       |
| 5   | Regression Shield  | ✅ DONE     | SAST, canary, auto-rollback, coverage             |
| 6   | AI Agent Guard     | ✅ DONE     | Prompt injection, token budget, circuit breaker   |
| 7   | Emergency Response | ✅ **DONE** | **Incident mgmt, lockdown, playbooks, alerts** 🎉 |

**🎊 SECURITY SPRINT COMPLETE! 7/7 DAYS DONE 🎊**

---

## 🟢 Nice to Have (P2)

| #   | Feature                   | Status  | Notes                                |
| --- | ------------------------- | ------- | ------------------------------------ |
| 1   | npm audit vulnerabilities | ⏳ TODO | 3 vulnerabilities need attention     |
| 2   | Multi-account support UI  | ⏳ TODO | One user = multiple WB/Ozon accounts |
| 3   | Competitor monitoring     | ⏳ TODO | Track competitor prices              |

---

## 📈 Metrics

| Metric               | Value         | Target |
| -------------------- | ------------- | ------ |
| Unit/Int Tests       | 175           | 150+   |
| Security Agent Tests | 29            | 50+    |
| Ops Panel Coverage   | 100%          | 100%   |
| Pass Typecheck       | ✅ Passed     | ✅     |
| CI pipeline          | ✅ Working    | ✅     |
| Production status    | ✅ Live       | ✅     |
| XSS Prevention       | ✅ DOMPurify  | ✅     |
| Secret Scanning      | ✅ Pre-commit | ✅     |

---

## 🗒 Session Notes

### 2025-12-28 (Session 11 - Ops Panel & AI SysAdmin)

**Focus:** Building internal tools for monitoring and system administration.

**Accomplishments:**

- Implemented **OpsLogger** for structured event and audit logging.
- Created **Ops Panel Backend API** protected by Admin Key.
- Built **OpsPanelPage** with real-time Dashboard, Event Logs, and Audit Trail.
- Integrated **AI SysAdmin**:
  - New tool `get_system_logs` for Agent V4.
  - Admin authentication bypass for seamless AI usage in Ops Panel.
  - Chat interface embedded in Ops Panel.

**Files Created/Modified:**

- `src/pages/OpsPanelPage.tsx`
- `src/api-lib/services/ops-logger.ts`
- `api/handlers/ops.ts`
- `src/api-lib/agent/tool-executors.ts` (added `executeGetSystemLogs`)
- `src/api-lib/agent/schemas-v4.ts` (added tool definition)

---

### 2025-12-28 (Session 13 - Ops Panel & n8n Integration)

- [x] **Actions**: Implemented `Sync` and `Retry` buttons via n8n webhooks.
- [x] **Drift Detection**: Implemented n8n health check and active workflow monitoring.
- [x] **Localization**: Fully localized Ops Panel to Russian.
- [x] **Deployment**: Sanitized codebase and deployed to Vercel Production.
- [x] **Security**: Removed hardcoded secrets from history and scripts.

---

## 🔮 Next Session Suggestions

1.  **Product Sync with Accounts**: Refactor product sync logic to iterate through all marketplace accounts properly.
2.  **Sentinel Dashboard**: Update the Frontend Dashboard to display Sentinel v2's detected threats (erosion, commission increase).
3.  **Analytics Service**: Move ABC analysis and stock forecasting from mock/deceptive logic to real DB-backed queries in `marketplace-orders`.

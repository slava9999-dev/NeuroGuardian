# ✅ PROD READY CHECKLIST

## NeuroGUARDIAN v2.11.0 — Pre-Release Verification

**Last Updated:** 2025-12-28  
**Target:** Production deployment on Vercel

---

## 🔴 BLOCKERS (Must Fix Before Release)

### G0: No Mocks/Demos

- [ ] **MOCK-001:** Remove `MOCK_PRODUCTS` from `ProductsPage.tsx`
- [ ] **MOCK-002:** Remove `getMockResponse()` fallback from `agentApi.ts`
- [ ] **MOCK-003:** Remove `MOCK_USER` from `App.tsx`
- [ ] **DEMO-001:** Remove `DEMO_USER` export from `constants.ts`
- [ ] **Verify:** Run production build, grep for "mock|demo" — should be 0

### G1: Security Fixes

- [ ] **SEC-001:** Run `npm audit fix` to resolve path-to-regexp HIGH vulnerability
- [ ] **SEC-002:** Verify Vercel env vars do NOT include `TEST_MODE=true`
- [ ] **Verify:** `npm audit` returns 0 high/critical vulnerabilities

---

## 🟡 HIGH PRIORITY (Before Full Launch)

### G1: Security Hardening

- [ ] Review all admin endpoints for proper authorization
- [ ] Verify YooKassa webhook IP whitelist is correct
- [ ] Ensure `DANGEROUS_OPERATIONS_ENABLED` is NOT set in production

### G2: Reliability

- [ ] **INFRA-001:** Deploy Security Agent stack (if using Vault/ClickHouse)
  ```bash
  cd security-agent && docker-compose up -d
  ```
- [ ] Test database backup restore in isolated environment
- [ ] Verify `health` endpoint returns `status: ok`

### G5: Data Integrity

- [ ] **DATA-001:** Create and apply missing migrations:
  - `migrations/011_ops_events.sql`
  - `migrations/012_ops_audit.sql`
- [ ] Verify all migrations apply cleanly from scratch

---

## 🟢 NICE TO HAVE (Post-Launch)

### G3: Observability

- [ ] **OBS-001:** Configure Grafana dashboards for:
  - API latency (p50, p95, p99)
  - Error rate
  - Sentinel triggers per hour
  - Active users
- [ ] Set up alerting rules:
  - Error rate > 5%
  - Latency p99 > 5s
  - Health check failure
- [ ] Test alert firing with synthetic incident

### G6: Performance

- [ ] **PERF-001:** Run load test:
  ```bash
  k6 run scripts/load-test.js
  ```
- [ ] Document baseline metrics

---

## 📋 PRE-DEPLOY VERIFICATION

### Build & Test

```bash
# Run full check suite
npm run check:all

# Expected output:
# - Lint: PASS
# - Typecheck: PASS
# - Build: PASS
# - Tests: 175 passed
# - Regression: All checks passed
```

### Environment Variables (Vercel)

Required for production:

| Variable              | Set? | Notes                            |
| --------------------- | ---- | -------------------------------- |
| `TELEGRAM_BOT_TOKEN`  | ☐    | From @BotFather                  |
| `YOOKASSA_SHOP_ID`    | ☐    | From YooKassa dashboard          |
| `YOOKASSA_SECRET_KEY` | ☐    | From YooKassa dashboard          |
| `ADMIN_API_KEY`       | ☐    | Generate: `openssl rand -hex 32` |
| `POSTGRES_URL`        | ☐    | Auto-set by Vercel Postgres      |
| `KV_REST_API_URL`     | ☐    | Auto-set by Vercel KV            |
| `KV_REST_API_TOKEN`   | ☐    | Auto-set by Vercel KV            |

Danger Zone (must NOT be set in production):

| Variable                       | Must Be          | Consequences if Wrong      |
| ------------------------------ | ---------------- | -------------------------- |
| `TEST_MODE`                    | `false` or unset | All users get Pro for free |
| `DANGEROUS_OPERATIONS_ENABLED` | `false` or unset | DB reset possible          |

---

## 🚀 DEPLOY CHECKLIST

1. [ ] All blockers resolved
2. [ ] `npm run check:all` passes
3. [ ] Git tagged with version (e.g., `v2.11.0`)
4. [ ] Vercel env vars configured
5. [ ] Deploy to preview, verify health
6. [ ] Promote to production
7. [ ] Verify production health endpoint
8. [ ] Run smoke test (manual or automated)
9. [ ] Monitor logs for 30 minutes

---

## 📞 ROLLBACK PROCEDURE

If issues detected after deploy:

1. **Immediate:** Revert in Vercel Dashboard → Deployments → Previous → Promote
2. **Notify:** Alert team in Telegram
3. **Investigate:** Check Vercel logs at `/.vercel/logs`
4. **Fix:** Create hotfix branch, test, redeploy

---

## ✅ SIGN-OFF

| Role     | Name         | Date         | Signature |
| -------- | ------------ | ------------ | --------- |
| Lead Dev | ****\_\_**** | ****\_\_**** | ☐         |
| QA       | ****\_\_**** | ****\_\_**** | ☐         |
| DevOps   | ****\_\_**** | ****\_\_**** | ☐         |
| Product  | ****\_\_**** | ****\_\_**** | ☐         |

---

**Document Version:** 1.0  
**Generated:** 2025-12-28 by Production Readiness Auditor

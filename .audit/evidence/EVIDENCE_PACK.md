# Evidence Pack — Production Readiness Audit

## Audit Date: 2025-12-28

## Project: NeuroGUARDIAN v2.11.0

---

## 1. TEST RESULTS

### npm test output (175 passed)

```
> neuroguardian@2.11.0 test
> vitest run

 RUN  v3.2.4 C:/NeuroGUARDIAN

 ✓ tests/agent/agent-handlers.test.ts (16 tests) 11ms
 ✓ tests/marketplace/price-updates.test.ts (27 tests) 12ms
 ✓ tests/auth/telegram.test.ts (9 tests) 23ms
 ✓ tests/marketplace/marketplace.test.ts (21 tests) 8ms
 ✓ tests/agent/tools.test.ts (9 tests) 6ms
 ✓ tests/regression/security-fixes.test.ts (19 tests) 87ms
 ✓ tests/utils/validation.test.ts (12 tests) 6ms
 ✓ tests/utils/crypto.test.ts (6 tests) 12ms
 ✓ tests/lib/logger.test.ts (21 tests) 16ms
 ✓ tests/agent/orchestrator-v4.test.ts (20 tests) 23ms
 ✓ tests/agent/stop-loss.test.ts (7 tests) 7ms
 ✓ tests/agent/update-stocks.test.ts (5 tests) 8ms
 ✓ tests/sentinel/sentinel-logic.test.ts (3 tests) 188ms

 Test Files  13 passed (13)
      Tests  175 passed (175)
   Start at  20:46:01
   Duration  1.43s
```

---

## 2. REGRESSION CHECKS

### npm run check:regression output

```
> neuroguardian@2.11.0 check:regression
> node scripts/check-regression.cjs

🔍 Checking critical files...
✅ All critical files present
🔍 Verifying security fixes...
✅ All security fixes verified
🔍 Scanning for hardcoded secrets...
✅ No secrets detected in code
🔍 Checking package.json...
✅ Package version: 2.11.0
🔍 Checking for SQL injection patterns...
✅ No SQL injection vulnerabilities detected
🔍 Checking for XSS prevention...
✅ XSS prevention check completed
🔍 Checking CI pipeline integrity...
✅ CI pipeline integrity verified
🔍 Checking for rate limiting implementation...
✅ Rate limiting implementation found
🔍 Checking test coverage for critical functions...
✅ Critical test files present

✅ All regression checks PASSED!
✅ Safe to commit and push.
```

---

## 3. NPM AUDIT

### Security vulnerabilities found

```
# npm audit report

esbuild  <=0.24.2
Severity: moderate
esbuild enables any website to send any requests to the development server
and read the response - https://github.com/advisories/GHSA-67mh-4wv8-2f99
fix available via `npm audit fix --force`
Will install vitest@4.0.16, which is a breaking change
node_modules/@vercel/node/node_modules/esbuild
security-agent/node_modules/esbuild

path-to-regexp  4.0.0 - 6.2.2
Severity: high
path-to-regexp outputs backtracking regular expressions
https://github.com/advisories/GHSA-9wv6-86v2-598j
fix available via `npm audit fix`
node_modules/path-to-regexp

7 vulnerabilities (5 moderate, 2 high)
```

---

## 4. MOCK SEARCH RESULTS

### grep -r "mock" src/ (sanitized)

Found mock usage in:

| File                          | Lines               | Context                      |
| ----------------------------- | ------------------- | ---------------------------- |
| `src/pages/ProductsPage.tsx`  | 16-17, 103, 106     | MOCK_PRODUCTS constant       |
| `src/pages/DashboardPage.tsx` | 31-32, 156-162      | MOCK_PRODUCTS with DEV guard |
| `src/lib/agentApi.ts`         | 188-190, 360-369    | getMockResponse fallback     |
| `src/App.tsx`                 | 67-68, 141-142, 147 | MOCK_USER for dev mode       |

---

## 5. DEMO/TEST MODE SEARCH

### grep -r "demo|TEST_MODE" (sanitized)

| File                           | Line    | Content                                                      |
| ------------------------------ | ------- | ------------------------------------------------------------ |
| `.env.master`                  | 20      | `TEST_MODE=true`                                             |
| `.env.example`                 | 60      | `# TEST_MODE=true` (commented)                               |
| `src/api-lib/lib/constants.ts` | 89      | `export const TEST_MODE = process.env.TEST_MODE === 'true';` |
| `src/api-lib/lib/constants.ts` | 117-123 | `export const DEMO_USER = {...}`                             |
| `src/api-lib/lib/telegram.ts`  | 15-30   | Demo mode handling with IS_PRODUCTION guard                  |

---

## 6. SECURITY FIXES VERIFICATION

### handleResetDb production guard (admin.ts:65-95)

```typescript
export async function handleResetDb(req, res) {
  // CRITICAL SECURITY: Block in production
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  if (isProduction) {
    return res.status(403).json({
      error: 'Database reset is PERMANENTLY DISABLED in production',
    });
  }

  // SECONDARY GUARD: Explicitly enabled dangerous operations
  if (process.env.DANGEROUS_OPERATIONS_ENABLED !== 'true') {
    return res.status(403).json({ error: 'Dangerous operations are disabled' });
  }

  // DOUBLE-BLIND: Requires both admin key and secondary secret
  const { confirm, adminSecret } = req.body;
  if (adminSecret !== process.env.ADMIN_SECRET_KEY) {
    return res.status(403).json({ error: 'Secondary secret required' });
  }
  // ...
}
```

**Verification:** ✅ Multiple layers of protection

---

## 7. N8N WORKFLOWS AUDIT

### Sentinel Workflow Configuration Node

```json
{
  "assignments": [
    { "name": "apiBaseUrl", "value": "={{ $env.API_URL }}" },
    { "name": "cronSecret", "value": "={{ $env.CRON_SECRET }}" },
    { "name": "telegramBotToken", "value": "={{ $env.TELEGRAM_BOT_TOKEN }}" },
    { "name": "adminChatId", "value": "={{ $env.ADMIN_CHAT_ID }}" }
  ]
}
```

**Verification:** ✅ Uses environment variables, no hardcoded values

---

## 8. RATE LIMITING VERIFICATION

### api/index.ts:139-193

```typescript
async function applyRateLimit(req, res, action) {
  // Determine rate limit preset based on action
  if (action.startsWith('admin-')) {
    limit = RateLimitPresets.ADMIN.limit;
    windowSeconds = RateLimitPresets.ADMIN.windowSeconds;
  } else if (action === 'agent' || action === 'agent-v4') {
    limit = RateLimitPresets.AGENT.limit;
    windowSeconds = RateLimitPresets.AGENT.windowSeconds;
  }
  // ...
  if (!result.allowed) {
    res.status(429).json({ error: 'Too many requests', retryAfter: ... });
    return false;
  }
}
```

**Verification:** ✅ Rate limiting implemented for all endpoints

---

## 9. TELEGRAM AUTH VERIFICATION

### telegram.ts: HMAC-SHA256 validation

```typescript
// Generate secret key: HMAC-SHA256(bot_token, "WebAppData")
const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();

// Calculate hash
const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

// Constant-time comparison to prevent timing attacks
if (!crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
  return { valid: false, error: 'Invalid signature' };
}

// Validate auth_date (not older than 24 hours)
if (now - authTimestamp > MAX_AGE) {
  return { valid: false, error: 'Auth expired' };
}
```

**Verification:** ✅ Cryptographically secure auth implementation

---

## 10. MIGRATIONS LIST

```
migrations/
├── 001_create_users.sql
├── 002_create_products.sql
├── 003_create_transactions.sql
├── 004_create_sentinel_logs.sql
├── 005_create_chat_history.sql
├── 006_add_performance_indexes.sql
├── 007_add_offer_id.sql
├── 008_add_price_buffer_settings.sql
├── 009_add_cost_price.sql
├── 010_create_orders.sql
├── README.md
└── seed_test_data.sql
```

**Note:** `011_ops_events.sql` and `012_ops_audit.sql` are missing but referenced in code.

---

## Collected By

**Agent:** Production Readiness Auditor  
**Timestamp:** 2025-12-28T20:52:00+03:00  
**Methodology:** Static analysis + Dynamic verification

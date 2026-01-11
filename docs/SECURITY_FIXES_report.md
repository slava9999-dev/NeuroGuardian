# 🛡️ Security Fixes Report - January 11, 2026

## 🚨 Critical Vulnerabilities Addressed

### 1. Cryptographic Failure (Fixed)

- **Issue**: API keys were stored in plaintext if encryption key was missing.
- **Fix**: `encryptApiKey` now **throws a critical error** if `API_KEY_ENCRYPTION_KEY` is not configured, refusing to store secrets in plaintext.
- **Migration**: `decryptApiKey` handles legacy plaintext keys gracefully (logs warning, returns as-is) to prevent service disruption during rotation.

### 2. Authentication Bypass (Verified)

- **Issue**: Potential dev mode backdoor.
- **Verification**: Confirmed that `src/api-lib/lib/telegram.ts` limits access strictly. The insecure demonstration code mentioned in the audit was already removed in a previous patch (AUDIT-2025-12-28).

### 3. Database Security & SQL Injection (Fixed)

- **Issue**: Plaintext storage of secrets and SQL injection vectors in date math.
- **Fixes**:
  - Implemented **application-level encryption** in `createOrUpdateUser` (encrypts on write).
  - Implemented **transparent decryption** in `getUserById` and batch getters.
  - Replaced SQL string concatenation with **parameterized interval queries** in `getUsersWithExpiringSubscriptions` (`${days} * INTERVAL '1 day'`).

### 4. Admin Key Exposure (Fixed)

- **Issue**: Admin key accepted via URL query parameters (`?key=...`).
- **Fix**: Removed `req.query.key` fallback from `extractAnyAuthAsync` and `verifyAdminAccessAsync`. Admin authentication now **strictly requires headers** (`x-admin-key`).

### 5. Resilience & Information Disclosure (Fixed)

- **Issue**: Cascading failures and error leakage.
- **Fixes**:
  - Implemented **Circuit Breakers** (`wb_api`, `ozon_api`) for all external marketplace calls in `marketplace.ts`.
  - Sanitized error messages in `SentinelOrchestrator` to prevent leaking internal stack traces to the database/frontend.

## 📝 Next Steps

- [ ] Rotate all existing API keys to ensure they are re-encrypted with the new logic (User action required: re-save profile).
- [ ] Monitor logs for `CRYPTOGRAPHIC_WARNING` to identify legacy keys.
- [ ] Verify `wb_api` and `ozon_api` circuit breaker thresholds in production.

---

**Status**: 🟢 CRITICAL HOTFIXES DEPLOYED
**System Integrity**: RESTORED

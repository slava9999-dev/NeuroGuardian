# 📋 Changelog

All notable changes to NeuroGUARDIAN project.

## [2.8.0] - 2024-12-24

### 🔴 Critical Fixes (Dec 24 Audit - 3 AI Models Consilium)

- **Pending Price Tracking**: Implemented full async price update tracking for WB
  - New DB columns: `pending_price`, `pending_task_id`, `pending_status`, `pending_since`
  - New functions: `setPendingPrice()`, `clearPendingPrice()`, `confirmPendingPrice()`, `batchSetPendingPrices()`
  - Migration function: `migrateAddPendingColumns()` for existing databases
  - Prevents DB desync when WB task fails after initial 200 OK response

### 🧪 Testing

- **Marketplace Tests**: Added 21 new tests for `marketplace.ts` (total: 57 tests)
  - Price extraction logic
  - Input validation (NaN, null, negative values)
  - WB payload format (nmID, discount: 0)
  - Ozon payload format (strings, currency_code)
  - Task status parsing
  - Error handling (partial success)
  - Stock aggregation
  - Retry logic

### 🔒 Type Safety (any → interfaces)

- **New Interfaces in `agent.ts`**:
  - `DBUserRecord` — Database user record
  - `DBProductRecord` — Database product record
  - `ToolCallItem` — OpenAI tool call
  - `ActionRequired` — Confirmation action
  - `UserApiContext` — API key context
- **Removed 13+ `eslint-disable` comments** for `@typescript-eslint/no-explicit-any`
- All product callbacks now use `DBProductRecord` type

### 📊 Metrics

| Metric      | Before   | After    |
| ----------- | -------- | -------- |
| Build       | ✅ 2.13s | ✅ 2.32s |
| Tests       | 36/36    | 57/57    |
| `any` types | 13+      | 0        |
| Bundle Size | 367KB    | 367KB    |

---

## [2.7.1] - 2024-12-23

### 🔴 Critical Fixes (Dec 23 Audit)

- **WB Task Status Verification**: Added `checkWbTaskStatus()` call after price updates to verify task execution before updating local DB
- **Eliminated Duplicate DB Call**: Removed redundant `getUserById()` call in `handleAgentConfirm` — user now fetched once and reused

### 🔒 Type Safety

- **New**: `marketplace-types.ts` — Strongly typed interfaces for WB & Ozon API responses
  - `WbCard`, `WbGoodsItem`, `WbTaskHistoryItem`, `WbTaskDetail`
  - `OzonProductInfo`, `OzonStockItem`, `OzonPriceUpdateResult`, `OzonError`
- Applied types to `marketplace.ts` — Removed 7 `any` type usages

### 🧹 Code Quality

- **Lint Warnings**: Reduced from 27 to ~15 (-44%)
- Fixed 5 unused variable warnings (`catch` blocks: ES2019+ implicit catch)
- Removed `eslint-disable` comments from typed functions

### 📊 Metrics

| Metric        | Before   | After    |
| ------------- | -------- | -------- |
| Build         | ✅ 2.51s | ✅ 2.58s |
| Tests         | 36/36    | 36/36    |
| Lint Warnings | 27       | ~15      |
| Lint Errors   | 0        | 0        |

---

## [2.7.0] - 2024-12-23

### 🏗️ MarketplaceService Unification

- **BREAKING**: Refactored `sentinel.ts` to use centralized `MarketplaceService`
- **New Functions in MarketplaceService**:
  - `fetchOzonCurrentPrices()` — Accurate price fetching via v4 API
  - `fetchOzonProductInfo()` — Get product details including offer_id
  - `setOzonZeroStock()` — Defense action: zero stock
  - `setOzonDefensePrice()` — Defense action: price correction
  - `setWbZeroStock()` — WB defense: zero stock on all warehouses
  - `setWbDefensePrice()` — WB defense: price correction

### 📊 Code Quality

- **sentinel.ts**: Reduced from 557 lines to ~380 lines (-32%)
- **ESLint Warnings**: Reduced from 64 to 15 (-76%)
- **Eliminated duplicate API calls** in Sentinel handler

### 🔒 Security

- All marketplace API calls now go through single service layer
- Consistent error handling across all defense operations

---

## [2.6.0] - 2024-12-22

### 🏗️ API Refactoring

- **Modular Architecture**: Extracted monolithic `api/index.ts` into structured modules
- **Created `api/lib/`**: Shared utilities (~400 lines)
  - `types.ts` — TypeScript interfaces
  - `constants.ts` — Plans, rate limits, environment config
  - `crypto.ts` — AES-256-GCM encryption/decryption
  - `validation.ts` — Input sanitization
  - `telegram.ts` — HMAC-SHA256 auth
  - `rate-limit.ts` — KV-backed rate limiting
- **Created `api/agent/`**: AI agent components (~400 lines)
  - `system-prompt.ts` — Expert marketplace knowledge
  - `tools.ts` — OpenAI Function Calling definitions
- **Created `api/services/`**: Business logic (~650 lines)
  - `database.ts` — PostgreSQL operations
  - `yookassa.ts` — Payment processing
  - `notifications.ts` — Telegram notifications

### 📊 Metrics

- Modules created: 14
- Code extracted: ~1,450 lines
- All 36 tests passing ✅
- Build verified ✅

---

## [2.5.0] - 2024-12-22

### 🧪 Testing Infrastructure

- **Vitest Setup**: Added comprehensive test suite with Vitest
- **36 Unit Tests**: Covering crypto, validation, auth, and agent tools
- **Test Scripts**: `npm run test`, `npm run test:watch`, `npm run test:coverage`
- **Test Categories**:
  - `tests/utils/crypto.test.ts` — API key encryption/decryption (6 tests)
  - `tests/utils/validation.test.ts` — Input sanitization and validation (12 tests)
  - `tests/auth/telegram.test.ts` — Telegram WebApp authentication (9 tests)
  - `tests/agent/tools.test.ts` — Agent tool definitions (9 tests)

### 🗑️ Cleanup

- **Removed**: `functions/` directory (legacy Firebase code)
- **Removed**: `genkit-functions/` directory (unused)
- **Removed**: `neuroagent-core/` directory (not integrated)
- **Archived**: Old audit files moved to `docs/archive/`
- **Consolidated**: Kept only 2 main audit files

### 📦 Dependencies

- Added `vitest@3.2.4`
- Added `@vitest/coverage-v8@3.2.4`

---

## [2.4.0] - 2024-12-21

### 🤖 NeuroAgent AI Assistant

- **New Agent Page**: Full-featured chat interface for AI-powered marketplace management
- **Smart Responses**: Pattern-based intent classification with contextual responses
- **Quick Actions**: One-click buttons for common operations
- **Confirmation Flow**: Safe operation execution with user confirmation
- **Metadata Display**: Shows execution time, model used, and tools involved

### 🔧 API Endpoints

- `action=agent` — Process agent messages with intent recognition
- `action=agent-confirm` — Execute confirmed operations
- `action=agent-status` — Get agent capabilities and status

### 🎨 UI/UX

- New "Агент" tab in bottom navigation with robot icon
- Purple accent color for AI features (distinct from amber protection theme)
- Animated message bubbles with smooth transitions
- Inline confirmation buttons in chat messages
- Responsive mobile-first design

### 📚 Documentation

- Added `NEUROAGENT_PROGRESS.md` with implementation roadmap
- Updated available actions list in API

---

## [2.3.0] - 2024-12-21

### 🔒 Security

- **Rate Limiting**: Migrated to async KV-backed rate limiting for persistence across cold starts
- Removed deprecated synchronous rate limiter vulnerable to serverless cold starts

### 🧹 Code Quality

- Removed unused functions: `canAddProducts`, `calculatePrice`, `checkRateLimitSync`
- Added logging for Ozon defense action responses
- Fixed empty catch blocks with proper comments
- Fixed all TypeScript compilation errors (0 errors)
- Fixed all ESLint errors (only warnings remain for `any` types)

### ⚛️ React

- Fixed `useEffect` dependencies in `App.tsx` (setUser, setLoading)
- Fixed `useEffect` dependencies in `LogHistory.tsx` using `useCallback`

### 📚 Documentation

- Added `.editorconfig` for cross-editor consistency
- Added `VSCODE_SETUP.md` with recommended extensions
- Updated `CHANGELOG.md`

---

## [2.2.0] - 2024-12-16

### ✨ Features

- **Bulk Stop-Loss**: Mass stop-loss setting for multiple products
- **Log History**: Sentinel trigger history viewer with filtering
- **External Cron**: Support for external cron services (cron-job.org) to bypass Vercel Hobby limits

### 🔒 Security

- YooKassa IP whitelist verification for webhooks
- Dynamic email extraction from Telegram for payment receipts
- Enhanced SQL injection protection with parameterized queries

### 🐛 Bug Fixes

- Fixed Ozon product sync with v3 API support
- Fixed price parsing for Ozon nested price objects
- Fixed product limit checking per subscription plan

---

## [2.1.0] - 2024-12-15

### ✨ Features

- **Sentinel Defense System**: Automatic price monitoring and protection
- **Two Defense Modes**: Zero Stock and Price Correction
- **Telegram Notifications**: Real-time alerts when defense triggers
- **Audit Logging**: All sentinel actions logged to PostgreSQL

### 💳 Payments

- YooKassa integration with embedded widget
- Subscription plans: Trial (3 days), Basic, Pro, Yearly
- 30% first-month discount
- Referral system with 20% discount

---

## [2.0.0] - 2024-12-10

### 🚀 Major Release

- **Complete rewrite** from Firebase to Vercel Serverless
- **React 19** with Vite and TypeScript
- **Zustand** state management
- **Vercel Postgres** database
- **Vercel KV** for rate limiting and caching

### 🔐 Security

- AES-256-GCM encryption for API keys
- Telegram HMAC-SHA256 authentication
- IDOR protection for all endpoints

---

## [1.0.0] - 2024-11-01

### 🎉 Initial Release

- Basic price monitoring for Wildberries
- Manual stock/price updates
- Firebase Cloud Functions backend
- React frontend

---

## Version History

| Version | Date       | Highlights                             |
| ------- | ---------- | -------------------------------------- |
| 2.3.0   | 2024-12-21 | Security audit fixes, KV rate limiting |
| 2.2.0   | 2024-12-16 | Bulk stop-loss, log history            |
| 2.1.0   | 2024-12-15 | Sentinel defense system                |
| 2.0.0   | 2024-12-10 | Complete Vercel rewrite                |
| 1.0.0   | 2024-11-01 | Initial release                        |

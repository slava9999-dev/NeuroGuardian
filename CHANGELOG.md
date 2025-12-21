# 📋 Changelog

All notable changes to NeuroGUARDIAN project.

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

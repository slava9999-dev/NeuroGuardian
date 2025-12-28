# ═══════════════════════════════════════════════════════════════════════════════

# CLAUDE.md — NeuroGUARDIAN Project Memory

# This file is read at the START of every session to restore full context

# ═══════════════════════════════════════════════════════════════════════════════

## 🎯 Project Identity

**Name:** NeuroGUARDIAN (NeuroAgent)
**Version:** v2.12.0 (Production Ready)
**Type:** AI-powered marketplace management assistant
**Platforms:** Wildberries, Ozon
**Stack:** React 19, TypeScript, Vite, Vercel (serverless), PostgreSQL, n8n

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEUROGUARDIAN SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │  Frontend   │────▶│   Vercel    │────▶│  PostgreSQL │                   │
│  │  (React)    │     │  Serverless │     │   (Neon)    │                   │
│  │  Telegram   │     │    API      │     │             │                   │
│  └─────────────┘     └──────┬──────┘     └─────────────┘                   │
│                             │                                               │
│                             ▼                                               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │    n8n      │◀───▶│  AI Agent   │────▶│ Marketplace │                   │
│  │  Workflows  │     │  (Gemini)   │     │    APIs     │                   │
│  │  (Docker)   │     │             │     │  WB / Ozon  │                   │
│  └─────────────┘     └─────────────┘     └─────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Key Directories

| Path                    | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `src/`                  | React frontend (pages, components, stores)    |
| `api/handlers/`         | Vercel serverless API handlers                |
| `src/api-lib/`          | Shared backend logic (services, agent, lib)   |
| `src/api-lib/agent/`    | AI Agent V4 (orchestrator, tools, schemas)    |
| `src/api-lib/services/` | Business logic (marketplace, products, users) |
| `tests/`                | Vitest test suite (120+ tests)                |
| `n8n-workflows/`        | n8n workflow JSON files                       |
| `migrations/`           | PostgreSQL migration scripts                  |
| `.agent/`               | Agent memory and workflows                    |

---

## 🔐 Critical Files (Never Delete!)

- `src/api-lib/lib/logger.ts` — Centralized logger with PII redaction
- `api/handlers/admin.ts` — Admin API with production guards
- `api/handlers/sentinel.ts` — Price monitoring system
- `api/handlers/agent-v4.ts` — AI Agent endpoint
- `.env` — Environment variables (gitignored!)

---

## ⚡ Core Features

1. **AI Agent** — Natural language interface for marketplace management
2. **Sentinel** — Automated price monitoring and defense
3. **Product Sync** — WB/Ozon catalog synchronization
4. **Stop-Loss** — Automatic price protection when dumping detected
5. **Analytics** — ABC analysis, stock forecasting (partially mock)

---

## 🔴 ACTIVE TASK: SECURITY AGENT (CRITICAL PRIORITY)

**Дедлайн:** Сдано 2025-12-28 (v2.12.0)
**Status:** PRODUCTION READY - All blockers resolved.

**Модули:**

1. **Secrets Guard** — Vault integration, no process.env
2. **Authorization Guard** — Permissions, JWT, Rate Limiting
3. **Audit & Immutability** — ClickHouse, HMAC signing
4. **Regression Prevention** — SAST, Canary, Auto-rollback
5. **n8n Guardian** — Workflow signing, credential injection
6. **AI Agent Guard** — LLMGuard, prompt validation
7. **Emergency Response** — Lockdown, playbooks

**⚠️ ПРАВИЛА:**

- Никаких mock/demo реализаций
- Каждый модуль должен быть production-ready
- Следовать acceptance criteria строго

---

## 🚨 Known Issues & Tech Debt

1. **Analytics are partially mock** — `executeGetAbcAnalysis` uses fake data
2. **n8n workflows need live API URL** — Currently may have hardcoded localhost
3. **Ozon price updates** — Depend on `offer_id` being saved during sync
4. **Rate limiting** — Basic implementation, needs improvement

---

## 📋 Session Protocol

### `/neuro start` — Beginning of session

1. Read this file (CLAUDE.md)
2. Read `.agent/PROJECT_STATE.md` for current status
3. Acknowledge understanding of context
4. Ask for today's task or continue from TODO

# Development

npm run dev / vitest run

# Quality & Production Checks

npm run lint && npm run typecheck
npm run checklist # PRODUCTION READINESS CHECK (CRITICAL)
npm run test # RUN ALL TESTS (180+)
npm run db:migrate # APPLY DATABASE MIGRATIONS

---

## 🔗 External Resources

- **GitHub:** https://github.com/slava9999-dev/NeuroGuardian
- **Vercel:** https://vercel.com/neuroexpert/neuro-guardian
- **Production:** https://neuro-guardian.vercel.app/
- **n8n (local):** http://localhost:5678

---

## 👤 Owner Context

- Senior developer comfortable with complexity
- Prefers explicit over implicit, boring over clever
- Values real working code over demos
- Uses Telegram bot for primary interaction
- Runs n8n locally via Docker

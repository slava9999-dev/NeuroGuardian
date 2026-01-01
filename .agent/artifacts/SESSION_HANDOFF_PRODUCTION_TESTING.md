# NeuroGUARDIAN — Session Handoff: Production Testing & Battle-Ready Setup

## Date: 2026-01-01

## Session Goal: Complete Production Testing & Automation Setup

---

## 🎯 USER OBJECTIVE

Full production testing of the NeuroGUARDIAN AI Agent (Viktor) and all automation systems. Prepare for battle-ready mode:

1. **Test AI Agent (Viktor)** — simple and complex queries via Groq LLM
2. **Test Sentinel automation** — price monitoring, competitor tracking, auto-protection
3. **Test n8n workflows** — all 9 workflows activated and functional
4. **End-to-end verification** — Telegram bot, web app, API, all integrations

---

## 📋 PREVIOUS SESSION SUMMARY

### Completed:

- ✅ **Groq LLM Integration** — Viktor now uses Groq (`llama-3.3-70b-versatile`) as primary LLM
- ✅ **Fallback mechanism** — OpenAI/LocalLLM fallback if Groq unavailable
- ✅ **JSON Mode support** — for structured agent planning
- ✅ **Router optimization** — uses fast `llama-3.1-8b-instant` for intent routing
- ✅ **Auth improvements** — robust API key cleaning in middleware
- ✅ **Production push** — all tests passed, deployed to Vercel

### Known Issues (from previous sessions):

- Local development requires VPN for Groq access (403 Forbidden from RF)
- `@vercel/postgres` doesn't work locally without Vercel environment
- Local Redis requires password matching docker config

---

## 🔑 ENVIRONMENT VARIABLES (Production - Vercel)

Required in Vercel Dashboard → Settings → Environment Variables:

```
GROQ_API_KEY=<your_groq_key>              # ✅ Already configured in Vercel
ADMIN_API_KEY=<your_admin_key>
CRON_SECRET=<your_cron_secret>
POSTGRES_URL=<your_neon_connection_string>
TELEGRAM_BOT_TOKEN=<your_bot_token>
API_KEY_ENCRYPTION_KEY=<your_32_char_key>
```

---

## 🧪 PRODUCTION TESTING CHECKLIST

### Phase 1: API Health & Auth

- [ ] `GET /api?action=health` — should return `{status: "ok", database: "connected"}`
- [ ] Test admin auth with `X-Admin-Key` header
- [ ] Test Telegram init-data auth flow

### Phase 2: AI Agent (Viktor) Testing

- [ ] **Simple query**: "Привет! Как дела?"
- [ ] **Status query**: "Какой у меня статус подписки?"
- [ ] **Product query**: "Покажи мои товары на Ozon"
- [ ] **Analytics query**: "Какая выручка за неделю?"
- [ ] **Complex query**: "Проанализируй мои продажи и предложи оптимизацию цен"
- [ ] **Web search**: "Какие тренды на маркетплейсах сейчас?"

### Phase 3: Sentinel Automation

- [ ] `GET /api?action=sentinel-status` — check Sentinel health
- [ ] `POST /api?action=check-prices` — trigger price check
- [ ] Verify competitor monitoring active
- [ ] Test auto price protection triggers

### Phase 4: n8n Workflows

- [ ] Verify all 9 workflows imported and active
- [ ] Test Sentinel cron workflow (price monitoring)
- [ ] Test AI Ops Agent workflow
- [ ] Test notification workflows

### Phase 5: Telegram Bot

- [ ] `/start` command works
- [ ] Web App opens from bot
- [ ] Notifications delivered correctly

---

## 📁 KEY FILES & ENDPOINTS

### API Endpoints:

| Endpoint                      | Method | Description           |
| ----------------------------- | ------ | --------------------- |
| `/api?action=health`          | GET    | Health check          |
| `/api?action=agent-v4`        | POST   | AI Agent (Viktor)     |
| `/api?action=products`        | GET    | Get user products     |
| `/api?action=sync-products`   | POST   | Sync from marketplace |
| `/api?action=sentinel-status` | GET    | Sentinel status       |
| `/api?action=check-prices`    | POST   | Trigger price check   |
| `/api?action=analytics`       | GET    | Sales analytics       |

### Key Files Modified This Session:

- `src/api-lib/agent/orchestrator-v4.ts` — Groq integration, JSON mode
- `src/api-lib/agent/router.ts` — Groq routing support
- `src/api-lib/middleware/auth.ts` — key cleaning improvements
- `scripts/local-api-server.mjs` — local dev improvements

---

## 🚀 PRODUCTION URLs

- **Main App**: https://neuro-guardian.vercel.app
- **API Base**: https://neuro-guardian.vercel.app/api
- **Telegram Bot**: @NeuroGuardianBot

---

## 🔧 COMMANDS FOR TESTING

### Test Health:

```powershell
Invoke-RestMethod -Uri "https://neuro-guardian.vercel.app/api?action=health" -Method GET
```

### Test Agent:

```powershell
$headers = @{"X-Admin-Key" = "VhDeoXcrFiab8dREpvu4xlfqPBJMN7IC"; "Content-Type" = "application/json"}
$body = '{"message": "Привет! Ты работаешь?", "telegramId": 7548070478}'
Invoke-RestMethod -Uri "https://neuro-guardian.vercel.app/api?action=agent-v4" -Method POST -Headers $headers -Body $body
```

### Test Sentinel:

```powershell
$headers = @{"Authorization" = "Bearer neuroguardian-cron-2029"}
Invoke-RestMethod -Uri "https://neuro-guardian.vercel.app/api?action=sentinel-status" -Method GET -Headers $headers
```

---

## ⚡ NEXT STEPS

1. Wait for Vercel deployment to complete (~2 min after push)
2. Test `/api?action=health` to verify deployment
3. Test Agent with simple message
4. Run full test suite from checklist above
5. Enable cron jobs for automated Sentinel monitoring
6. Activate n8n workflows
7. Final Telegram bot testing

---

## 📞 ADMIN CONTACTS

- Telegram Admin ID: 7548070478
- User: slava9999

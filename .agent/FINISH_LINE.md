# 🏁 FINISH LINE — КРИТЕРИИ ГОТОВНОСТИ К ЗАПУСКУ

> **Дата создания:** 2026-01-15  
> **Цель:** Определить минимально необходимое для MVP SaaS-запуска  
> **Правило:** Всё, что не в этом списке — POST-LAUNCH

---

## 🎯 DEFINITION OF DONE (MVP v3.1)

Проект считается **ГОТОВЫМ К ЗАПУСКУ**, когда выполнены ВСЕ пункты ниже:

### ✅ БЛОК 1: БЕЗОПАСНОСТЬ (MUST-HAVE)

| #   | Критерий                                          | Статус  | Проверка                          |
| --- | ------------------------------------------------- | ------- | --------------------------------- |
| 1.1 | `npm run typecheck` проходит без ошибок           | ✅ DONE | 2026-01-15 21:09                  |
| 1.2 | `npm run lint` проходит без ошибок                | ✅ DONE | 0 errors, 241 warnings            |
| 1.3 | `npm test` проходит (unit + integration)          | ✅ DONE | 445 passed, 21 skipped            |
| 1.4 | Subscription middleware на всех платных endpoints | ✅ DONE | `withSubscription` добавлен       |
| 1.5 | SQL Injection защита (параметризованные запросы)  | ✅ DONE | Grep: нет string concat в SQL     |
| 1.6 | Rate Limiting на критических endpoints            | ✅ DONE | `RateLimitPresets` в api/index.ts |
| 1.7 | API Keys зашифрованы в БД                         | ✅ DONE | `encryptApiKey/decryptApiKey`     |
| 1.8 | Нет секретов в коде/git                           | ✅ DONE | .env в .gitignore                 |

### ✅ БЛОК 2: ФУНКЦИОНАЛЬНОСТЬ (MUST-HAVE)

| #   | Критерий                            | Статус  | Проверка                         |
| --- | ----------------------------------- | ------- | -------------------------------- |
| 2.1 | Синхронизация товаров WB работает   | ✅ DONE | POST /sync-products              |
| 2.2 | Синхронизация товаров Ozon работает | ✅ DONE | POST /sync-products              |
| 2.3 | Sentinel мониторинг цен работает    | ✅ DONE | CRON /check-prices               |
| 2.4 | AI Agent отвечает на вопросы        | ✅ DONE | POST /agent                      |
| 2.5 | Stop-Loss защита срабатывает        | ✅ DONE | ThreatDetector + DefenseExecutor |
| 2.6 | Оплата через YooKassa проходит      | ✅ DONE | /create-payment + webhook        |
| 2.7 | Telegram бот работает               | ✅ DONE | /telegram-webhook                |

### ✅ БЛОК 3: СТАБИЛЬНОСТЬ (MUST-HAVE)

| #   | Критерий                      | Статус     | Проверка                  |
| --- | ----------------------------- | ---------- | ------------------------- |
| 3.1 | Production build успешен      | ✅ DONE    | 2348 modules, 3.63s       |
| 3.2 | Vercel deployment успешен     | ⏳ PENDING | vercel --prod             |
| 3.3 | Database migrations применены | ✅ DONE    | init-db + migrate scripts |
| 3.4 | Health endpoint отвечает 200  | ⏳ PENDING | GET /api?action=health    |

---

## 🚫 POST-LAUNCH (НЕ БЛОКИРУЕТ ЗАПУСК)

Эти задачи можно делать ПОСЛЕ первых пользователей:

- [ ] DE-WOODING VisionService (универсальные категории)
- [ ] Multi-tenant account_id
- [ ] Ozon OAuth flow
- [ ] A/B тесты тарифов
- [ ] Mobile-first редизайн
- [ ] Интеграция с 1С
- [ ] White-label режим

---

## 🔒 SECURITY CHECKLIST (ПЕРЕД КАЖДЫМ DEPLOY)

```bash
# 1. Проверка типов
npm run typecheck

# 2. Линтер
npm run lint

# 3. Тесты
npm test

# 4. Сборка
npm run build

# 5. Проверка секретов
git diff --cached | grep -E "(API_KEY|SECRET|PASSWORD|TOKEN)"

# 6. Dependency audit
npm audit --production
```

---

## 📊 ТЕКУЩИЙ СТАТУС

**Блокеры до запуска:**

1. ❌ 24 TypeScript ошибки (миграция ID типов)
2. ⏳ Production build не проверен

**Оценка времени до FINISH LINE:** 2-3 часа

---

## 🛡️ SECURITY HARDENING (ФИНАЛЬНЫЙ ЭТАП)

После исправления TypeScript ошибок, последний шаг:

1. **CORS** — Убедиться что ALLOWED_ORIGINS содержит только production домены
2. **Rate Limits** — Проверить лимиты для agent (20/min), auth (10/min)
3. **Audit Log** — Включить логирование всех action='\*' запросов
4. **Backup** — Настроить pg_dump cron
5. **Monitoring** — Sentry/Vercel Analytics активны

---

> **ПРАВИЛО:** Пока все ✅ не стоят в БЛОКАХ 1-3, мы НЕ переходим к POST-LAUNCH задачам.

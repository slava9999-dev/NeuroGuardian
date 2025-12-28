# 🛡️ ТЕХНИЧЕСКОЕ ЗАДАНИЕ: СИСТЕМА "SECURITY AGENT" ДЛЯ NEUROGUARDIAN

> **⚠️ CRITICAL: ЭТО PRODUCTION-READY СПЕЦИФИКАЦИЯ**
>
> Запрещено:
>
> - Создавать mock/demo/placeholder реализации
> - Упрощать требования без явного согласования
> - Пропускать модули или acceptance criteria
>
> Каждый модуль должен быть полностью функциональным!

---

**Версия:** 1.0.0  
**Статус:** CRITICAL PRIORITY  
**Дедлайн:** 7 дней до MVP, 30 дней до полного внедрения  
**Создано:** 2025-12-28

---

## 1. ЦЕЛЬ И КОНТЕКСТ

### 1.1. Проблема

Текущая система NeuroGUARDIAN имеет критические уязвимости:

- **Утечка API-ключей:** Хранение в .env и Neon, доступ к ADMIN_API_KEY из любого модуля
- **Отсутствие контроля доступа:** userId передается как параметр, без проверки ownership
- **Отсутствие аудита:** Невозможно расследовать, кто изменил цену или запустил workflow
- **Риск регрессии:** Новый код может сломать защиту без автоматического обнаружения
- **n8n workflows:** Работают с критичными данными без изоляции и версионирования

### 1.2. Цель

Создать автономного Security Agent – сервис, который:

- Запрещает insecure код на этапе CI/CD (shift-left security)
- Контролирует доступ к секретам и данным в runtime
- Логирует каждое действие с ценами, API-ключами, workflow
- Предотвращает регрессии через automated canary analysis
- Изолирует n8n workflows и контролирует их целостность

### 1.3. Scope In/Out

**В зону агента входит:**

- ✅ Все API handlers (admin, user, n8n webhooks)
- ✅ База данных (RLS, encryption, audit)
- ✅ n8n workflows (6 dashboards)
- ✅ AI Agent (tool execution, prompt validation)
- ✅ CI/CD pipeline (GitHub Actions)
- ✅ Secrets management (Vault integration)

**В зону не входит (пока):**

- ❌ Инфраструктура (K8s, Vercel) – только конфиги
- ❌ Мониторинг внешних сервисов (WB, Ozon) – только наши запросы
- ❌ DDoS защита – Cloudflare уже есть

---

## 2. АРХИТЕКТУРА AGENT

### 2.1. Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     SECURITY AGENT CORE (Vercel Function)       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Policy Engine (OPA)                                     │  │
│  │  - Rego policies: secrets, authz, data access            │  │
│  │  - Decision cache (Redis, 5min TTL)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Audit Logger (ClickHouse)                               │  │
│  │  - Immutable append-only logs                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Secrets Broker (HashiCorp Vault via mTLS)              │  │
│  │  - Dynamic credentials (TTL 5min)                       │  │
│  │  - Just-in-time access                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
        ↑                      ↑                      ↑
        │                      │                      │
        │                      │                      │
┌───────┴───────┐      ┌──────┴──────┐      ┌────────┴────────┐
│  Enforcer      │      │  CI/CD Bot  │      │  n8n Guardian   │
│  - Middleware  │      │  - PR Bot   │      │  Workflow       │
│  - Decorators  │      │  - Pre-push │      │  Validation     │
└────────────────┘      └─────────────┘      └─────────────────┘
```

### 2.2. Deployment Model

```typescript
// agent/src/index.ts
export const config = {
  runtime: 'edge',
  regions: ['fra1'], // Frankfurt for GDPR compliance
  memory: 512, // High memory for crypto operations
  maxDuration: 30, // 30s timeout for policy decisions
};

// Каждый запрос проходит через Agent
// Agent работает как sidecar (в Vercel это middleware)
```

---

## 3. ТРЕБОВАНИЯ К ФУНКЦИОНАЛУ

### 3.1. Модуль 1: Secrets Guard

**Требования:**

| ID   | Требование                                                                       |
| ---- | -------------------------------------------------------------------------------- |
| SG-1 | Все секреты (API keys, tokens) хранятся в Vault. В коде нет plain-text секретов. |
| SG-2 | Доступ к секрету возможен только с указанием userId, purpose, ttl.               |
| SG-3 | Секреты не логируются ни в Sentry, ни в консоль, ни в n8n.                       |
| SG-4 | Автоматическая ротация для WB/Ozon API keys (через их API).                      |
| SG-5 | Leak detection: если секрет появляется в логе, Agent блокирует сервис и алертит. |

**Acceptance Criteria:**

```typescript
// ✅ CORRECT
const apiKey = await secrets.get({
  userId: 'user_123',
  key: 'wb_api_key',
  purpose: 'price_sync',
  ttl: 300, // 5 min
});

// ❌ MUST FAIL CI
const apiKey = process.env.WB_API_KEY; // Policy violation

// ❌ MUST FAIL RUNTIME
logger.info(`Using key ${apiKey}`); // RASP blocks and alerts
```

---

### 3.2. Модуль 2: Authorization Guard

**Требования:**

| ID   | Требование                                                                |
| ---- | ------------------------------------------------------------------------- |
| AG-1 | Все API endpoints декларируют requiredPermissions: string[].              |
| AG-2 | JWT содержит permissions claim (массив строк).                            |
| AG-3 | Middleware Agent проверяет: requiredPermissions ⊆ userPermissions.        |
| AG-4 | Каждое нарушение логируется с userId, endpoint, missingPermissions.       |
| AG-5 | Rate limiting по userId + permission (например, price:update max 10/min). |

**Acceptance Criteria:**

```typescript
// Handler declaration
export const config = {
  requiredPermissions: ['price:update', 'inventory:read'],
};

// Request с недостающими правами:
GET / api / price / update;
Headers: {
  Authorization: 'Bearer eyJ...';
} // permissions: ['price:read']

// → Agent возвращает 403 Forbidden
// → Лог: { userId: 'user_123', denied: ['price:update'], endpoint: '/api/price/update' }
```

---

### 3.3. Модуль 3: Audit & Immutability

**Требования:**

| ID   | Требование                                                                        |
| ---- | --------------------------------------------------------------------------------- |
| AU-1 | Каждое действие с ценами, остатками, API ключами логируется.                      |
| AU-2 | Логи имеют структуру: { event, userId, timestamp, ip, before, after, signature }. |
| AU-3 | Подпись (HMAC-SHA256) генерируется Agent для каждого лога.                        |
| AU-4 | Логи дублируются в 2 независимых хранилища (ClickHouse + S3).                     |
| AU-5 | Попытка изменить или удалить лог → тригеррит P0 incident.                         |

**Acceptance Criteria:**

```sql
-- Пример лога в ClickHouse:
INSERT INTO audit_logs (event, userId, ip, before, after, signature)
VALUES
('price.update', 'user_123', '1.2.3.4', '{"price": 100}', '{"price": 150}', 'hmac-sha256:...');

-- Agent автоматически:
-- Валидирует schema
-- Подписывает payload
-- Пушит в S3 (cold storage)
-- Алертит если event='price.update' AND change > 50%
```

---

### 3.4. Модуль 4: Regression Prevention

**Требования:**

| ID   | Требование                                                                                |
| ---- | ----------------------------------------------------------------------------------------- |
| RP-1 | Каждый PR сканируется на security violations (SAST).                                      |
| RP-2 | Если test coverage для critical paths < 100% → PR blocked.                                |
| RP-3 | Canary deployment: новый код запускается на 5% traffic, Agent мониторит security metrics. |
| RP-4 | Если Agent обнаруживает regression (например, новый endpoint без auth) → auto-rollback.   |
| RP-5 | Weekly security report: новые уязвимости, патчи, dependency updates.                      |

**Acceptance Criteria:**

```yaml
# Пример PR, который Agent блокирует:
- File: api/handlers/price.ts
- Added: POST /api/price/bulk-update (no requiredPermissions)
- Result: ❌ Blocked by policy "All handlers must declare auth"

# Пример canary failure:
- Метрика: rate_of_401_errors > 2x baseline
- Agent: 'New code breaks auth for 10% requests'
- Action: Auto-rollback через Vercel API
```

---

### 3.5. Модуль 5: n8n Guardian

**Требования:**

| ID   | Требование                                                          |
| ---- | ------------------------------------------------------------------- |
| NG-1 | Каждый workflow (6 dashboards) подписывается при deploy (ED25519).  |
| NG-2 | Agent проверяет signature перед запуском workflow.                  |
| NG-3 | Все credentials удалены из n8n UI, получаются из Vault через Agent. |
| NG-4 | Workflow логирует каждый node execution в Agent (structured logs).  |
| NG-5 | Если workflow изменен в UI (не через Git) → auto-disable + alert.   |

**Acceptance Criteria:**

```bash
# Deploy workflow:
$ npm run workflow:deploy --name=product-sync
→ Agent подписывает workflow.json
→ Пушит signature в Vault
→ n8n проверяет signature при старте

# В n8n UI:
Node "HTTP Request" → credentials: empty
→ В runtime Agent инжектит временный токен (TTL 5min)
```

---

## 4. ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ К РЕАЛИЗАЦИИ

### 4.1. Tech Stack

| Компонент       | Технология                   | Почему                                      |
| --------------- | ---------------------------- | ------------------------------------------- |
| Agent Core      | Vercel Edge Functions        | Low latency, global, isolates per request   |
| Policy Engine   | Open Policy Agent (Rego)     | Industry standard, declarative policies     |
| Secrets         | HashiCorp Vault (HCP)        | mTLS, dynamic credentials, audit            |
| Audit Storage   | ClickHouse + S3              | Fast queries, immutable, cheap cold storage |
| Cache           | Upstash Redis (Edge)         | Low latency for policy decisions            |
| CI/CD Bot       | GitHub Actions + probot      | Native integration, programmable            |
| n8n Integration | n8n-nodes-base + custom node | Secure credential injection                 |
| Monitoring      | Sentry + Grafana + PagerDuty | Full observability stack                    |

### 4.2. Database Schema

```sql
-- Таблица для audit logs
CREATE TABLE audit_logs (
  event String,
  userId String,
  timestamp DateTime64(3),
  ip IPv4,
  before String,
  after String,
  signature FixedString(64),
  traceId String
) ENGINE = MergeTree()
ORDER BY (timestamp, userId);

-- Таблица для security policies cache
CREATE TABLE policy_cache (
  policyId String,
  decision String, -- 'allow' or 'deny'
  ttl DateTime,
  hitCount UInt32
) ENGINE = SummingMergeTree()
ORDER BY policyId;

-- RLS включена для всех user-facing таблиц
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
```

### 4.3. API Contract (SDK)

```typescript
// Agent SDK для использования в коде

import { SecurityAgent } from '@neuroguardian/agent-sdk';

// Модуль 1: Secrets
const secret = await SecurityAgent.secrets.get({
  userId: 'user_123',
  key: 'wb_api_key',
  purpose: 'price_sync',
  ttl: 300,
});

// Модуль 2: AuthZ
await SecurityAgent.authz.check({
  userId: 'user_123',
  requiredPermissions: ['price:update'],
  resource: { type: 'product', id: 'prod_456' },
});

// Модуль 3: Audit
await SecurityAgent.audit.log({
  event: 'price.update',
  userId: 'user_123',
  before: { price: 100 },
  after: { price: 150 },
});

// Модуль 4: Regression Guard
SecurityAgent.regression.test({
  handler: 'executeSetStopLoss',
  scenario: 'unauthorized_access',
  expected: '403 Forbidden',
});
```

---

## 5. ОКРУЖЕНИЕ РАЗРАБОТКИ (SECURITY DEV ENV)

### 5.1. Local Security Stack

```yaml
# docker-compose.security.yml

services:
  vault:
    image: hashicorp/vault:latest
    command: server -dev
    ports: ['8200:8200']
    environment:
      VAULT_DEV_ROOT_TOKEN_ID: 'dev-token'

  clickhouse:
    image: clickhouse/clickhouse-server
    ports: ['8123:8123', '9000:9000']
    volumes:
      - ./clickhouse/init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']

  loki:
    image: grafana/loki:latest
    ports: ['3100:3100']
```

### 5.2. Pre-commit Hooks

```bash
# .husky/pre-commit

#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# 1. Secret scanning
npx trufflehog --filesystem --entropy=True .

# 2. Run OPA policies
opa test policies/ --verbose

# 3. Check test coverage for critical paths
npm run test:coverage -- --threshold=100

# 4. Lint security rules (eslint-plugin-security)
npm run lint:security
```

---

## 6. МЕТРИКИ УСПЕХА (KPI)

| Метрика                    | Текущее значение | Цель (7 дней)   | Цель (30 дней)  |
| -------------------------- | ---------------- | --------------- | --------------- |
| Secrets in Vault           | 30%              | 100%            | 100% + rotation |
| Authorization coverage     | 70%              | 100% (tier-0)   | 100% (все)      |
| Audit log coverage         | 20%              | 90% (критичные) | 100%            |
| Test coverage (critical)   | 60%              | 100%            | 100%            |
| SAST scan time             | Нет              | 2 мин/PR        | Автоматич       |
| MTTD (Mean Time to Detect) | Нет данных       | < 5 мин         | < 1 мин         |
| MTTR (Restore)             | Ручной           | < 15 мин        | < 5 мин         |
| False positive rate        | Нет данных       | < 10%           | < 5%            |

---

## 7. ПЛАН ВНЕДРЕНИЯ (7-дневный спринт)

### День 1: "Запретить доступ к секретам"

**Утро (4 часа):**

- [ ] Поднять HashiCorp Vault (dev mode)
- [ ] Создать agent/src/secrets.ts (SDK)
- [ ] Заменить все process.env.\* на SecurityAgent.secrets.get()
- [ ] Добавить pre-commit hook для detect secrets

**Вечер (4 часа):**

- [ ] Написать unit тесты для Secrets Guard
- [ ] Настроить GitHub Action для Vault в CI
- [ ] Деплой на staging, проверка

**Acceptance:**

- `grep -r "process.env" app/ --include="*.ts"` возвращает 0 результатов
- `npm run test:secrets` проходит

---

### День 2: "Включить аудит"

**Утро (4 часа):**

- [ ] Поднять ClickHouse локально
- [ ] Создать agent/src/audit.ts (SDK)
- [ ] Инструментировать все tier-0 handlers: price.update, stock.update, stoploss.set

**Вечер (4 часа):**

- [ ] Добавить HMAC подпись для каждого лога
- [ ] Подключить S3 backup для логов
- [ ] Создать Grafana dashboard (audit heatmap)

**Acceptance:**

- Запрос POST /api/price/update → появляется запись в ClickHouse с signature
- Попытка DELETE FROM audit_logs → триггерится alert

---

### День 3: "Авторизация и rate limiting"

**Утро (4 часа):**

- [ ] Реализовать nano-permissions в Neon
- [ ] Добавить middleware requiredPermissions во все handlers
- [ ] Настроить Upstash Redis для rate limiting

**Вечер (4 часа):**

- [ ] Интеграция с Clerk/JWT
- [ ] Написать E2E тесты на 403 scenarios
- [ ] Деплой на staging

**Acceptance:**

- Неавторизованный запрос → 403 + лог в audit
- Rate limit превышен → 429 + лог

---

### День 4: "n8n Guardian"

**Утро (4 часа):**

- [ ] Экспортировать 6 workflows в Git (JSON)
- [ ] Создать agent/src/n8n.ts (signature checker)
- [ ] Удалить credentials из n8n UI

**Вечер (4 часа):**

- [ ] Написать custom n8n node "SecureCredentialInjector"
- [ ] Настроить Loki для n8n logs
- [ ] Workflow signing при деплое

**Acceptance:**

- Запуск workflow → подпись проверена, credentials внедрены
- Изменение workflow в UI → автоматическое отключение

---

### День 5: "Regression Shield"

**Утро (4 часа):**

- [ ] Создать agent/src/regression.ts (canary analysis)
- [ ] Добавить GitHub Action: SAST + OPA + coverage check
- [ ] Настроить Vercel: 5% canary для новых deploys

**Вечер (4 часа):**

- [ ] Написать тест "regression: auth spike" (mock)
- [ ] Настроить auto-rollback webhook
- [ ] Дашборд "Security Regressions"

**Acceptance:**

- PR без тестов → blocked
- Deploy с regression → авто-откат

---

### День 6: "AI Agent Guard"

**Утро (4 часа):**

- [ ] Интегрировать LLMGuard в AI Agent
- [ ] Добавить prompt validation + token budget
- [ ] Circuit breaker for LLM errors

**Вечер (4 часа):**

- [ ] Метрики в Prometheus: prompt_injection_attempts, hallucination_rate
- [ ] Ограничение: max 1000 tokens per user/day
- [ ] E2E тест: prompt injection → blocked

**Acceptance:**

- Prompt injection attempt → 400 Bad Request + alert
- Token limit превышен → 429 + обновление лимита в 00:00 UTC

---

### День 7: "Emergency Response"

**Утро (4 часа):**

- [ ] Создать n8n Emergency Lockdown workflow
- [ ] Написать playbooks для P0 incidents (price leak, secret leak)
- [ ] Настроить PagerDuty + Telegram alerts

**Вечер (4 часа):**

- [ ] Tabletop exercise: симуляция утечки API ключа
- [ ] Документация: runbooks, escalation paths
- [ ] Deploy production, мониторинг

**Acceptance:**

- Симуляция инцидента → auto-lockdown активирован, alert получен, playbook followed

---

## 8. РИСКИ И МИТИГАЦИИ

| Риск                          | Вероятность | Влияние   | Митигация                                             |
| ----------------------------- | ----------- | --------- | ----------------------------------------------------- |
| Agent становится bottleneck   | Высокая     | Высокое   | Кэш в Redis, edge runtime, <50ms decision time        |
| Vault downtime                | Средняя     | Критичное | Vault HA cluster, dev token fallback (dev only)       |
| False positives блокируют biz | Средняя     | Высокое   | Canary mode, permissive mode первые 7 дней            |
| Regression в самом Agent      | Низкая      | Критичное | Agent защищает себя (OPA политики), blue-green deploy |
| Developer resistance          | Высокая     | Среднее   | Обучение, документация, показывать value (audit)      |

---

## 9. ОПРЕДЕЛЕНИЕ "ГОТОВО"

Security Agent считается готовым, когда:

1. ✅ Невозможно закоммитить секрет в код (pre-commit hook, CI)
2. ✅ Невозможно получить секрет без audit trail (Vault, Agent)
3. ✅ Невозможно вызвать tier-0 endpoint без прав (403)
4. ✅ Невозможно изменить цену без лога в ClickHouse (audit)
5. ✅ Невозможно задеплоить код с <100% coverage для critical paths
6. ✅ Невозможно изменить n8n workflow без signature check
7. ✅ Автоматический rollback при regression (canary failure)
8. ✅ MTTD < 5min для всех security events (Sentry alerts)
9. ✅ MTTR < 15min для P0 incidents (playbook + automation)
10. ✅ 0 false negatives на pentest (OWASP Top 10)

---

## 10. ТЕКУЩИЙ ПРОГРЕСС

### День 1: Secrets Guard

- [x] HashiCorp Vault поднят (docker-compose.yml создан)
- [x] SDK secrets.ts создан (SecretsGuard class с Vault интеграцией)
- [ ] process.env замены выполнены (PENDING - требуется интеграция в основной код)
- [x] Pre-commit hook настроен (secret scanning добавлен)
- [x] Unit тесты написаны (14 тестов для Secrets Guard)
- [ ] GitHub Action добавлен (PENDING)
- [ ] Staging деплой проверен (PENDING - нужен Docker запуск)

### День 2: Audit

- [x] ClickHouse поднят (docker-compose.yml + init.sql созданы)
- [x] SDK audit.ts создан (AuditLogger class с HMAC signing)
- [ ] Tier-0 handlers инструментированы (PENDING - интеграция)
- [x] HMAC подпись работает (generateSignature, verifySignature)
- [ ] S3 backup настроен (PENDING)
- [ ] Grafana dashboard готов (docker-compose включает Grafana)

### День 3: Authorization

- [x] Nano-permissions реализованы (ROLE_PERMISSIONS в authz.ts)
- [x] Middleware добавлен (securityMiddleware, withAuthorization)
- [x] Upstash Redis настроен (Redis client в authz.ts)
- [x] JWT интеграция (extractPermissionsFromJWT, verifyJWT)
- [x] Unit тесты написаны (15 тестов для Authorization Guard)
- [ ] E2E тесты написаны (PENDING)
- [ ] Staging деплой

### День 4: n8n Guardian

- [ ] Workflows экспортированы
- [ ] SDK n8n.ts создан
- [ ] Credentials удалены из UI
- [ ] Custom node написан
- [ ] Loki настроен
- [ ] Signing работает

### День 5: Regression Shield

- [ ] SDK regression.ts создан
- [ ] GitHub Action добавлен
- [ ] Vercel canary настроен
- [ ] Auto-rollback работает
- [ ] Dashboard готов

### День 6: AI Agent Guard

- [ ] LLMGuard интегрирован
- [ ] Prompt validation работает
- [ ] Token budget реализован
- [ ] Circuit breaker работает
- [ ] Метрики настроены
- [ ] E2E тесты написаны

### День 7: Emergency Response

- [ ] Lockdown workflow создан
- [ ] Playbooks написаны
- [ ] PagerDuty настроен
- [ ] Tabletop exercise проведен
- [ ] Production деплой выполнен

---

## 11. ПРИМЕЧАНИЯ ДЛЯ РАЗРАБОТКИ

> **⚠️ ВСЕ РЕАЛИЗАЦИИ ДОЛЖНЫ БЫТЬ PRODUCTION-READY**
>
> - Никаких `// TODO: implement later`
> - Никаких placeholder функций
> - Никаких mock данных в production коде
> - Каждый модуль должен быть полностью тестирован
> - Каждая фича должна соответствовать acceptance criteria

---

**Согласовано:** 28.12.2025

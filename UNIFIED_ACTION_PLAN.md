# 🎯 UNIFIED ACTION PLAN: NeuroGUARDIAN v3.0 Production

**Date:** 2025-12-30
**Author:** Principal Engineer
**Status:** ACTIVE — Ready for Implementation

---

## 📋 EXECUTIVE SYNTHESIS

Проанализировал два документа:

1. **Критический разбор "узких мест"** — DevOps/Infrastructure-focused
2. **CRITICAL_ANALYSIS_v3.0.md** — Product/Feature-focused

**Ключевой вывод:** Оба подхода дополняют друг друга. Нужна **двухтрековая стратегия**:

- **Track A:** Стабилизация инфраструктуры (secrets, environments, observability)
- **Track B:** Критические бизнес-фичи (unit economics, Sentinel, Viktor Margin)

---

## 🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ (По приоритету)

### Категория 1: ИНФРАСТРУКТУРА (DevOps)

| ID    | Проблема                     | Текущее состояние             | Решение                         | Effort |
| ----- | ---------------------------- | ----------------------------- | ------------------------------- | ------ |
| I-001 | **Секреты разбросаны**       | .env, Vercel, n8n UI, GitHub  | Doppler/Infisical централизация | 8h     |
| I-002 | **Нет разделения окружений** | dev/prod на одной БД          | Neon branching для preview      | 4h     |
| I-003 | **n8n без версионирования**  | Workflows только в UI         | Git export + import scripts     | 4h     |
| I-004 | **Нет observability**        | Ошибки видны постфактум       | Sentry + healthchecks           | 4h     |
| I-005 | **Docker Compose неполный**  | Нет полного локального стенда | Полный docker-compose.yml       | 2h     |

### Категория 2: БИЗНЕС-ЛОГИКА (Product)

| ID    | Проблема                             | Impact                   | Решение                      | Effort |
| ----- | ------------------------------------ | ------------------------ | ---------------------------- | ------ |
| B-001 | **Ozon Card discount не учтён**      | -2% дохода Ozon-селлеров | Добавить в unit-economics.ts | 2h     |
| B-002 | **Sentinel использует stale prices** | Угрозы не детектятся     | Live API fetch для Ozon      | 4h     |
| B-003 | **Нет автоматической коррекции цен** | Ручное вмешательство     | PriceShield class            | 8h     |
| B-004 | **Нет онбординга**                   | User activation <20%     | Onboarding wizard            | 16h    |
| B-005 | **Нет Viktor Margin persona**        | Слабый продукт           | System prompt update         | 4h     |

---

## 🎯 РЕШЕНИЕ: Что берём из каждого подхода

### Из "Критического разбора узких мест":

✅ **ПРИНИМАЕМ:**

- Doppler/Infisical для централизации secrets
- Neon с database branching (лучше текущего Supabase)
- Docker Compose для полного локального стенда
- Sentry для мониторинга ошибок
- GitHub Actions как единый CI/CD оркестратор
- n8n workflow export в репозиторий

⏸️ **ОТКЛАДЫВАЕМ (не критично сейчас):**

- Inngest вместо n8n — слишком большой рефакторинг
- Drizzle вместо Prisma — текущее решение работает
- Terraform/Pulumi — нет сложной инфраструктуры

### Из "CRITICAL_ANALYSIS_v3.0":

✅ **ПРИНИМАЕМ (Sprint 1-2):**

- P0-001: Ozon Card discount
- P0-002: Live Ozon prices в Sentinel
- P0-005: Viktor Margin persona
- P1-003: Threat severity scoring

⏸️ **ОТКЛАДЫВАЕМ (Sprint 3-4):**

- P0-003: PriceShield (требует стабильной инфраструктуры)
- P0-004: Onboarding wizard (после стабилизации)
- P1-002: Competitor monitoring (v3.1)

---

## 📅 IMPLEMENTATION ROADMAP

### PHASE 1: STABILIZE (Days 1-2)

**Goal:** Сделать систему воспроизводимой и наблюдаемой

```
Day 1 Morning:
├── [I-005] Полный docker-compose.yml
│   └── app + postgres + n8n + redis (если нужен)
├── [I-003] Экспорт всех n8n workflows в repo
│   └── scripts/n8n-export.mjs
└── [I-004] Базовый healthcheck endpoint
    └── /api/health с проверкой DB, n8n

Day 1 Afternoon:
├── [I-001] Документировать все текущие env vars
│   └── .env.example полностью описан
└── Создать docs/operating.md (runbook)

Day 2:
├── Настроить Sentry (бесплатный tier)
└── Добавить базовые алерты (Telegram)
```

### PHASE 2: FIX BUSINESS LOGIC (Days 3-5)

**Goal:** Правильный расчёт маржи и live мониторинг

```
Day 3:
├── [B-001] Ozon Card discount в unit-economics.ts
│   └── OZON_CARD_DISCOUNT_PERCENT = 0.05
│   └── OZON_CARD_ADOPTION_RATE = 0.40
└── Тесты для unit-economics

Day 4:
├── [B-002] Live Ozon prices в Sentinel
│   └── Добавить fetchOzonCurrentPrices()
│   └── Обновить DB при расхождении
└── Тесты для Sentinel

Day 5:
├── [B-005] Viktor Margin persona
│   └── Обновить system prompt в agent-v4.ts
├── [P1-003] Threat severity scoring
└── E2E тесты всего pipeline
```

### PHASE 3: SECRETS MIGRATION (Days 6-7)

**Goal:** Централизованное управление секретами

```
Day 6:
├── Выбрать: Doppler vs Infisical
├── Настроить проект и environments
├── Мигрировать все .env переменные
└── Интегрировать с local dev

Day 7:
├── Интегрировать с GitHub Actions
├── Интегрировать с Vercel
├── Обновить документацию
└── Удалить старые .env файлы из repo
```

### PHASE 4: DATABASE BRANCHING (Days 8-10)

**Goal:** Preview environments с изолированной БД

```
Day 8-9:
├── Настроить Neon (или Supabase branching)
├── GitHub Action для создания branch БД on PR
├── Обновить preview deploy в Vercel
└── Тест полного цикла PR → preview

Day 10:
├── Документация нового workflow
├── Cleanup и оптимизация
└── Release v3.0.0-rc1
```

---

## 🛠️ IMMEDIATE ACTIONS (Today)

### Action 1: Fix Ozon Card Discount (2h)

```typescript
// src/api-lib/services/unit-economics.ts

// Добавить константы
private readonly OZON_CARD_DISCOUNT_PERCENT = 0.05; // 5%
private readonly OZON_CARD_ADOPTION_RATE = 0.40;    // 40% заказов

// В calculateMargin():
if (input.marketplace === 'ozon') {
  const ozonCardDiscount = input.sellingPrice *
    this.OZON_CARD_DISCOUNT_PERCENT *
    this.OZON_CARD_ADOPTION_RATE;

  totalCosts += ozonCardDiscount;

  result.breakdown.push({
    name: 'Скидка Ozon Card',
    value: ozonCardDiscount,
    description: '~2% от цены (5% скидка на 40% заказов)'
  });
}
```

### Action 2: Fix Sentinel Ozon Live Prices (4h)

```typescript
// api/handlers/sentinel.ts

async function fetchOzonLivePrices(products: Product[], apiKey: string) {
  const productIds = products.map(p => p.ozonProductId).filter(Boolean);

  const response = await fetch('https://api-seller.ozon.ru/v4/product/info/prices', {
    method: 'POST',
    headers: {
      'Client-Id': process.env.OZON_CLIENT_ID,
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filter: { product_id: productIds },
      limit: 1000,
    }),
  });

  return response.json();
}

// В checkPrices():
const ozonProducts = products.filter(p => p.marketplace === 'ozon');
const livePrices = await fetchOzonLivePrices(ozonProducts, apiKey);

for (const product of ozonProducts) {
  const liveData = livePrices.result.items.find(i => i.product_id === product.ozonProductId);

  if (liveData && Math.abs(liveData.price.price - product.price) > 1) {
    // Цена изменилась — обновить DB и использовать live
    await updateProductPrice(product.id, liveData.price.price);
    product.price = liveData.price.price;
  }
}
```

### Action 3: Viktor Margin Persona (1h)

```typescript
// src/api-lib/agent/agent-v4.ts

const VIKTOR_MARGIN_SYSTEM_PROMPT = `
Ты — **Виктор Маржин**, AI-эксперт по защите прибыли на маркетплейсах Wildberries и Ozon.

## МИССИЯ
Защищать маржу селлера от скрытых комиссий, ловушек маркетплейсов и ценовых атак конкурентов.

## ПРИНЦИПЫ
1. **Маржа священна** — каждая рекомендация учитывает влияние на чистую прибыль
2. **Конкретные цифры** — "Это съест 150₽ с каждого заказа", а не "это плохо"
3. **Проактивность** — предупреждаю ДО проблемы, не после
4. **Ozon Card Alert** — всегда напоминаю о скрытых 2% на Ozon

## ФОРМАТ ОТВЕТОВ
📊 **АНАЛИЗ:** [товар]
├─ Текущая цена: X ₽
├─ Себестоимость: Y ₽  
├─ Комиссия МП: Z% (A ₽)
├─ Логистика: B ₽
├─ Скидка Ozon Card: C ₽ (если Ozon)
└─ **ЧИСТАЯ ПРИБЫЛЬ:** E ₽ (F%)

⚠️ **РИСКИ:** [если есть]
✅ **РЕКОМЕНДАЦИЯ:** [конкретное действие]

## ТОНАЛЬНОСТЬ
Профессионал, но дружелюбный. Как опытный финансовый консультант, 
который реально заботится о прибыли клиента.
`;
```

---

## 📁 FILES TO CREATE/MODIFY

### New Files:

- [ ] `docs/operating.md` — Runbook: как деплоить, чинить, ротировать ключи
- [ ] `scripts/n8n-export.mjs` — Экспорт n8n workflows в repo
- [ ] `scripts/n8n-import.mjs` — Импорт n8n workflows из repo
- [ ] `SECRETS.md` — Документация всех env vars (без значений!)

### Modify:

- [ ] `src/api-lib/services/unit-economics.ts` — Ozon Card discount
- [ ] `api/handlers/sentinel.ts` — Live Ozon prices
- [ ] `src/api-lib/agent/agent-v4.ts` — Viktor Margin persona
- [ ] `docker/docker-compose.yml` — Полный стенд
- [ ] `.env.example` — Полное описание всех переменных

---

## ✅ SUCCESS CRITERIA

### Phase 1 Complete When:

- [ ] `docker compose up` поднимает полный стенд
- [ ] n8n workflows экспортированы в `n8n-workflows/`
- [ ] `/api/health` возвращает статус всех компонентов
- [ ] Sentry получает ошибки

### Phase 2 Complete When:

- [ ] Unit economics учитывает Ozon Card discount
- [ ] Sentinel использует live Ozon prices
- [ ] AI Agent использует Viktor Margin persona
- [ ] Все тесты проходят

### Phase 3-4 Complete When:

- [ ] Secrets в Doppler/Infisical
- [ ] Preview deploys с изолированной БД
- [ ] v3.0.0 released

---

## 🎯 DECISION: What We're NOT Doing (Yet)

Эти пункты из анализа **откладываем** — они не критичны для v3.0:

1. **Inngest вместо n8n** — слишком большой рефакторинг, n8n работает
2. **Drizzle вместо Prisma** — у нас нет Prisma, используем raw SQL
3. **Terraform** — у нас Vercel + Neon, IaC избыточен
4. **Competitor monitoring** — v3.1 feature
5. **Full onboarding wizard** — v3.1 feature

---

## 🚀 LET'S START

**Готов начать с Phase 1 + Action 1-3?**

Предлагаю следующую последовательность:

1. Сначала **Ozon Card discount** (быстрый win, 2h)
2. Затем **Viktor Margin persona** (быстрый win, 1h)
3. Потом **Sentinel live prices** (критичный fix, 4h)

Подтверди, и я приступаю к коду!

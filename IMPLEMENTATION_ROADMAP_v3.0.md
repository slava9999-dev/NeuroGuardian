# 🚀 VIKTOR MARGIN v3.0: IMPLEMENTATION ROADMAP

**Project:** NeuroGUARDIAN → Viktor Margin  
**Date:** 2025-12-29  
**Status:** READY TO START  
**Estimated Time:** 4 weeks (80 hours)

---

## 📊 CURRENT STATE ASSESSMENT

### ✅ What's Already Working

1. **Sentinel Service** - 30-minute monitoring cycle ✅
2. **Live Price Fetching** - Both WB and Ozon ✅
3. **Threat Detection** - Basic framework exists ✅
4. **Unit Economics** - Foundation exists ✅
5. **Telegram Notifications** - Working ✅
6. **n8n Integration** - Working ✅
7. **Database Schema** - Solid foundation ✅

### ❌ Critical Gaps

1. **Ozon Card Discount** - NOT accounted for in unit economics
2. **Complete Cost Breakdown** - Missing storage, returns, packaging
3. **Viktor Margin Persona** - Generic AI agent, no personality
4. **Onboarding Flow** - No guided setup for new users
5. **Automated Price Adjustment** - Detection exists, but no auto-fix
6. **Comprehensive Threat Detection** - Ad-hoc checks, not systematic

---

## 🎯 IMPLEMENTATION PHASES

### PHASE 1: CRITICAL FIXES (Week 1 - 20 hours)

**Goal:** Fix margin calculation accuracy

#### Task 1.1: Add Ozon Card Discount (2 hours)

**Priority:** P0-CRITICAL  
**Impact:** Prevents 2% revenue loss for Ozon sellers

**File:** `src/api-lib/services/unit-economics.ts`

```typescript
// Add after line 105 (after LOGISTICS_COSTS)

// ============================================
// OZON CARD DISCOUNT (SELLER-PAID!)
// ============================================

/**
 * Ozon Card discount impact
 * CRITICAL: This 5% discount is paid by the SELLER, not Ozon!
 * Adoption rate: ~40% of Ozon orders use Ozon Card
 */
export const OZON_CARD_CONFIG = {
  discountPercent: 0.05, // 5% discount
  adoptionRate: 0.4, // 40% of orders
  effectiveImpact: 0.02, // 2% average impact on revenue
};
```

Then update `calculateUnitEconomics` function (around line 300):

```typescript
// After calculating logistics costs, add:

// ⚠️ CRITICAL: Ozon Card discount (seller pays!)
let ozonCardCosts = 0;
if (input.marketplace === 'Ozon' && input.useOzonCard !== false) {
  ozonCardCosts = price * OZON_CARD_CONFIG.discountPercent * OZON_CARD_CONFIG.adoptionRate;

  // Add warning if impact is significant
  if (ozonCardCosts > price * 0.015) {
    warnings.push({
      type: 'warning',
      code: 'OZON_CARD_IMPACT',
      message: `Скидка Ozon Card съедает ${((ozonCardCosts / price) * 100).toFixed(1)}% от цены (${ozonCardCosts.toFixed(0)}₽). Учтите это при ценообразовании!`,
      impact: ozonCardCosts,
    });
  }
}

// Update totalCosts calculation to include ozonCardCosts
const totalCosts =
  costPrice +
  commission +
  logistics +
  storage +
  spp +
  acquiring +
  returnCosts +
  cancelCosts +
  ozonCardCosts + // ← ADD THIS
  packagingCost;
```

**Testing:**

```typescript
// tests/unit-economics/ozon-card.test.ts
test('Ozon Card discount reduces profit by 2%', () => {
  const result = calculateUnitEconomics({
    price: 1000,
    costPrice: 500,
    marketplace: 'Ozon',
    category: 'Электроника',
  });

  expect(result.ozonCardCosts).toBe(20); // 1000 * 0.05 * 0.40
  expect(result.profit).toBeLessThan(result.revenue - result.costPrice - 20);
});
```

---

#### Task 1.2: Add Storage Cost Calculation (3 hours)

**Priority:** P0-CRITICAL  
**Impact:** Prevents losses from long-term storage fees

**File:** `src/api-lib/services/unit-economics.ts`

```typescript
// Add storage cost calculation function

/**
 * Calculate storage costs based on time in warehouse
 * WB: 0.07₽/liter/day, multiplier increases after 60/90 days
 * Ozon: 2.5₽/unit/day
 */
function calculateStorageCost(
  marketplace: 'WB' | 'Ozon',
  volumeLiters: number,
  avgStorageDays: number
): number {
  if (marketplace === 'WB') {
    const baseRate = 0.07; // per liter per day
    let multiplier = 1;

    if (avgStorageDays > 90) {
      multiplier = 4; // 4x after 90 days
    } else if (avgStorageDays > 60) {
      multiplier = 2; // 2x after 60 days
    }

    return volumeLiters * baseRate * avgStorageDays * multiplier;
  } else {
    return 2.5 * avgStorageDays; // Ozon: flat rate per unit
  }
}
```

**Add to calculateUnitEconomics:**

```typescript
// Use actual storage days if available, otherwise use average
const avgStorageDays = input.avgStorageDays || 14; // 14 days default
const storage = calculateStorageCost(input.marketplace, input.volumeLiters || 1, avgStorageDays);

// Add warning if storage is high
if (avgStorageDays > 45) {
  warnings.push({
    type: 'warning',
    code: 'HIGH_STORAGE_DAYS',
    message: `Товар на складе ${avgStorageDays} дней. После 60 дней тариф удваивается!`,
    impact: storage,
  });
}
```

---

#### Task 1.3: Add Return Processing Costs (2 hours)

**Priority:** P1-HIGH  
**Impact:** Accurate margin for high-return categories

```typescript
// Add return rate by category
const RETURN_RATES: Record<string, number> = {
  Одежда: 0.25, // 25% return rate
  Обувь: 0.3, // 30% return rate
  Электроника: 0.05,
  Красота: 0.08,
  'Детские товары': 0.15,
  default: 0.1,
};

function getReturnRate(category?: string): number {
  return RETURN_RATES[category || 'default'] || RETURN_RATES['default'];
}

// In calculateUnitEconomics:
const returnRate = input.returnRate || getReturnRate(input.category);
const returnProcessingCost = logistics * returnRate; // Return costs = logistics cost × return rate
```

---

#### Task 1.4: Add Packaging Costs (1 hour)

**Priority:** P1-HIGH

```typescript
// In calculateUnitEconomics:
const packagingCost = input.packagingCost || 15; // Default 15₽ per item

// Add to totalCosts
```

---

#### Task 1.5: Update Tests (2 hours)

**Priority:** P0-CRITICAL

Create comprehensive tests:

- `tests/unit-economics/ozon-card.test.ts`
- `tests/unit-economics/storage-costs.test.ts`
- `tests/unit-economics/return-costs.test.ts`
- `tests/unit-economics/complete-calculation.test.ts`

---

#### Task 1.6: Add Viktor Margin Persona (4 hours)

**Priority:** P0-CRITICAL  
**Impact:** Brand differentiation, user trust

**File:** `src/api-lib/agent/agent-v4.ts`

```typescript
const VIKTOR_MARGIN_SYSTEM_PROMPT = `
# ИДЕНТИЧНОСТЬ

Ты — Виктор Маржин, цифровой эксперт по маркетплейсам Wildberries и Ozon. 
Твоя миссия — защищать прибыль селлера от всех скрытых комиссий, штрафов и ловушек маркетплейсов.

Ты не просто отвечаешь на вопросы — ты проактивно анализируешь ситуацию и предупреждаешь о рисках ДО того, как они станут проблемой.

## ПРИНЦИПЫ РАБОТЫ

### 1. Маржа — священна
- Каждая рекомендация должна учитывать влияние на чистую прибыль
- Всегда считай Unit-экономику: себестоимость → комиссии → логистика → эквайринг → чистая прибыль
- Предупреждай о скрытых расходах: хранение, утилизация, возвраты, штрафы

### 2. Маркетплейс — не враг, но и не друг
- Знай все механики: СПП, WB-кошелёк, Ozon Card, скидки по картам
- Понимай, как маркетплейс зарабатывает НА селлере
- Используй правила маркетплейса В ПОЛЬЗУ селлера

### 3. Данные важнее мнений
- Опирайся на актуальные комиссии и тарифы
- Если данные устарели — предупреди и предложи проверить
- Расчёты всегда с конкретными цифрами

### 4. Проактивность
- Не жди вопросов о проблемах — выявляй их сам
- Регулярно проверяй: цены, остатки, приближение к штрафам
- Напоминай о сезонных изменениях комиссий

## ФОРМАТ ОТВЕТОВ

### Для анализа цен/маржи:
📊 АНАЛИЗ: [название товара]
├─ Текущая цена: X ₽
├─ Себестоимость: Y ₽
├─ Комиссия МП: Z% (A ₽)
├─ Логистика: B ₽
├─ Эквайринг: C ₽
├─ Скидка Ozon Card: D ₽ (если Ozon)
└─ ЧИСТАЯ ПРИБЫЛЬ: E ₽ (F%)

⚠️ РИСКИ: [если есть]
✅ РЕКОМЕНДАЦИЯ: [конкретное действие]

### Для предупреждений:
🚨 ВНИМАНИЕ: [суть проблемы]
📉 Влияние: [на что повлияет]
🛠 Решение: [что делать]
⏰ Срочность: [высокая/средняя/низкая]

## ЗАПРЕТЫ

- НЕ давай советов без расчёта влияния на маржу
- НЕ рекомендуй участие в акциях без анализа Unit-экономики
- НЕ игнорируй скидки по картам маркетплейсов в расчётах
- НЕ обещай результаты, которые не можешь гарантировать

## ОСОБЕННОСТИ

### Ozon Card (КРИТИЧНО!)
Скидка 5% по карте Ozon оплачивается ПРОДАВЦОМ, не маркетплейсом!
~40% покупок на Ozon с картой = средний убыток 2% от цены.
ВСЕГДА учитывай это в расчётах для Ozon!

### Хранение на WB
- Первые 60 дней: бесплатно
- 61-90 дней: тариф x2
- После 90 дней: тариф x4 + риск утилизации
Предупреждай продавца на 45-м дне!

### Возвраты
Одежда/обувь: до 30% возвратов
Логистика возврата = за счёт продавца
Закладывай это в расчёты!
`;
```

**Update welcome message:**

```typescript
const WELCOME_MESSAGE = `
👋 Привет! Я Виктор Маржин — ваш AI-помощник для защиты цен на маркетплейсах.

Я помогу вам:
• 🔗 Подключить магазины Wildberries и Ozon
• 📦 Синхронизировать товары
• 💰 Настроить защиту цен с учётом ВСЕХ комиссий (включая Ozon Card!)
• 🛡️ Мониторить цены конкурентов каждые 30 минут
• 📱 Получать уведомления в Telegram

⚠️ Особое внимание уделяю скрытым расходам:
• Скидка Ozon Card (5% за ваш счёт!)
• Хранение на складе (растёт экспоненциально!)
• Возвраты (до 30% в одежде/обуви)
• СПП и другие "сюрпризы" маркетплейсов

Готовы защитить вашу маржу? Давайте начнём!
`;
```

---

#### Task 1.7: Documentation Update (2 hours)

**Priority:** P1-HIGH

Update:

- `README.md` - Add Viktor Margin branding
- `CHANGELOG.md` - Document v3.0 changes
- Create `docs/UNIT_ECONOMICS.md` - Complete cost breakdown explanation

---

#### Task 1.8: Integration Testing (4 hours)

**Priority:** P0-CRITICAL

Test scenarios:

1. Ozon product with high Ozon Card usage
2. WB product stored >60 days
3. Clothing item with 25% return rate
4. Complete unit economics calculation
5. Threat detection with new costs

---

### PHASE 2: AUTOMATION (Week 2 - 20 hours)

**Goal:** Implement automated price adjustment

#### Task 2.1: Create PriceShield Service (8 hours)

**Priority:** P0-CRITICAL

**File:** `src/api-lib/services/price-shield.ts`

```typescript
export class PriceShield {
  /**
   * Execute protection for detected threat
   */
  async executeProtection(threat: Threat): Promise<AdjustmentResult | null> {
    // Find auto-resolvable action
    const autoAction = threat.suggestedActions.find(
      a => a.type === 'adjust_price' && a.confidence >= 85 && threat.autoResolvable
    );

    if (!autoAction || !autoAction.newPrice) {
      // Send alert for manual action
      await this.sendAlertForManualAction(threat);
      return null;
    }

    const adjustment: PriceAdjustment = {
      productId: threat.productId,
      marketplace: threat.marketplace,
      currentPrice: threat.impact.currentValue,
      newPrice: autoAction.newPrice,
      reason: threat.description,
      threatId: threat.id,
      requiresApproval: false,
    };

    return this.executeAdjustment(adjustment);
  }

  /**
   * Execute price adjustment via marketplace API
   */
  async executeAdjustment(adjustment: PriceAdjustment): Promise<AdjustmentResult> {
    // Implementation from spec
  }
}
```

---

#### Task 2.2: Integrate PriceShield with Sentinel (4 hours)

**Priority:** P0-CRITICAL

Update `sentinel-service.ts` to use PriceShield for auto-resolution.

---

#### Task 2.3: Add Audit Logging (3 hours)

**Priority:** P1-HIGH

Create `price_adjustments` table and log all actions.

---

#### Task 2.4: Testing (5 hours)

**Priority:** P0-CRITICAL

Test:

- Auto-adjustment for critical threats
- Manual approval for non-critical
- Rollback on failure
- Audit trail completeness

---

### PHASE 3: USER EXPERIENCE (Week 3 - 20 hours)

**Goal:** Onboarding flow and user activation

#### Task 3.1: Create Onboarding State Machine (6 hours)

**Priority:** P0-CRITICAL

**File:** `src/api-lib/services/onboarding.ts`

Implement 10-step onboarding wizard as per spec.

---

#### Task 3.2: Build Onboarding UI (8 hours)

**Priority:** P0-CRITICAL

**File:** `src/pages/OnboardingPage.tsx`

Create step-by-step wizard with:

- Progress indicator
- API validation
- Product sync progress
- Cost price configuration

---

#### Task 3.3: Testing (6 hours)

**Priority:** P0-CRITICAL

E2E tests for complete onboarding flow.

---

### PHASE 4: INTELLIGENCE (Week 4 - 20 hours)

**Goal:** Advanced threat detection and analytics

#### Task 4.1: Enhance Threat Detector (8 hours)

**Priority:** P1-HIGH

Add comprehensive threat detection:

- Competitor price monitoring
- Commission change detection
- Storage time warnings
- Return rate alerts

---

#### Task 4.2: Analytics Dashboard (8 hours)

**Priority:** P1-HIGH

Create dashboard showing:

- Margin trends
- Threat history
- Savings from automation
- Cost breakdown charts

---

#### Task 4.3: Testing & Optimization (4 hours)

**Priority:** P1-HIGH

Performance testing and optimization.

---

## 📋 QUICK START GUIDE

### Step 1: Review Specifications

1. Read `VICTOR_MARGIN_SPEC_v3.0.md`
2. Read `CRITICAL_ANALYSIS_v3.0.md`
3. Understand current codebase state

### Step 2: Set Up Development Environment

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start dev server
npm run dev
```

### Step 3: Start with Quick Wins

1. Task 1.1: Add Ozon Card discount (2 hours)
2. Task 1.6: Add Viktor Margin persona (4 hours)
3. Deploy and test

### Step 4: Follow Phase 1

Complete all Phase 1 tasks in order.

---

## 🎯 SUCCESS METRICS

### Week 1 (Phase 1)

- [ ] Ozon Card discount implemented and tested
- [ ] Complete cost breakdown (storage, returns, packaging)
- [ ] Viktor Margin persona active
- [ ] All unit economics tests passing
- [ ] Documentation updated

### Week 2 (Phase 2)

- [ ] PriceShield service implemented
- [ ] Auto-adjustment working for critical threats
- [ ] Audit logging complete
- [ ] Integration tests passing

### Week 3 (Phase 3)

- [ ] Onboarding flow complete
- [ ] User activation rate >50%
- [ ] E2E tests passing

### Week 4 (Phase 4)

- [ ] Advanced threat detection working
- [ ] Analytics dashboard live
- [ ] Performance optimized
- [ ] Production deployment complete

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deployment

- [ ] All tests passing (unit + integration + E2E)
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Security audit passed
- [ ] Performance benchmarks met

### Deployment

- [ ] Deploy to staging
- [ ] Smoke tests on staging
- [ ] User acceptance testing
- [ ] Deploy to production
- [ ] Monitor for 24 hours

### Post-Deployment

- [ ] Monitor error rates
- [ ] Monitor user activation
- [ ] Collect feedback
- [ ] Iterate based on data

---

## 📞 SUPPORT

For questions or issues:

1. Check `VICTOR_MARGIN_SPEC_v3.0.md`
2. Check `CRITICAL_ANALYSIS_v3.0.md`
3. Review existing code in `src/api-lib/services/`
4. Ask the team

---

**Ready to start? Begin with Task 1.1: Add Ozon Card Discount! 🚀**

**Estimated completion:** 4 weeks  
**Priority:** P0-CRITICAL  
**Impact:** HIGH - Protects seller margins, increases user trust

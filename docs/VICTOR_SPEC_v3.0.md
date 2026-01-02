# NeuroGUARDIAN v3.0: Виктор - AI Price Guardian

## Production-Ready Technical Specification

**Version:** 3.0.0  
**Date:** 2025-12-29  
**Priority:** P0 - CRITICAL  
**Status:** IMPLEMENTATION READY

---

## 📋 EXECUTIVE SUMMARY

### Mission Statement

Transform NeuroGUARDIAN into a **proactive AI agent** that protects seller margins on Wildberries and Ozon marketplaces through real-time price monitoring, automated threat detection, and intelligent price adjustments.

### Core Value Proposition

- **Margin Protection**: Prevent profit erosion from hidden fees, competitor actions, and marketplace discounts
- **Automation**: 30-minute monitoring cycles with automatic price adjustments
- **Transparency**: Complete visibility into all costs (commissions, logistics, Ozon Card, returns)
- **Proactivity**: Detect and resolve threats BEFORE they impact profitability

### Key Differentiators

1. **Ozon Card Awareness**: Only system that accounts for 5% seller-paid discount
2. **True Unit Economics**: Includes ALL hidden costs (storage, returns, packaging)
3. **Threat Intelligence**: Proactive competitor and marketplace monitoring
4. **Zero-Touch Operation**: Fully automated with optional manual approval gates

---

## 🎯 PART 1: SYSTEM ARCHITECTURE

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEUROGUARDIAN v3.0                           │
│                  "Виктор" AI Agent                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           DATA INGESTION LAYER                           │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  • Wildberries API (prices, stocks, orders)              │  │
│  │  • Ozon API (prices, stocks, orders, Ozon Card data)     │  │
│  │  • Competitor Price Scraper                              │  │
│  │  • Marketplace Commission Updates                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           SENTINEL ENGINE (Every 30 min)                 │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  1. Fetch current prices from all marketplaces           │  │
│  │  2. Calculate real-time unit economics                   │  │
│  │  3. Detect threats (competitors, discounts, margins)     │  │
│  │  4. Generate recommended actions                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           THREAT ANALYSIS ENGINE                         │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  • Competitor Price Drops                                │  │
│  │  • Ozon Card Discount Erosion (5% seller-paid)           │  │
│  │  • Margin Below Target                                   │  │
│  │  • Negative Margin (CRITICAL)                            │  │
│  │  • Commission/Logistics Changes                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           UNIT ECONOMICS CALCULATOR                      │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Selling Price                                           │  │
│  │  - Cost Price                                            │  │
│  │  - Marketplace Commission (category-specific)            │  │
│  │  - Logistics (FBO/FBS, weight, volume)                   │  │
│  │  - Ozon Card Discount (5% × 40% adoption rate)           │  │
│  │  - Acquiring Fee                                         │  │
│  │  - Storage Costs (time-based)                            │  │
│  │  - Return Processing (category return rate)              │  │
│  │  - Packaging                                             │  │
│  │  = NET PROFIT                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           PRICE SHIELD (Action Executor)                 │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  IF threat.autoResolvable && confidence >= 85%:          │  │
│  │    → Adjust price via marketplace API                    │  │
│  │    → Log to audit trail                                  │  │
│  │    → Send Telegram notification                          │  │
│  │  ELSE:                                                   │  │
│  │    → Send alert for manual approval                      │  │
│  │    → Wait for user decision                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           NOTIFICATION LAYER                             │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  • Telegram Bot (real-time alerts)                       │  │
│  │  • n8n Workflows (monitoring reports)                    │  │
│  │  • Web Dashboard (analytics)                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer             | Technology                  | Rationale                           |
| ----------------- | --------------------------- | ----------------------------------- |
| **Frontend**      | React 18 + TypeScript       | Existing stack, type-safe           |
| **Backend**       | Node.js 20 + TypeScript     | Existing stack, Vercel compatible   |
| **Database**      | PostgreSQL (Neon)           | Existing, production-ready          |
| **API Framework** | Express (Vercel Serverless) | Existing, proven                    |
| **AI Agent**      | Custom TypeScript Agent     | Full control, no external LLM costs |
| **Notifications** | Telegram Bot API + n8n      | Existing integrations               |
| **Monitoring**    | Sentinel (custom)           | Real-time price monitoring          |
| **Secrets**       | Environment Variables       | Secure, Vercel-compatible           |

### 1.3 Data Flow

```typescript
// Every 30 minutes:
1. Sentinel triggers → GET /api/sentinel/run
2. For each product:
   a. Fetch current marketplace price
   b. Calculate unit economics
   c. Detect threats
   d. Generate actions
3. Execute auto-resolvable actions
4. Send notifications (Telegram + n8n)
5. Log all actions to audit trail
```

---

## 🚀 PART 2: ONBOARDING FLOW

### 2.1 User Journey

```
NEW USER → Welcome Screen → API Setup → Product Sync → Cost Config →
Price Rules → Telegram Connect → Test Run → ACTIVE MONITORING
```

### 2.2 Implementation: Onboarding State Machine

**File:** `src/api-lib/services/onboarding.ts`

```typescript
export enum OnboardingStep {
  WELCOME = 'welcome',
  WB_API_SETUP = 'wb_api_setup',
  WB_API_VERIFY = 'wb_api_verify',
  OZON_API_SETUP = 'ozon_api_setup',
  OZON_API_VERIFY = 'ozon_api_verify',
  PRODUCT_SYNC = 'product_sync',
  COST_PRICE_CONFIG = 'cost_price_config',
  PRICE_RULES_SETUP = 'price_rules_setup',
  TELEGRAM_CONNECT = 'telegram_connect',
  TEST_MONITORING = 'test_monitoring',
  COMPLETED = 'completed',
}

export interface OnboardingState {
  userId: string;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  marketplaces: {
    wildberries: {
      connected: boolean;
      apiKey?: string; // encrypted
      supplierId?: string;
      productsCount?: number;
    } | null;
    ozon: {
      connected: boolean;
      clientId?: string;
      apiKey?: string; // encrypted
      productsCount?: number;
    } | null;
  };
  productsImported: number;
  costPricesConfigured: number;
  priceRulesConfigured: number;
  telegramConnected: boolean;
  createdAt: Date;
  lastInteraction: Date;
}
```

### 2.3 Onboarding Messages (Russian)

**Step 1: Welcome**

```
👋 Привет! Я NeuroGUARDIAN — ваш AI-помощник для защиты цен на маркетплейсах.

Я помогу вам:
• 🔗 Подключить магазины Wildberries и Ozon
• 📦 Синхронизировать товары
• 💰 Настроить защиту цен с учётом всех комиссий
• 🛡️ Мониторить цены конкурентов каждые 30 минут
• 📱 Получать уведомления в Telegram

Давайте начнём настройку! Для работы мне понадобятся API-ключи ваших магазинов.

**Шаг 1 из 10: Подключение Wildberries**

Для получения API-ключа Wildberries:
1. Войдите в личный кабинет продавца: https://seller.wildberries.ru
2. Перейдите в Настройки → Доступ к API
3. Создайте новый токен с правами:
   - Контент (чтение)
   - Цены и скидки (чтение и запись)
   - Статистика (чтение)

Отправьте мне полученный API-ключ, и я проверю подключение.

💡 Ключ будет надёжно зашифрован и использован только для работы с вашим магазином.
```

**Step 2: WB API Verification Success**

```
✅ Отлично! Wildberries успешно подключен!

📊 Информация о магазине:
• Название: {shopName}
• ID продавца: {supplierId}
• Товаров найдено: {productsCount}

**Шаг 2 из 10: Подключение Ozon**

Теперь давайте подключим Ozon. Для этого нужны:
1. **Client ID** — идентификатор продавца
2. **API Key** — ключ доступа

Как получить:
1. Войдите в личный кабинет: https://seller.ozon.ru
2. Перейдите в Настройки → API ключи
3. Создайте ключ с правами:
   - Товары (чтение)
   - Цены (чтение и запись)
   - Аналитика (чтение)

Сначала отправьте мне **Client ID** (это числовой идентификатор).
```

### 2.4 API Integration Validation

**File:** `src/api-lib/services/marketplace-validator.ts`

```typescript
export class MarketplaceValidator {
  /**
   * Validate Wildberries API key
   */
  async validateWBKey(apiKey: string): Promise<ValidationResult> {
    try {
      const client = new WildberriesClient({ apiKey });

      // Test API access
      const [info, products] = await Promise.all([
        client.getSellerInfo(),
        client.getProducts({ limit: 1 }),
      ]);

      return {
        success: true,
        data: {
          supplierId: info.supplierId,
          shopName: info.shopName,
          productsCount: products.total,
          permissions: this.detectWBPermissions(client),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: this.parseWBError(error),
      };
    }
  }

  /**
   * Validate Ozon API credentials
   */
  async validateOzonKey(clientId: string, apiKey: string): Promise<ValidationResult> {
    try {
      const client = new OzonClient({ clientId, apiKey });

      const [info, products] = await Promise.all([
        client.getSellerInfo(),
        client.getProducts({ limit: 1 }),
      ]);

      return {
        success: true,
        data: {
          clientId,
          shopName: info.name,
          productsCount: products.total,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: this.parseOzonError(error),
      };
    }
  }
}
```

---

## 💰 PART 3: UNIT ECONOMICS CALCULATOR

### 3.1 Complete Cost Breakdown

**File:** `src/api-lib/services/unit-economics.ts`

```typescript
export interface UnitEconomicsInput {
  productId: string;
  marketplace: 'wildberries' | 'ozon';
  sellingPrice: number;
  costPrice: number;
  weight: number; // kg
  volume: number; // liters
  category: string;

  // Optional overrides
  customReturnRate?: number;
  packagingCost?: number;
  promoDiscount?: number;
  promoCompensation?: number;
}

export interface UnitEconomicsResult {
  // Input
  sellingPrice: number;
  costPrice: number;

  // Marketplace fees
  marketplaceCommission: number;
  marketplaceCommissionPercent: number;

  // Payment processing
  acquiringFee: number;
  acquiringPercent: number;

  // Logistics
  logisticsCost: number;
  logisticsDetails: {
    firstMile: number; // To marketplace warehouse
    lastMile: number; // To customer
    returnCost: number; // Return shipping
    storageCost: number; // Warehouse storage
  };

  // ⚠️ CRITICAL: Marketplace-specific discounts
  ozonCardDiscount?: number; // 5% paid by seller (40% adoption rate)
  ozonPremiumDiscount?: number; // If enrolled
  wbWalletDiscount?: number; // WB Wallet cashback

  // Promotions
  promoDiscount: number;
  promoCompensation: number;

  // Other costs
  packagingCost: number;
  returnRate: number;
  returnProcessingCost: number;

  // Results
  totalCosts: number;
  grossProfit: number;
  netProfit: number;
  marginPercent: number;
  roi: number;

  // Safety thresholds
  minSafePrice: number; // Break-even price
  recommendedMinPrice: number; // Price for target margin

  // Warnings
  warnings: EconomicsWarning[];
}

export class UnitEconomicsCalculator {
  // 2025 Commission Rates
  private readonly WB_COMMISSIONS: Record<string, number> = {
    Одежда: 0.15,
    Обувь: 0.15,
    Электроника: 0.12,
    'Бытовая техника': 0.12,
    Красота: 0.18,
    'Детские товары': 0.15,
    Продукты: 0.1,
    'Товары для дома': 0.15,
    Спорт: 0.15,
    default: 0.15,
  };

  private readonly OZON_COMMISSIONS: Record<string, number> = {
    Одежда: 0.15,
    Обувь: 0.15,
    Электроника: 0.1,
    'Бытовая техника': 0.1,
    Красота: 0.2,
    'Детские товары': 0.15,
    Продукты: 0.08,
    'Товары для дома': 0.15,
    default: 0.15,
  };

  // ⚠️ CRITICAL: Ozon Card discount (paid by seller!)
  private readonly OZON_CARD_DISCOUNT_PERCENT = 0.05; // 5%
  private readonly OZON_CARD_ADOPTION_RATE = 0.4; // 40% of orders

  async calculate(input: UnitEconomicsInput): Promise<UnitEconomicsResult> {
    const warnings: EconomicsWarning[] = [];

    // 1. Marketplace commission
    const commissionRate = this.getCommissionRate(input.marketplace, input.category);
    const marketplaceCommission = input.sellingPrice * commissionRate;

    // 2. Acquiring fee
    const acquiringPercent = input.marketplace === 'ozon' ? 0.015 : 0.02;
    const acquiringFee = input.sellingPrice * acquiringPercent;

    // 3. Logistics
    const logisticsDetails = this.calculateLogistics(input);
    const logisticsCost =
      logisticsDetails.firstMile + logisticsDetails.lastMile + logisticsDetails.storageCost;

    // 4. ⚠️ CRITICAL: Ozon Card discount (seller pays!)
    let ozonCardDiscount = 0;
    if (input.marketplace === 'ozon') {
      ozonCardDiscount =
        input.sellingPrice * this.OZON_CARD_DISCOUNT_PERCENT * this.OZON_CARD_ADOPTION_RATE;

      if (ozonCardDiscount > input.sellingPrice * 0.02) {
        warnings.push({
          type: 'warning',
          code: 'OZON_CARD_IMPACT',
          message: `Скидка Ozon Card съедает ${((ozonCardDiscount / input.sellingPrice) * 100).toFixed(1)}% от цены`,
          impact: ozonCardDiscount,
        });
      }
    }

    // 5. Returns
    const returnRate = input.customReturnRate || this.getAverageReturnRate(input.category);
    const returnProcessingCost =
      (logisticsDetails.lastMile + logisticsDetails.returnCost) * returnRate;

    // 6. Packaging
    const packagingCost = input.packagingCost || 15;

    // 7. Promotions
    const promoDiscount = input.promoDiscount || 0;
    const promoCompensation = input.promoCompensation || 0;

    // Total costs
    const totalCosts =
      input.costPrice +
      marketplaceCommission +
      acquiringFee +
      logisticsCost +
      ozonCardDiscount +
      returnProcessingCost +
      packagingCost +
      promoDiscount -
      promoCompensation;

    const grossProfit = input.sellingPrice - input.costPrice;
    const netProfit = input.sellingPrice - totalCosts;
    const marginPercent = (netProfit / input.sellingPrice) * 100;
    const roi = (netProfit / input.costPrice) * 100;

    // Calculate safe prices
    const fixedCosts = packagingCost + logisticsDetails.firstMile;
    const variableCostRate =
      commissionRate +
      acquiringPercent +
      (input.marketplace === 'ozon'
        ? this.OZON_CARD_DISCOUNT_PERCENT * this.OZON_CARD_ADOPTION_RATE
        : 0);

    const minSafePrice = (input.costPrice + fixedCosts) / (1 - variableCostRate);
    const targetMargin = 0.2; // 20% default
    const recommendedMinPrice =
      (input.costPrice + fixedCosts) / (1 - variableCostRate - targetMargin);

    // Check for critical issues
    if (marginPercent < 0) {
      warnings.push({
        type: 'critical',
        code: 'NEGATIVE_MARGIN',
        message: `КРИТИЧНО: Вы работаете в убыток! Маржа: ${marginPercent.toFixed(1)}%`,
        impact: netProfit,
      });
    } else if (marginPercent < 5) {
      warnings.push({
        type: 'critical',
        code: 'VERY_LOW_MARGIN',
        message: `Маржа критически низкая (${marginPercent.toFixed(1)}%). Любое изменение комиссий приведёт к убытку.`,
        impact: netProfit,
      });
    } else if (marginPercent < 10) {
      warnings.push({
        type: 'warning',
        code: 'LOW_MARGIN',
        message: `Маржа ниже рекомендуемой (${marginPercent.toFixed(1)}%). Рекомендуется минимум 15%.`,
        impact: ((10 - marginPercent) / 100) * input.sellingPrice,
      });
    }

    return {
      sellingPrice: input.sellingPrice,
      costPrice: input.costPrice,
      marketplaceCommission,
      marketplaceCommissionPercent: commissionRate * 100,
      acquiringFee,
      acquiringPercent: acquiringPercent * 100,
      logisticsCost,
      logisticsDetails,
      ozonCardDiscount: input.marketplace === 'ozon' ? ozonCardDiscount : undefined,
      promoDiscount,
      promoCompensation,
      packagingCost,
      returnRate,
      returnProcessingCost,
      totalCosts,
      grossProfit,
      netProfit,
      marginPercent,
      roi,
      minSafePrice: Math.ceil(minSafePrice),
      recommendedMinPrice: Math.ceil(recommendedMinPrice),
      warnings,
    };
  }

  private calculateLogistics(input: UnitEconomicsInput) {
    if (input.marketplace === 'wildberries') {
      return this.calculateWBLogistics(input);
    } else {
      return this.calculateOzonLogistics(input);
    }
  }

  private calculateWBLogistics(input: UnitEconomicsInput) {
    const firstMile = 25; // FBS, 0 for FBO
    let lastMile = 55; // Base delivery cost

    if (input.weight > 1) {
      lastMile += (input.weight - 1) * 5;
    }
    if (input.volume > 1) {
      lastMile += (input.volume - 1) * 3;
    }

    const returnCost = lastMile * 0.33;
    const storageCost = input.volume * 0.07 * 14; // 14 days average

    return { firstMile, lastMile, returnCost, storageCost };
  }

  private calculateOzonLogistics(input: UnitEconomicsInput) {
    let firstMile: number;
    if (input.weight <= 5) firstMile = 76;
    else if (input.weight <= 10) firstMile = 90;
    else if (input.weight <= 15) firstMile = 120;
    else if (input.weight <= 25) firstMile = 180;
    else firstMile = 250;

    const lastMile = 65;
    const returnCost = 100;
    const storageCost = 2.5 * 14; // 14 days average

    return { firstMile, lastMile, returnCost, storageCost };
  }

  private getCommissionRate(marketplace: string, category: string): number {
    const commissions = marketplace === 'wildberries' ? this.WB_COMMISSIONS : this.OZON_COMMISSIONS;
    return commissions[category] || commissions['default'];
  }

  private getAverageReturnRate(category: string): number {
    const returnRates: Record<string, number> = {
      Одежда: 0.25,
      Обувь: 0.3,
      Электроника: 0.05,
      Красота: 0.08,
      'Детские товары': 0.15,
      default: 0.1,
    };
    return returnRates[category] || returnRates['default'];
  }
}
```

---

## 🛡️ PART 4: THREAT DETECTION ENGINE

### 4.1 Threat Types

```typescript
export enum ThreatType {
  // Competitor threats
  COMPETITOR_PRICE_DROP = 'competitor_price_drop',
  COMPETITOR_PROMO = 'competitor_promo',
  NEW_COMPETITOR = 'new_competitor',

  // Marketplace discount threats
  OZON_CARD_EROSION = 'ozon_card_erosion',
  WB_WALLET_EROSION = 'wb_wallet_erosion',
  MARKETPLACE_PROMO = 'marketplace_promo',

  // Commission threats
  COMMISSION_INCREASE = 'commission_increase',
  LOGISTICS_COST_INCREASE = 'logistics_cost_increase',

  // Internal threats
  MARGIN_BELOW_TARGET = 'margin_below_target',
  NEGATIVE_MARGIN = 'negative_margin',
  PRICE_BELOW_MINIMUM = 'price_below_minimum',

  // External threats
  CURRENCY_IMPACT = 'currency_impact',
  COST_PRICE_INCREASE = 'cost_price_increase',

  // System threats
  API_ERROR = 'api_error',
  SYNC_FAILURE = 'sync_failure',
}

export interface Threat {
  id: string;
  type: ThreatType;
  severity: 'critical' | 'high' | 'medium' | 'low';

  productId: string;
  productName: string;
  marketplace: 'wildberries' | 'ozon';

  description: string;
  impact: {
    currentValue: number;
    threatenedValue: number;
    potentialLoss: number;
    potentialLossPercent: number;
  };

  suggestedActions: SuggestedAction[];

  detectedAt: Date;
  expiresAt?: Date;
  autoResolvable: boolean;
}

export interface SuggestedAction {
  type: 'adjust_price' | 'alert_only' | 'request_approval' | 'block_sales';
  description: string;
  newPrice?: number;
  confidence: number; // 0-100
}
```

### 4.2 Threat Detector Implementation

**File:** `src/api-lib/services/threat-detector.ts`

```typescript
export class ThreatDetector {
  /**
   * Scan all threats for a product
   */
  async scanProductThreats(product: Product): Promise<Threat[]> {
    const threats: Threat[] = [];

    // 1. Economics threats
    threats.push(...(await this.checkEconomicsThreats(product)));

    // 2. Competitor threats
    threats.push(...(await this.checkCompetitorThreats(product)));

    // 3. Marketplace discount threats (Ozon Card!)
    threats.push(...(await this.checkMarketplaceDiscountThreats(product)));

    // 4. Rule violations
    threats.push(...(await this.checkRuleViolations(product)));

    return threats;
  }

  /**
   * ⚠️ CRITICAL: Check Ozon Card discount impact
   */
  private async checkMarketplaceDiscountThreats(product: Product): Promise<Threat[]> {
    const threats: Threat[] = [];

    if (product.marketplace === 'ozon') {
      const economics = await this.economicsCalculator.calculate({
        productId: product.id,
        marketplace: 'ozon',
        sellingPrice: product.currentPrice,
        costPrice: product.costPrice,
        weight: product.weight,
        volume: product.volume,
        category: product.category,
      });

      // Worst case: ALL orders with Ozon Card (5% discount)
      const worstCaseOzonCard = product.currentPrice * 0.05;
      const worstCaseMargin = economics.marginPercent - 5;

      if (worstCaseMargin < product.priceRule.targetMargin) {
        threats.push({
          id: `ozon_card_${product.id}_${Date.now()}`,
          type: ThreatType.OZON_CARD_EROSION,
          severity: worstCaseMargin < 5 ? 'critical' : worstCaseMargin < 10 ? 'high' : 'medium',

          productId: product.id,
          productName: product.name,
          marketplace: 'ozon',

          description: `Скидка Ozon Card (5%) угрожает маржинальности. При оплате картой Ozon вы теряете ${worstCaseOzonCard.toFixed(0)}₽ с каждого заказа.`,

          impact: {
            currentValue: economics.marginPercent,
            threatenedValue: worstCaseMargin,
            potentialLoss: worstCaseOzonCard,
            potentialLossPercent: 5,
          },

          suggestedActions: [
            {
              type: 'adjust_price',
              description: `Повысить цену на ${Math.ceil(worstCaseOzonCard / 0.95)}₽ чтобы компенсировать Ozon Card`,
              newPrice: Math.ceil(product.currentPrice * 1.053),
              confidence: 85,
            },
          ],

          detectedAt: new Date(),
          autoResolvable: product.priceRule.autoAdjust,
        });
      }
    }

    return threats;
  }

  /**
   * Check for negative margin (CRITICAL)
   */
  private async checkEconomicsThreats(product: Product): Promise<Threat[]> {
    const threats: Threat[] = [];

    const economics = await this.economicsCalculator.calculate({
      productId: product.id,
      marketplace: product.marketplace,
      sellingPrice: product.currentPrice,
      costPrice: product.costPrice,
      weight: product.weight,
      volume: product.volume,
      category: product.category,
    });

    if (economics.marginPercent < 0) {
      threats.push({
        id: `negative_margin_${product.id}_${Date.now()}`,
        type: ThreatType.NEGATIVE_MARGIN,
        severity: 'critical',

        productId: product.id,
        productName: product.name,
        marketplace: product.marketplace,

        description: `УБЫТОК! Каждая продажа приносит убыток ${Math.abs(economics.netProfit).toFixed(0)}₽`,

        impact: {
          currentValue: economics.netProfit,
          threatenedValue: 0,
          potentialLoss: Math.abs(economics.netProfit),
          potentialLossPercent: Math.abs(economics.marginPercent),
        },

        suggestedActions: [
          {
            type: 'adjust_price',
            description: `СРОЧНО поднять цену до ${economics.minSafePrice}₽ (минимум для безубыточности)`,
            newPrice: economics.minSafePrice,
            confidence: 100,
          },
          {
            type: 'block_sales',
            description: 'Снять товар с продажи до пересмотра цены',
            confidence: 80,
          },
        ],

        detectedAt: new Date(),
        autoResolvable: true, // Critical - auto-fix
      });
    }

    return threats;
  }
}
```

---

## ⚡ PART 5: PRICE SHIELD (Action Executor)

### 5.1 Automatic Price Adjustment

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
    // Audit log
    await this.auditLog.log({
      action: 'PRICE_ADJUSTMENT_STARTED',
      actor: 'price_shield',
      resource: adjustment.productId,
      details: adjustment,
    });

    try {
      let apiResponse: any;

      if (adjustment.marketplace === 'wildberries') {
        apiResponse = await this.adjustWBPrice(adjustment);
      } else {
        apiResponse = await this.adjustOzonPrice(adjustment);
      }

      const result: AdjustmentResult = {
        adjustment,
        success: true,
        apiResponse,
        executedAt: new Date(),
      };

      // Success audit log
      await this.auditLog.log({
        action: 'PRICE_ADJUSTMENT_SUCCESS',
        actor: 'price_shield',
        resource: adjustment.productId,
        details: result,
      });

      // Send notification
      await this.notificationService.sendPriceAdjustmentNotification({
        ...adjustment,
        success: true,
      });

      return result;
    } catch (error) {
      // Error handling
      const result: AdjustmentResult = {
        adjustment,
        success: false,
        error: error.message,
        executedAt: new Date(),
      };

      await this.auditLog.log({
        action: 'PRICE_ADJUSTMENT_FAILED',
        actor: 'price_shield',
        resource: adjustment.productId,
        details: result,
        error: error.message,
      });

      await this.notificationService.sendPriceAdjustmentNotification({
        ...adjustment,
        success: false,
        error: error.message,
      });

      return result;
    }
  }

  private async adjustWBPrice(adjustment: PriceAdjustment): Promise<any> {
    const response = await this.wbClient.updatePrice({
      nmId: parseInt(adjustment.productId.replace('wb_', '')),
      price: adjustment.newPrice,
    });

    if (response.error) {
      throw new Error(`WB API Error: ${response.errorText || response.error}`);
    }

    // Verify price was applied
    await this.sleep(2000);
    const currentPrice = await this.wbClient.getProductPrice(
      parseInt(adjustment.productId.replace('wb_', ''))
    );

    if (Math.abs(currentPrice - adjustment.newPrice) > 1) {
      throw new Error(
        `Price verification failed. Expected ${adjustment.newPrice}, got ${currentPrice}`
      );
    }

    return response;
  }

  private async adjustOzonPrice(adjustment: PriceAdjustment): Promise<any> {
    const response = await this.ozonClient.updatePrice({
      productId: parseInt(adjustment.productId.replace('ozon_', '')),
      price: adjustment.newPrice,
    });

    if (!response.result) {
      throw new Error(`Ozon API Error: ${response.message || 'Unknown error'}`);
    }

    return response;
  }
}
```

---

## 📊 PART 6: SENTINEL MONITORING

### 6.1 Monitoring Cycle (Every 30 minutes)

**File:** `api/handlers/sentinel.ts`

```typescript
export async function handleSentinelRun(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    // Get all active users with monitoring enabled
    const users = await db.query.users.findMany({
      where: eq(users.monitoringEnabled, true),
    });

    const results = [];

    for (const user of users) {
      const userResult = await runSentinelForUser(user.id);
      results.push(userResult);
    }

    // Send summary to n8n
    await sendToN8n('sentinel-summary', {
      timestamp: new Date().toISOString(),
      usersScanned: users.length,
      totalThreats: results.reduce((sum, r) => sum + r.threatsDetected, 0),
      autoResolved: results.reduce((sum, r) => sum + r.autoResolved, 0),
      duration: Date.now() - startTime,
    });

    res.json({
      success: true,
      results,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Sentinel run failed:', error);
    res.status(500).json({ error: error.message });
  }
}

async function runSentinelForUser(userId: string) {
  // 1. Get user products
  const products = await db.query.products.findMany({
    where: eq(products.userId, userId),
  });

  // 2. Fetch current prices from marketplaces
  const priceUpdates = await fetchCurrentPrices(products);

  // 3. Detect threats
  const threatDetector = new ThreatDetector();
  const allThreats: Threat[] = [];

  for (const product of products) {
    const threats = await threatDetector.scanProductThreats(product);
    allThreats.push(...threats);
  }

  // 4. Execute auto-resolvable actions
  const priceShield = new PriceShield();
  let autoResolved = 0;

  for (const threat of allThreats) {
    if (threat.autoResolvable && threat.severity === 'critical') {
      const result = await priceShield.executeProtection(threat);
      if (result?.success) {
        autoResolved++;
      }
    }
  }

  // 5. Send notifications
  if (allThreats.length > 0) {
    await sendTelegramAlert(userId, {
      threatsDetected: allThreats.length,
      critical: allThreats.filter(t => t.severity === 'critical').length,
      autoResolved,
      threats: allThreats.slice(0, 5), // Top 5
    });
  }

  return {
    userId,
    productsScanned: products.length,
    threatsDetected: allThreats.length,
    autoResolved,
  };
}
```

---

## 🔔 PART 7: NOTIFICATION SYSTEM

### 7.1 Telegram Alert Format

```typescript
export async function sendTelegramAlert(userId: string, data: AlertData) {
  const user = await getUserById(userId);
  if (!user.telegramChatId) return;

  const message = `
🛡️ **NeuroGUARDIAN: Отчёт мониторинга**

📅 ${new Date().toLocaleString('ru-RU')}

📊 **Статистика:**
• Проверено товаров: ${data.productsScanned}
• Обнаружено угроз: ${data.threatsDetected}
• Критических: ${data.critical}
• Автоматически исправлено: ${data.autoResolved}

${
  data.threats.length > 0
    ? `
⚠️ **Топ-5 угроз:**

${data.threats
  .map(
    (t, i) => `
${i + 1}. ${t.productName}
   Угроза: ${getThreatDescription(t.type)}
   Серьёзность: ${t.severity === 'critical' ? '🔴 КРИТИЧНО' : t.severity === 'high' ? '🟠 Высокая' : '🟡 Средняя'}
   Потенциальный убыток: ${t.impact.potentialLoss.toFixed(0)}₽
   ${t.autoResolvable ? '✅ Исправлено автоматически' : '⏳ Требуется ваше решение'}
`
  )
  .join('\n')}

💡 Откройте дашборд для подробностей: ${process.env.APP_URL}/dashboard
`
    : '✅ Все товары в безопасности!'
}
  `.trim();

  await bot.api.sendMessage(user.telegramChatId, message, {
    parse_mode: 'Markdown',
  });
}
```

---

## 🚀 PART 8: IMPLEMENTATION PLAN

### Phase 1: Foundation (Days 1-2)

- [ ] Review existing codebase structure
- [ ] Audit current unit economics calculator
- [ ] Verify marketplace API integrations
- [ ] Check Sentinel implementation

### Phase 2: Unit Economics Enhancement (Days 3-4)

- [ ] Implement complete cost breakdown
- [ ] Add Ozon Card discount calculation (5% × 40%)
- [ ] Add category-specific return rates
- [ ] Add storage cost calculations
- [ ] Implement min safe price formulas
- [ ] Write comprehensive tests

### Phase 3: Threat Detection (Days 5-6)

- [ ] Implement ThreatDetector class
- [ ] Add Ozon Card erosion detection
- [ ] Add competitor price monitoring
- [ ] Add margin violation detection
- [ ] Implement threat severity scoring

### Phase 4: Price Shield (Days 7-8)

- [ ] Implement PriceShield executor
- [ ] Add WB price adjustment API
- [ ] Add Ozon price adjustment API
- [ ] Implement audit logging
- [ ] Add price verification

### Phase 5: Onboarding Flow (Days 9-10)

- [ ] Create onboarding state machine
- [ ] Implement step-by-step wizard
- [ ] Add API validation
- [ ] Add product sync
- [ ] Add cost price configuration

### Phase 6: Sentinel Enhancement (Days 11-12)

- [ ] Enhance Sentinel to use new threat detector
- [ ] Add 30-minute cron job
- [ ] Implement batch processing
- [ ] Add n8n integration

### Phase 7: Notifications (Days 13-14)

- [ ] Enhance Telegram alerts
- [ ] Add n8n workflow triggers
- [ ] Implement alert templates
- [ ] Add user preferences

### Phase 8: Testing & Deployment (Days 15-16)

- [ ] Write integration tests
- [ ] Write E2E tests
- [ ] Load testing
- [ ] Deploy to production
- [ ] Monitor first 24 hours

---

## 📝 PART 9: ACCEPTANCE CRITERIA

### Must Have (P0)

- [ ] Unit economics calculator accounts for ALL costs including Ozon Card
- [ ] Threat detector identifies negative margins within 30 minutes
- [ ] Price Shield can auto-adjust prices via marketplace APIs
- [ ] Onboarding flow guides new users through complete setup
- [ ] Sentinel runs every 30 minutes for all active users
- [ ] Telegram notifications sent for all critical threats

### Should Have (P1)

- [ ] Competitor price monitoring
- [ ] Bulk price adjustment
- [ ] Analytics dashboard
- [ ] Historical threat tracking

### Nice to Have (P2)

- [ ] AI-powered price optimization
- [ ] Predictive margin forecasting
- [ ] Multi-language support

---

## 🔒 PART 10: SECURITY & COMPLIANCE

### API Key Storage

- All API keys encrypted at rest using AES-256-GCM
- Keys stored in environment variables (Vercel)
- Never logged or exposed in responses

### Audit Trail

- All price adjustments logged with timestamp, actor, reason
- Immutable audit log (append-only)
- Retention: 1 year

### Rate Limiting

- Marketplace API calls: respect vendor limits
- Sentinel: max 1 run per 30 minutes per user
- Price adjustments: max 10 per product per hour

---

## 📚 APPENDIX A: API ENDPOINTS

```
POST   /api/onboarding/start
POST   /api/onboarding/validate-wb-key
POST   /api/onboarding/validate-ozon-key
POST   /api/onboarding/sync-products
POST   /api/onboarding/complete

GET    /api/products
GET    /api/products/:id/economics
POST   /api/products/:id/update-cost-price
POST   /api/products/:id/set-price-rule

GET    /api/sentinel/run
GET    /api/sentinel/threats
POST   /api/sentinel/resolve-threat

POST   /api/price-shield/adjust
GET    /api/price-shield/audit-log

POST   /api/telegram/connect
POST   /api/telegram/webhook
```

---

## 📚 APPENDIX B: DATABASE SCHEMA

```sql
-- Onboarding state
CREATE TABLE onboarding_states (
  user_id TEXT PRIMARY KEY,
  current_step TEXT NOT NULL,
  completed_steps JSONB NOT NULL DEFAULT '[]',
  marketplaces JSONB NOT NULL DEFAULT '{}',
  products_imported INTEGER DEFAULT 0,
  cost_prices_configured INTEGER DEFAULT 0,
  price_rules_configured INTEGER DEFAULT 0,
  telegram_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_interaction TIMESTAMP DEFAULT NOW()
);

-- Price rules
CREATE TABLE price_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  min_price DECIMAL(10,2) NOT NULL,
  target_margin DECIMAL(5,2) NOT NULL,
  auto_adjust BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Threats
CREATE TABLE threats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  impact JSONB NOT NULL,
  suggested_actions JSONB NOT NULL,
  auto_resolvable BOOLEAN NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  detected_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Price adjustments audit
CREATE TABLE price_adjustments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  old_price DECIMAL(10,2) NOT NULL,
  new_price DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  threat_id TEXT,
  success BOOLEAN NOT NULL,
  error TEXT,
  executed_at TIMESTAMP DEFAULT NOW()
);
```

---

## ✅ NEXT STEPS

1. **Review this specification** with the team
2. **Audit existing code** against this spec
3. **Identify gaps** between current state and target state
4. **Create implementation tasks** in project management tool
5. **Begin Phase 1** implementation

---

**Document Version:** 3.0.0  
**Last Updated:** 2025-12-29  
**Author:** Principal Engineer (via Antigravity AI)  
**Status:** READY FOR IMPLEMENTATION

// ============================================
// NeuroGUARDIAN — Unit Economics Service
// Viktor v3.0: Complete Cost Breakdown
// Version: 3.0.0 | Date: 2025-12-29
// ============================================

// ============================================
// COMMISSION RATES (by category, UPDATED JAN 2025)
// ============================================

/**
 * Wildberries commission rates by category
 * UPDATED: Reflects Oct 31, 2025 Hikes (Fixed until April 2026)
 * Source: https://seller.wildberries.ru/supplier-settings/commission
 */
export const WB_COMMISSIONS: Record<string, number> = {
  // Fashion (Major hike on Oct 31, 2025)
  Одежда: 0.345, // Critical: 34.5% (Up from 29.5%)
  Обувь: 0.345, // Critical: 34.5% (Up from 29.5%)
  Аксессуары: 0.25, // Average 20-30%

  // Electronics
  Электроника: 0.17, // Was 15%
  Смартфоны: 0.14, // Was 13%
  Компьютеры: 0.15, // Was 14%
  'Аудио/Видео': 0.17, // Was 15%

  // Home & Garden
  'Дом и сад': 0.2, // Was 17%
  Мебель: 0.23, // Was 20%
  Декор: 0.2, // Was 18%
  Текстиль: 0.25, // High hike

  // Beauty & Kids
  Красота: 0.23, // Was 18%
  Парфюмерия: 0.22,
  Косметика: 0.24,
  'Детские товары': 0.22,
  Игрушки: 0.24,

  // Food & Sports
  Продукты: 0.18, // Was 15%
  Спорт: 0.22, // Was 18%

  // Default (Safe baseline for 2026)
  default: 0.25,
};

/**
 * Ozon commission rates by category
 * UPDATED: Nov 10, 2025 (Hike for most categories +5%)
 * Source: https://seller.ozon.ru/app/settings/tariff (Jan 2026 simplified list)
 */
export const OZON_COMMISSIONS: Record<string, number> = {
  // Electronics
  Электроника: 0.15, // Was 12%
  Смартфоны: 0.13, // Was 10%
  Компьютеры: 0.14, // Was 11%

  // Fashion (Hike on Nov 10, 2025)
  Одежда: 0.24, // High end of 15-24%
  Обувь: 0.24,
  Аксессуары: 0.2, // Was 17%

  // Home & Garden
  'Дом и сад': 0.2, // Was 15%
  Мебель: 0.21, // Was 16%
  Декор: 0.2, // Was 15%

  // Beauty
  Красота: 0.25, // Was 20%
  Парфюмерия: 0.23,

  // Kids
  'Детские товары': 0.2, // Was 15%
  Игрушки: 0.2,

  // Food
  Продукты: 0.12, // Was 8%, now 10-14%

  // Sports
  Спорт: 0.19, // Was 14%

  // Default (Reflects Nov 2025 increase)
  default: 0.2,
};

/**
 * ⚠️ CRITICAL: Ozon Card Discount Configuration
 *
 * The Ozon Card 5% discount is PAID BY THE SELLER, not by Ozon!
 * This is a hidden cost that many sellers don't account for.
 *
 * Impact Analysis:
 * - Discount: 5% of selling price
 * - Adoption Rate: ~40% of Ozon orders use Ozon Card
 * - Effective Impact: 2% average revenue loss per order
 *
 * Example: 1000₽ product
 * - Full Ozon Card discount: 50₽ (5%)
 * - Average impact (40% adoption): 20₽ (2%)
 * - Annual impact on 1000 orders: 20,000₽ lost margin
 *
 * Source: Ozon Seller Agreement 2025, Section 4.3
 * Updated: 2025-01-29
 */
export const OZON_CARD_CONFIG = {
  discountPercent: 0.05, // 5% discount when customer pays with Ozon Card
  adoptionRate: 0.45, // Increased in 2026
  effectiveImpact: 0.0225, // 2.25% average impact

  // Legacy export for backward compatibility
  get rate() {
    return this.discountPercent;
  },
};

// Backward compatibility
export const OZON_CARD_RATE = OZON_CARD_CONFIG.discountPercent;

// ============================================
// LOGISTICS COSTS (UPDATED JAN 2026)
// ============================================

/**
 * Average logistics costs per item (RUB)
 * UPDATED: Reflects Sept 2025 (WB) and Dec 2025 (Ozon) changes
 * Note: Actual costs depend on volume (liters)
 */
export const LOGISTICS_COSTS = {
  WB: {
    fbo: 46, // 2026 Base: 46₽ first liter (Was 38)
    fbs: 65, // 2026 Base: 65₽ (Was 55)
    express: 180,
  },
  Ozon: {
    fbo: 55, // 2026 Base: 55₽ (Was 50)
    fbs: 105, // Douglas Hike: 105₽ (Was 90)
    express: 140,
  },
};

/**
 * Storage costs per liter per day (RUB)
 * UPDATED: Reflects actual 2025 rates
 */
export const STORAGE_COSTS = {
  WB: 0.12, // 2026: 0.12₽/L/day (Was 0.08)
  Ozon: 1.5, // 2026: ~1.5-2.5₽ after free period
};

/**
 * SPP (Seller Price Reduction) - promotional fees
 */
export const SPP_RATES = {
  WB: 0.1, // ~10% average in 2026
  Ozon: 0.06, // ~6% average in 2026
};

/**
 * Acquiring (payment processing) fees
 * ADDED: Critical for Ozon (not included in commission)
 */
export const ACQUIRING_RATES = {
  WB: 0.015, // 2026: WB started charging for internal processing / bank fees (~1.5%)
  Ozon: 0.015, // 1.5% - NOT included in base commission
};

/**
 * Default return and cancellation rates for cost estimation
 */
export const DEFAULT_RATES = {
  returnRate: 0.1, // 10% average return rate
  cancelRate: 0.05, // 5% average cancellation rate
};

// ============================================
// CALCULATION FUNCTIONS
// ============================================

// ============================================
// CALCULATION FUNCTIONS
// ============================================

export interface UnitEconomicsInput {
  price: number;
  costPrice: number;
  category?: string;
  marketplace: 'WB' | 'Ozon';
  fulfillmentType?: 'fbo' | 'fbs' | 'express';
  volumeLiters?: number; // Volume in liters for variable logistics/storage
  avgStorageDays?: number;
  includeSpp?: boolean;
  returnRate?: number; // % of orders returned (default 10%)
  cancelRate?: number; // % of orders cancelled/not picked up (default 5%)
  useOzonCard?: boolean; // Whether to account for Ozon Card 5% discount
  packagingCost?: number; // Cost of packaging per unit (default 15 RUB)
  acceptanceFee?: number; // WB/Ozon acceptance fee (average 10-30 RUB)
  targetMarginPercent?: number; // Desired margin for recommended price (default 20%)
  taxRate?: number; // Tax rate (e.g. 0.06 or 0.07)
  marketingRate?: number; // Marketing cost / DRR (e.g. 0.10 for 10%)
  riskBufferPercent?: number; // Safety buffer for unexpected MP fees/fines (default 3%)
  minProfit?: number; // Minimum acceptable profit in RUB (e.g. 500)
}

export interface EconomicsWarning {
  type: 'critical' | 'warning' | 'info';
  code: string;
  message: string;
  impact: number; // Impact in RUB
}

export interface UnitEconomicsResult {
  revenue: number;
  costPrice: number;
  commission: number;
  commissionRate: number;
  logistics: number;
  storage: number;
  spp: number;
  acquiring: number;
  returnCosts: number;
  cancelCosts: number;
  ozonCardCosts: number;
  packagingCost: number;
  acceptanceFee: number;
  riskBuffer: number;
  tax: number;
  marketing: number;
  totalCosts: number;

  profit: number;
  margin: number;
  roi: number;

  // Safety & Recommendations
  minSafePrice: number; // Break-even price (margin = 0)
  recommendedMinPrice: number; // Price to achieve target margin
  warnings: EconomicsWarning[]; // Risk alerts

  breakdownPercent: {
    costPrice: number;
    commission: number;
    logistics: number;
    storage: number;
    spp: number;
    acquiring: number;
    returnCosts: number;
    cancelCosts: number;
    ozonCardCosts: number;
    packagingCost: number;
    acceptanceFee: number;
    riskBuffer: number;
    tax: number;
    marketing: number;
    profit: number;
  };
}

/**
 * Get commission rate for a category
 */
export function getCommissionRate(marketplace: 'WB' | 'Ozon', category?: string): number {
  const rates = marketplace === 'WB' ? WB_COMMISSIONS : OZON_COMMISSIONS;

  if (!category) return rates['default'];

  // Try exact match
  if (rates[category]) return rates[category];

  // Try partial match
  const categoryLower = category.toLowerCase();
  for (const [key, value] of Object.entries(rates)) {
    if (categoryLower.includes(key.toLowerCase()) || key.toLowerCase().includes(categoryLower)) {
      return value;
    }
  }

  return rates['default'];
}

/**
 * Calculate unit economics for a product
 * UPDATED: Includes 2026 High-Precision Formula (Hidden Fees, Acceptance, Risks)
 */
export function calculateUnitEconomics(input: UnitEconomicsInput): UnitEconomicsResult {
  const {
    price,
    costPrice,
    category,
    marketplace,
    fulfillmentType = 'fbo',
    avgStorageDays = 30,
    includeSpp = true,
    returnRate = DEFAULT_RATES.returnRate,
    cancelRate = DEFAULT_RATES.cancelRate,
    useOzonCard = true,
    packagingCost = 20, // 2026: Materials price increased
    acceptanceFee = 35, // 2026: Average acceptance cost (Приемка)
    targetMarginPercent = 20,
    taxRate = 0.07,
    marketingRate = 0.1,
    riskBufferPercent = 0.05, // 5% Safety buffer for "hidden MP magic"
    minProfit = 0,
  } = input;

  const warnings: EconomicsWarning[] = [];

  // Revenue
  const revenue = price;

  // Commission
  const commissionRate = getCommissionRate(marketplace, category);
  const commission = Math.round(price * commissionRate);

  // Logistics
  const logisticsCosts = LOGISTICS_COSTS[marketplace];
  let logistics = logisticsCosts[fulfillmentType] || logisticsCosts.fbo;

  if (marketplace === 'Ozon') {
    // 2025 Formula: 2% (sale) + 5.5% (last mile) + processing (fixed)
    // We use price-based logistics for Ozon as it scales with value
    const variableLogistics = Math.round(price * 0.075);
    const fixedProcessing = 45;
    logistics = variableLogistics + fixedProcessing;
  } else if (marketplace === 'WB' && input.volumeLiters && input.volumeLiters > 1) {
    // WB variable logistics (2025 formula: 38 + 9.5 per extra liter)
    logistics += (input.volumeLiters - 1) * 9.5;
  }

  // Storage
  const volume = input.volumeLiters || 1;
  const storageCostPerDay = STORAGE_COSTS[marketplace] * volume;
  const storage = Math.round(storageCostPerDay * avgStorageDays);

  // SPP
  const sppRate = includeSpp ? SPP_RATES[marketplace] : 0;
  const spp = Math.round(price * sppRate);

  // Acquiring
  const acquiringRate = ACQUIRING_RATES[marketplace];
  const acquiring = Math.round(price * acquiringRate);

  // Return costs (logistics both ways)
  const returnCosts = Math.round(logistics * 2 * returnRate);

  // Cancellation costs
  const cancelCosts = marketplace === 'Ozon' ? Math.round(logistics * cancelRate) : 0;

  // Ozon Card Discount (Seller-funded)
  let ozonCardCosts = 0;

  if (marketplace === 'Ozon' && useOzonCard) {
    const fullDiscount = price * OZON_CARD_CONFIG.discountPercent;
    ozonCardCosts = Math.round(fullDiscount * OZON_CARD_CONFIG.adoptionRate);

    const impactPercent = (ozonCardCosts / price) * 100;

    if (ozonCardCosts > price * 0.015) {
      const annualImpact = ozonCardCosts * 1000; // Impact on 1000 orders

      warnings.push({
        type: impactPercent > 2.5 ? 'critical' : 'warning',
        code: 'OZON_CARD_IMPACT',
        message:
          `⚠️ Скидка Ozon Card съедает ${ozonCardCosts.toFixed(0)}₽ (${impactPercent.toFixed(1)}%) с каждого заказа! ` +
          `При 1000 заказов в год вы теряете ${annualImpact.toFixed(0)}₽ маржи. ` +
          `Учтите это при ценообразовании!`,
        impact: ozonCardCosts,
      });
    }
  }

  // Risk Buffer (Physical risks, unexpected fines, dimension mismatch)
  const riskBuffer = Math.round(price * riskBufferPercent);

  // Tax & Marketing
  const tax = Math.round(price * taxRate);
  const marketing = Math.round(price * marketingRate);

  // Total costs
  const totalCosts =
    costPrice +
    commission +
    logistics +
    storage +
    spp +
    acquiring +
    returnCosts +
    cancelCosts +
    ozonCardCosts +
    packagingCost +
    acceptanceFee +
    riskBuffer +
    tax +
    marketing;

  // Profit
  const profit = revenue - totalCosts;

  // Margin (% of revenue)
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  // ROI (% of investment)
  const roi = costPrice > 0 ? Math.round((profit / costPrice) * 100) : 0;

  // Check Negative Profit or Min Margin
  if (profit < minProfit) {
    warnings.push({
      type: profit < 0 ? 'critical' : 'warning',
      code: profit < 0 ? 'NEGATIVE_PROFIT' : 'LOW_MARGIN',
      message:
        profit < 0
          ? 'Товар продается в убыток (отрицательная прибыль)'
          : `Прибыль (${profit}₽) ниже минимально допустимой (${minProfit}₽)`,
      impact: profit - minProfit,
    });
  }

  // ⚠️ Storage Duration Warning (WB exponential cost increase)
  if (marketplace === 'WB' && avgStorageDays > 45) {
    const daysUntilIncrease = avgStorageDays > 90 ? 0 : avgStorageDays > 60 ? 30 : 15;
    const multiplier = avgStorageDays > 90 ? 4 : avgStorageDays > 60 ? 2 : 1;
    const futureMultiplier = avgStorageDays > 60 ? 4 : 2;

    warnings.push({
      type: avgStorageDays > 60 ? 'critical' : 'warning',
      code: 'HIGH_STORAGE_DAYS',
      message:
        `⚠️ Товар на складе ${avgStorageDays} дней! ` +
        (avgStorageDays > 90
          ? `Тариф хранения уже x4 (${storage.toFixed(0)}₽). Срочно распродавайте или вывозите!`
          : avgStorageDays > 60
            ? `Тариф хранения уже x2. Через ${daysUntilIncrease} дней будет x4! Планируйте распродажу.`
            : `Через ${daysUntilIncrease} дней тариф удвоится! Планируйте распродажу ДО 60-го дня.`),
      impact: storage * (futureMultiplier - multiplier),
    });
  }

  // ⚠️ High Return Rate Warning
  if (returnRate > 0.15) {
    const returnImpact = returnCosts;
    warnings.push({
      type: returnRate > 0.25 ? 'critical' : 'warning',
      code: 'HIGH_RETURN_RATE',
      message:
        `⚠️ Высокий процент возвратов (${(returnRate * 100).toFixed(0)}%)! ` +
        `Это съедает ${returnImpact.toFixed(0)}₽ с каждого заказа. ` +
        `Улучшите описание товара, размерную сетку и фото.`,
      impact: returnImpact,
    });
  }

  // --- Safe Price Calculation ---
  // Formula: Price = (FixedCosts) / (1 - VariableRate)
  const variableRate =
    commissionRate +
    sppRate +
    acquiringRate +
    taxRate +
    marketingRate +
    riskBufferPercent +
    (marketplace === 'Ozon' && useOzonCard
      ? OZON_CARD_CONFIG.discountPercent * OZON_CARD_CONFIG.adoptionRate
      : 0);

  const fixedCosts =
    costPrice + logistics + storage + returnCosts + cancelCosts + packagingCost + acceptanceFee;

  // 1. Break-even Price (Profit = 0)
  const minSafePrice = Math.ceil(fixedCosts / (1 - variableRate));

  // 2. Recommended Price
  const targetRate = targetMarginPercent / 100;
  const recommendedMinPrice = Math.ceil(fixedCosts / (1 - variableRate - targetRate));

  return {
    revenue,
    costPrice,
    commission,
    commissionRate,
    logistics,
    storage,
    spp,
    acquiring,
    returnCosts,
    cancelCosts,
    ozonCardCosts,
    packagingCost,
    acceptanceFee,
    riskBuffer,
    tax,
    marketing,
    totalCosts,

    profit,
    margin,
    roi,

    minSafePrice,
    recommendedMinPrice,
    warnings,

    breakdownPercent: {
      costPrice: revenue > 0 ? Math.round((costPrice / revenue) * 100) : 0,
      commission: revenue > 0 ? Math.round((commission / revenue) * 100) : 0,
      logistics: revenue > 0 ? Math.round((logistics / revenue) * 100) : 0,
      storage: revenue > 0 ? Math.round((storage / revenue) * 100) : 0,
      spp: revenue > 0 ? Math.round((spp / revenue) * 100) : 0,
      acquiring: revenue > 0 ? Math.round((acquiring / revenue) * 100) : 0,
      returnCosts: revenue > 0 ? Math.round((returnCosts / revenue) * 100) : 0,
      cancelCosts: revenue > 0 ? Math.round((cancelCosts / revenue) * 100) : 0,
      ozonCardCosts: revenue > 0 ? Math.round((ozonCardCosts / revenue) * 100) : 0,
      packagingCost: revenue > 0 ? Math.round((packagingCost / revenue) * 100) : 0,
      acceptanceFee: revenue > 0 ? Math.round((acceptanceFee / revenue) * 100) : 0,
      riskBuffer: revenue > 0 ? Math.round((riskBuffer / revenue) * 100) : 0,
      tax: revenue > 0 ? Math.round((tax / revenue) * 100) : 0,
      marketing: revenue > 0 ? Math.round((marketing / revenue) * 100) : 0,
      profit: margin,
    },
  };
}

/**
 * Estimate cost price if not provided (30% of selling price)
 * Returns estimated value and a warning flag
 */
/**
 * Estimate cost price if not provided based on industry averages
 * Returns estimated value and a warning flag
 */
export function estimateCostPrice(
  price: number,
  category?: string
): { costPrice: number; isEstimated: boolean } {
  let factor = 0.4; // Default: 40% of selling price (decent margin)

  if (category) {
    const cat = category.toLowerCase();
    if (cat.includes('электроника') || cat.includes('смартфон') || cat.includes('компьютер')) {
      factor = 0.75; // Electronics: thin margins, high cost (75%)
    } else if (cat.includes('одежда') || cat.includes('обувь') || cat.includes('аксессуар')) {
      factor = 0.25; // Fashion: high margins, low cost (25%)
    } else if (cat.includes('продукты') || cat.includes('еда')) {
      factor = 0.6; // Food: medium-high cost
    }
  }

  return {
    costPrice: Math.round(price * factor),
    isEstimated: true,
  };
}

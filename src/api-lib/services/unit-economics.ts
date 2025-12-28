// ============================================
// NeuroGUARDIAN — Unit Economics Service
// Business logic for profit calculations
// Version: 1.0.0 | Date: December 2024
// ============================================

// ============================================
// COMMISSION RATES (by category, UPDATED JAN 2025)
// ============================================

/**
 * Wildberries commission rates by category
 * UPDATED: Reflects June 2025 (+5%) and October 2025 increases
 * Source: https://seller.wildberries.ru/supplier-settings/commission
 */
export const WB_COMMISSIONS: Record<string, number> = {
  // Electronics (after +5% in June 2025)
  Электроника: 0.15, // Was 0.12, now 13-17% (avg 15%)
  Смартфоны: 0.13, // Was 0.10
  Компьютеры: 0.14, // Was 0.11
  'Аудио/Видео': 0.15, // Was 0.12

  // Fashion (after +5% in June 2025)
  Одежда: 0.25, // Was 0.15, now 20-30% (avg 25%)
  Обувь: 0.25, // Was 0.15, now 20-30%
  Аксессуары: 0.2, // Was 0.14, now 15-25%

  // Home & Garden (after +5% in June 2025)
  'Дом и сад': 0.17, // Was 0.13
  Мебель: 0.2, // Was 0.15
  Декор: 0.18, // Was 0.14
  Текстиль: 0.2, // Was 0.14, +5% in June

  // Beauty
  Красота: 0.18, // Was 0.13
  Парфюмерия: 0.17, // Was 0.12
  Косметика: 0.19, // Was 0.14

  // Kids
  'Детские товары': 0.18, // Was 0.13
  Игрушки: 0.19, // Was 0.14

  // Food
  Продукты: 0.15, // Was 0.10

  // Sports
  Спорт: 0.18, // Was 0.13

  // Default (after October 2025 increases, can be up to 34.5%)
  default: 0.2, // Was 0.14
};

/**
 * Ozon commission rates by category
 * UPDATED: Reflects TZ v2.0 Production spec (2025)
 * Source: https://seller.ozon.ru/app/settings/tariff
 */
export const OZON_COMMISSIONS: Record<string, number> = {
  // Electronics
  Электроника: 0.12, // 8-15% range (avg 12%)
  Смартфоны: 0.1, // 8-12%
  Компьютеры: 0.11, // 8-13%

  // Fashion (after 2025 increases)
  Одежда: 0.2, // Was 0.14, now 15-24% (avg 20%)
  Обувь: 0.2, // Was 0.14, now 15-24%
  Аксессуары: 0.17, // Was 0.13, now 13-20%

  // Home & Garden
  'Дом и сад': 0.15, // TZ 2.0 Spec: 15%
  Мебель: 0.16, // Was 0.14
  Декор: 0.15, // Was 0.13

  // Beauty
  Красота: 0.2, // TZ 2.0 Spec: 20%
  Парфюмерия: 0.18, // Adjusted

  // Kids
  'Детские товары': 0.15, // TZ 2.0 Spec: 15%
  Игрушки: 0.15,

  // Food
  Продукты: 0.08, // TZ 2.0 Spec: 8%

  // Sports
  Спорт: 0.14, // Was 0.12

  // Default (4-24% range, avg 15%)
  default: 0.15,
};

/**
 * TZ 2.0: Ozon Card discount (up to 5%, paid by seller)
 * CRITICAL: This affects the base net-revenue!
 */
export const OZON_CARD_RATE = 0.05;

// ============================================
// LOGISTICS COSTS (UPDATED JAN 2025)
// ============================================

/**
 * Average logistics costs per item (RUB)
 * UPDATED: Reflects June-September 2025 changes
 * Note: Actual costs depend on volume (liters)
 */
export const LOGISTICS_COSTS = {
  WB: {
    fbo: 35, // Average for 0.001-1L (23-46₽ range)
    fbs: 50, // Updated from 45₽
    express: 120, // Express delivery
  },
  Ozon: {
    fbo: 46, // Updated from 55₽ (June 2025)
    fbs: 80, // CRITICAL: Updated from 40₽ (June 2025) - doubled!
    express: 100,
  },
};

/**
 * Storage costs per liter per day (RUB)
 * UPDATED: Reflects actual 2025 rates
 */
export const STORAGE_COSTS = {
  WB: 0.08, // CRITICAL: Updated from 2.5₽ - 0.08₽/L/day for boxes
  Ozon: 0.75, // Average: 0-2.5₽ depending on storage duration
};

/**
 * SPP (Seller Price Reduction) - promotional fees
 */
export const SPP_RATES = {
  WB: 0.08, // ~8% average
  Ozon: 0.05, // ~5% average
};

/**
 * Acquiring (payment processing) fees
 * ADDED: Critical for Ozon (not included in commission)
 */
export const ACQUIRING_RATES = {
  WB: 0, // Included in commission
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
  useOzonCard?: boolean; // NEW: Whether to account for Ozon Card 5% discount
}

export interface UnitEconomicsResult {
  revenue: number;
  costPrice: number;
  commission: number;
  commissionRate: number;
  logistics: number;
  storage: number;
  spp: number;
  acquiring: number; // NEW: Payment processing fees
  returnCosts: number; // NEW: Costs for logistics both ways
  cancelCosts: number; // NEW: Costs for cancellations
  ozonCardCosts: number; // NEW: Costs for Ozon Card discount (seller-funded)
  totalCosts: number;

  profit: number;
  margin: number;
  roi: number;
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
 * UPDATED: Includes acquiring, returns, and cancellations (2025)
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
    useOzonCard = true, // Default to true as most Ozon sellers have it
  } = input;

  // Revenue
  const revenue = price;

  // Commission
  const commissionRate = getCommissionRate(marketplace, category);
  const commission = Math.round(price * commissionRate);

  // Logistics
  const logisticsCosts = LOGISTICS_COSTS[marketplace];
  let logistics = logisticsCosts[fulfillmentType] || logisticsCosts.fbo;

  // WB variable logistics: base price + extra for each liter > 1L (simplified for 2025)
  if (marketplace === 'WB' && input.volumeLiters && input.volumeLiters > 1) {
    logistics += (input.volumeLiters - 1) * 7; // ~7₽ per extra liter
  }

  // Storage (calculated per liter per day as per TZ 2.0)
  const volume = input.volumeLiters || 1; // Default to 1L if not specified
  const storageCostPerDay = STORAGE_COSTS[marketplace] * volume;
  const storage = Math.round(storageCostPerDay * avgStorageDays);

  // SPP (promotional fees)
  const sppRate = includeSpp ? SPP_RATES[marketplace] : 0;
  const spp = Math.round(price * sppRate);

  // Acquiring (payment processing) - NEW!
  const acquiringRate = ACQUIRING_RATES[marketplace];
  const acquiring = Math.round(price * acquiringRate);

  // Return costs (logistics both ways) - NEW!
  // When customer returns, seller pays logistics to customer and back
  const returnCosts = Math.round(logistics * 2 * returnRate);

  // Cancellation costs ("last mile" for Ozon since March 2025) - NEW!
  // Ozon now charges seller for "last mile" delivery on cancelled/not picked up orders
  const cancelCosts = marketplace === 'Ozon' ? Math.round(logistics * cancelRate) : 0;

  // Ozon Card Discount (Seller-funded) - NEW!
  const ozonCardCosts =
    marketplace === 'Ozon' && useOzonCard ? Math.round(price * OZON_CARD_RATE) : 0;

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
    ozonCardCosts;

  // Profit
  const profit = revenue - totalCosts;

  // Margin (% of revenue)
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  // ROI (% of investment)
  const roi = costPrice > 0 ? Math.round((profit / costPrice) * 100) : 0;

  // Breakdown as percentages of revenue
  const breakdownPercent = {
    costPrice: revenue > 0 ? Math.round((costPrice / revenue) * 100) : 0,
    commission: revenue > 0 ? Math.round((commission / revenue) * 100) : 0,
    logistics: revenue > 0 ? Math.round((logistics / revenue) * 100) : 0,
    storage: revenue > 0 ? Math.round((storage / revenue) * 100) : 0,
    spp: revenue > 0 ? Math.round((spp / revenue) * 100) : 0,
    acquiring: revenue > 0 ? Math.round((acquiring / revenue) * 100) : 0,
    returnCosts: revenue > 0 ? Math.round((returnCosts / revenue) * 100) : 0,
    cancelCosts: revenue > 0 ? Math.round((cancelCosts / revenue) * 100) : 0,
    ozonCardCosts: revenue > 0 ? Math.round((ozonCardCosts / revenue) * 100) : 0,
    profit: margin,
  };

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
    totalCosts,

    profit,
    margin,
    roi,
    breakdownPercent,
  };
}

/**
 * Estimate cost price if not provided (30% of selling price)
 * Returns estimated value and a warning flag
 */
export function estimateCostPrice(price: number): { costPrice: number; isEstimated: boolean } {
  return {
    costPrice: Math.round(price * 0.3),
    isEstimated: true,
  };
}

/**
 * Calculate break-even price (minimum price to cover costs)
 * UPDATED: Includes acquiring and uses 2025 rates
 */
export function calculateBreakEvenPrice(
  costPrice: number,
  marketplace: 'WB' | 'Ozon',
  category?: string
): number {
  const commissionRate = getCommissionRate(marketplace, category);
  const sppRate = SPP_RATES[marketplace];
  const acquiringRate = ACQUIRING_RATES[marketplace];
  const logistics = LOGISTICS_COSTS[marketplace].fbo;
  const storage = STORAGE_COSTS[marketplace] * 30; // 30 days

  // Account for returns and cancellations
  const returnCosts = logistics * 2 * DEFAULT_RATES.returnRate;
  const cancelCosts = marketplace === 'Ozon' ? logistics * DEFAULT_RATES.cancelRate : 0;

  // Price = (costPrice + logistics + storage + returnCosts + cancelCosts) / (1 - commission - spp - acquiring - ozonCard)
  const ozonCardRate = marketplace === 'Ozon' ? OZON_CARD_RATE : 0;
  const fixedCosts = costPrice + logistics + storage + returnCosts + cancelCosts;
  const variableRate = 1 - commissionRate - sppRate - acquiringRate - ozonCardRate;

  return Math.ceil(fixedCosts / variableRate);
}

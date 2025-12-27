// ============================================
// NeuroGUARDIAN — Unit Economics Service
// Business logic for profit calculations
// Version: 1.0.0 | Date: December 2024
// ============================================

// ============================================
// COMMISSION RATES (by category, updated Dec 2024)
// ============================================

/**
 * Wildberries commission rates by category
 * Source: https://seller.wildberries.ru/supplier-settings/commission
 */
export const WB_COMMISSIONS: Record<string, number> = {
  // Electronics
  Электроника: 0.12,
  Смартфоны: 0.1,
  Компьютеры: 0.11,
  'Аудио/Видео': 0.12,

  // Fashion
  Одежда: 0.15,
  Обувь: 0.15,
  Аксессуары: 0.14,

  // Home & Garden
  'Дом и сад': 0.13,
  Мебель: 0.15,
  Декор: 0.14,
  Текстиль: 0.14,

  // Beauty
  Красота: 0.13,
  Парфюмерия: 0.12,
  Косметика: 0.14,

  // Kids
  'Детские товары': 0.13,
  Игрушки: 0.14,

  // Food
  Продукты: 0.1,

  // Sports
  Спорт: 0.13,

  // Default
  default: 0.14,
};

/**
 * Ozon commission rates by category
 * Source: https://seller.ozon.ru/app/settings/tariff
 */
export const OZON_COMMISSIONS: Record<string, number> = {
  // Electronics
  Электроника: 0.11,
  Смартфоны: 0.08,
  Компьютеры: 0.1,

  // Fashion
  Одежда: 0.14,
  Обувь: 0.14,
  Аксессуары: 0.13,

  // Home & Garden
  'Дом и сад': 0.12,
  Мебель: 0.14,
  Декор: 0.13,

  // Beauty
  Красота: 0.12,
  Парфюмерия: 0.11,

  // Kids
  'Детские товары': 0.12,
  Игрушки: 0.13,

  // Food
  Продукты: 0.08,

  // Sports
  Спорт: 0.12,

  // Default (Ozon FBS average)
  default: 0.13,
};

// ============================================
// LOGISTICS COSTS
// ============================================

/**
 * Average logistics costs per item (RUB)
 * These depend on weight/size, using average values
 */
export const LOGISTICS_COSTS = {
  WB: {
    fbo: 60, // WB handles fulfillment
    fbs: 45, // Seller ships to WB
    express: 120, // Express delivery,
  },
  Ozon: {
    fbo: 55,
    fbs: 40,
    express: 100,
  },
};

/**
 * Storage costs per item per day (RUB)
 */
export const STORAGE_COSTS = {
  WB: 2.5, // Per day per item
  Ozon: 2.0,
};

/**
 * SPP (Seller Price Reduction) - promotional fees
 */
export const SPP_RATES = {
  WB: 0.08, // ~8% average
  Ozon: 0.05, // ~5% average
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
  avgStorageDays?: number;
  includeSpp?: boolean;
}

export interface UnitEconomicsResult {
  revenue: number;
  costPrice: number;
  commission: number;
  commissionRate: number;
  logistics: number;
  storage: number;
  spp: number;
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
  } = input;

  // Revenue
  const revenue = price;

  // Commission
  const commissionRate = getCommissionRate(marketplace, category);
  const commission = Math.round(price * commissionRate);

  // Logistics
  const logisticsCosts = LOGISTICS_COSTS[marketplace];
  const logistics = logisticsCosts[fulfillmentType] || logisticsCosts.fbo;

  // Storage
  const storageCostPerDay = STORAGE_COSTS[marketplace];
  const storage = Math.round(storageCostPerDay * avgStorageDays);

  // SPP (promotional fees)
  const sppRate = includeSpp ? SPP_RATES[marketplace] : 0;
  const spp = Math.round(price * sppRate);

  // Total costs
  const totalCosts = costPrice + commission + logistics + storage + spp;

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
 */
export function calculateBreakEvenPrice(
  costPrice: number,
  marketplace: 'WB' | 'Ozon',
  category?: string
): number {
  const commissionRate = getCommissionRate(marketplace, category);
  const sppRate = SPP_RATES[marketplace];
  const logistics = LOGISTICS_COSTS[marketplace].fbo;
  const storage = STORAGE_COSTS[marketplace] * 30; // 30 days

  // Price = (costPrice + logistics + storage) / (1 - commission - spp)
  const fixedCosts = costPrice + logistics + storage;
  const variableRate = 1 - commissionRate - sppRate;

  return Math.ceil(fixedCosts / variableRate);
}

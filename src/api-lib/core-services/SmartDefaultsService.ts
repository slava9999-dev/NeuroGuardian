// ============================================
// NeuroGUARDIAN — Smart Defaults Service
// Auto-calculates optimal protection settings for products
// Goal: Reduce setup time from 2 hours → 3 minutes
// ============================================

import { createLogger } from '../lib/logger.js';

const logger = createLogger({ service: 'SmartDefaultsService' });

/**
 * Smart defaults configuration based on marketplace and category
 */
export interface SmartDefaults {
  minPrice: number; // Calculated minimum price (stop-loss)
  sppBufferPercent: number; // Expected platform discount percentage
  protectionMode: 'zero_stock' | 'price_correction';
  confidence: number; // Model confidence (0-1)
  reasoning: string; // Human-readable explanation
}

/**
 * Product data for smart defaults calculation
 */
export interface ProductForDefaults {
  productId: string;
  currentPrice: number;
  marketplace: 'WB' | 'Ozon';
  title?: string;
  category?: string;
  currentStock?: number;
  costPrice?: number | null;
}

/**
 * Category-based margin profiles
 * Based on real marketplace data analysis
 */
const CATEGORY_MARGINS: Record<string, { avgMargin: number; avgSpp: number }> = {
  // Clothing & Fashion
  одежда: { avgMargin: 0.35, avgSpp: 0.25 },
  обувь: { avgMargin: 0.4, avgSpp: 0.2 },
  аксессуары: { avgMargin: 0.45, avgSpp: 0.22 },

  // Electronics
  электроника: { avgMargin: 0.15, avgSpp: 0.1 },
  смартфоны: { avgMargin: 0.12, avgSpp: 0.08 },
  компьютеры: { avgMargin: 0.1, avgSpp: 0.08 },

  // Home & Garden
  дом: { avgMargin: 0.3, avgSpp: 0.18 },
  мебель: { avgMargin: 0.35, avgSpp: 0.15 },
  сад: { avgMargin: 0.4, avgSpp: 0.12 },

  // Beauty & Health
  красота: { avgMargin: 0.5, avgSpp: 0.25 },
  косметика: { avgMargin: 0.55, avgSpp: 0.28 },
  здоровье: { avgMargin: 0.45, avgSpp: 0.2 },

  // Food & Groceries
  продукты: { avgMargin: 0.2, avgSpp: 0.1 },

  // Kids & Toys
  детские: { avgMargin: 0.4, avgSpp: 0.22 },
  игрушки: { avgMargin: 0.45, avgSpp: 0.25 },

  // Default for unknown categories
  default: { avgMargin: 0.3, avgSpp: 0.2 },
};

/**
 * Marketplace-specific discount configurations
 */
const MARKETPLACE_DISCOUNTS = {
  WB: {
    walletCashback: 0.03, // WB Pay cashback
    avgPlatformDiscount: 0.2, // Average WB discount
    safetyBuffer: 0.05, // Extra safety margin
  },
  Ozon: {
    cardDiscount: 0.05, // Ozon Card discount
    cardAdoptionRate: 0.4, // 40% of buyers use Ozon Card
    avgPlatformDiscount: 0.22, // Average Ozon discount
    safetyBuffer: 0.05, // Extra safety margin
  },
};

/**
 * SmartDefaultsService — calculates optimal protection settings
 *
 * Uses heuristics based on:
 * 1. Current price
 * 2. Category margins (if known)
 * 3. Marketplace-specific discounts
 * 4. Cost price (if provided)
 */
class SmartDefaultsService {
  /**
   * Calculate smart defaults for a single product
   */
  calculateDefaults(product: ProductForDefaults): SmartDefaults {
    const { currentPrice, marketplace, category, costPrice } = product;

    // 1. Get category profile
    const categoryProfile = this.getCategoryProfile(product.title, category);

    // 2. Get marketplace discount config
    const mpConfig = MARKETPLACE_DISCOUNTS[marketplace];

    // 3. Calculate minimum price based on available data
    let minPrice: number;
    let confidence: number;
    let reasoning: string;

    if (costPrice && costPrice > 0) {
      // Best case: we know the cost price
      // min_price = costPrice + minimum margin (15%)
      const minMargin = 0.15;
      minPrice = Math.ceil(costPrice * (1 + minMargin));
      confidence = 0.95;
      reasoning = `Расчёт на основе себестоимости ${costPrice}₽ + минимальная маржа 15%`;
    } else {
      // Fallback: estimate based on category margin
      const estimatedMargin = categoryProfile.avgMargin;
      const estimatedCost = currentPrice * (1 - estimatedMargin);
      const minMargin = 0.1; // Lower min margin for estimated cost
      minPrice = Math.ceil(estimatedCost * (1 + minMargin));
      confidence = 0.7;
      reasoning = `Оценка на основе средней маржи категории (${Math.round(estimatedMargin * 100)}%)`;
    }

    // 4. Ensure min_price is not too close to current price
    // At least 20% below current price for safety
    const maxMinPrice = Math.floor(currentPrice * 0.8);
    if (minPrice > maxMinPrice) {
      minPrice = maxMinPrice;
      confidence = Math.min(confidence, 0.6);
      reasoning += '. Скорректировано для безопасного буфера (20% от текущей цены)';
    }

    // 5. Calculate SPP buffer
    const sppBufferPercent = Math.round(
      (mpConfig.avgPlatformDiscount + mpConfig.safetyBuffer) * 100
    );

    // 6. Determine protection mode
    // zero_stock is safer for high-margin products
    // price_correction is better for low-margin high-volume products
    const protectionMode = categoryProfile.avgMargin > 0.25 ? 'zero_stock' : 'price_correction';

    logger.info('Smart defaults calculated', {
      productId: product.productId,
      currentPrice,
      minPrice,
      sppBufferPercent,
      confidence: Math.round(confidence * 100),
    });

    return {
      minPrice,
      sppBufferPercent,
      protectionMode,
      confidence,
      reasoning,
    };
  }

  /**
   * Calculate smart defaults for multiple products
   */
  calculateBatch(products: ProductForDefaults[]): Map<string, SmartDefaults> {
    const results = new Map<string, SmartDefaults>();

    for (const product of products) {
      try {
        const defaults = this.calculateDefaults(product);
        results.set(product.productId, defaults);
      } catch (error) {
        logger.error('Failed to calculate defaults for product', {
          productId: product.productId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Provide safe fallback
        results.set(product.productId, {
          minPrice: Math.floor(product.currentPrice * 0.7),
          sppBufferPercent: 25,
          protectionMode: 'zero_stock',
          confidence: 0.3,
          reasoning: 'Безопасные дефолтные значения (ошибка расчёта)',
        });
      }
    }

    return results;
  }

  /**
   * Get category profile by matching title/category to known profiles
   */
  private getCategoryProfile(
    title?: string,
    category?: string
  ): { avgMargin: number; avgSpp: number } {
    const searchText = `${title || ''} ${category || ''}`.toLowerCase();

    for (const [key, profile] of Object.entries(CATEGORY_MARGINS)) {
      if (key === 'default') continue;
      if (searchText.includes(key)) {
        return profile;
      }
    }

    return CATEGORY_MARGINS['default'];
  }

  /**
   * Estimate minimum viable price based on marketplace fees
   * This is a safety floor that ensures seller doesn't lose money
   */
  estimateBreakEvenPrice(product: ProductForDefaults): number {
    const { currentPrice, marketplace } = product;

    // Marketplace commission estimates
    const commissionRates = {
      WB: 0.15, // Average WB commission
      Ozon: 0.18, // Average Ozon commission
    };

    const commission = commissionRates[marketplace];

    // If we have cost price, calculate exact break-even
    if (product.costPrice && product.costPrice > 0) {
      // break-even = cost / (1 - commission)
      return Math.ceil(product.costPrice / (1 - commission));
    }

    // Otherwise, estimate based on typical margins
    const typicalMargin = 0.25;
    const estimatedCost = currentPrice * (1 - typicalMargin);
    return Math.ceil(estimatedCost / (1 - commission));
  }

  /**
   * Get summary statistics for smart defaults calculation
   */
  summarize(defaults: Map<string, SmartDefaults>): {
    totalProducts: number;
    avgConfidence: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  } {
    const values = Array.from(defaults.values());
    const totalProducts = values.length;

    const avgConfidence =
      totalProducts > 0 ? values.reduce((sum, d) => sum + d.confidence, 0) / totalProducts : 0;

    const highConfidence = values.filter(d => d.confidence >= 0.8).length;
    const mediumConfidence = values.filter(d => d.confidence >= 0.5 && d.confidence < 0.8).length;
    const lowConfidence = values.filter(d => d.confidence < 0.5).length;

    return {
      totalProducts,
      avgConfidence: Math.round(avgConfidence * 100),
      highConfidence,
      mediumConfidence,
      lowConfidence,
    };
  }
}

export const smartDefaultsService = new SmartDefaultsService();

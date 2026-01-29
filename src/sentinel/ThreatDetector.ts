import type { DBUser, DBProduct } from '../api-lib/lib/types.js';
import { calculateUnitEconomics, estimateCostPrice } from '../api-lib/services/unit-economics.js';
import { advancedThreatDetector } from './AdvancedThreatDetector.js';
import { threatHistoryService } from '../api-lib/services/validation-log.service.js';

export const ThreatType = {
  OZON_CARD_EROSION: 'ozon_card_erosion',
  COMMISSION_INCREASE: 'commission_increase',
  COMPETITOR_PRICE_DROP: 'competitor_price_drop',
  DB_PRICE_MISMATCH: 'db_price_mismatch',
  MARGIN_BELOW_ZERO: 'margin_below_zero',
  FLASH_CRASH: 'flash_crash',
  PRICE_DUMP: 'price_dump',
  // NEW: Buyer price (with all discounts/promos) is below stop-loss
  BUYER_PRICE_BELOW_STOPLOSS: 'buyer_price_below_stoploss',
  // NEW: Product was added to a promo/sale that drops buyer price
  PROMO_PRICE_VIOLATION: 'promo_price_violation',
} as const;

export type ThreatType = (typeof ThreatType)[keyof typeof ThreatType];

export interface Threat {
  type: ThreatType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  productId: string;
  nmId?: string | null; // Changed from number to string after ID migration
  message: string;
  data: unknown;
}

export interface ScanResult {
  hasThreats: boolean;
  threats: Threat[];
  isSafeToAutoUpdate: boolean;
}

export class ThreatDetector {
  /**
   * Analyze products for threats using provided prices
   */
  async analyze(
    _user: DBUser,
    products: DBProduct[],
    priceMap: Map<number, number>,
    marketplace: 'WB' | 'Ozon'
  ): Promise<Threat[]> {
    const threats: Threat[] = [];

    for (const product of products) {
      const key =
        marketplace === 'WB'
          ? Number(product.nm_id)
          : parseInt(product.product_id.replace('ozon-', ''));

      if (key) {
        const livePrice = priceMap.get(key);
        if (livePrice !== undefined) {
          const result = this.scanProductThreats(product, livePrice, marketplace);
          threats.push(...result.threats);
        }
      }
    }
    return threats;
  }

  /**
   * Log threats to history database (non-blocking)
   */
  async logThreatsToHistory(
    userId: string,
    threats: Threat[],
    marketplace: 'WB' | 'Ozon'
  ): Promise<void> {
    for (const threat of threats) {
      threatHistoryService
        .logThreat({
          userId,
          productId: threat.productId,
          nmId: threat.nmId,
          marketplace,
          threat,
          actionTaken: 'pending',
        })
        .catch(() => {
          /* Ignore logging errors */
        });
    }
  }

  /**
   * Scan a single product for threats
   */
  public scanProductThreats(
    product: DBProduct,
    livePrice: number,
    marketplace: 'WB' | 'Ozon'
  ): ScanResult {
    const threats: Threat[] = [];

    // 0. Advanced ML-Lite Analysis (Phase 2)
    // Construct minimal history from DB state to detect immediate changes vs last sync
    if (product.current_price && product.updated_at) {
      const dbPricePoint = {
        price: product.current_price,
        timestamp:
          typeof product.updated_at === 'string'
            ? new Date(product.updated_at)
            : product.updated_at,
      };

      const advancedResult = advancedThreatDetector.detectAdvancedThreats(
        product,
        livePrice,
        [dbPricePoint] // Use DB state as "history"
      );

      if (advancedResult.isThreat) {
        threats.push({
          type:
            advancedResult.threatType === 'flash_crash'
              ? ThreatType.FLASH_CRASH
              : ThreatType.PRICE_DUMP,
          severity: advancedResult.confidence === 'high' ? 'critical' : 'high',
          productId: product.product_id,
          nmId: product.nm_id,
          message: advancedResult.reasoning.join('. '),
          data: advancedResult,
        });
      }
    }

    // 1. DB Price Mismatch
    if (product.current_price && Math.abs(product.current_price - livePrice) / livePrice > 0.1) {
      threats.push({
        type: ThreatType.DB_PRICE_MISMATCH,
        severity: 'medium',
        productId: product.product_id,
        nmId: product.nm_id,
        message: `Цена в БД (${product.current_price}₽) сильно отличается от цены на сайте (${livePrice}₽).`,
        data: { dbPrice: product.current_price, livePrice },
      });
    }

    // 2. Financial Scan (Unit Economics)
    let analyzedCostPrice: number = product.cost_price || 0;
    let isEstimated = false;

    if (!analyzedCostPrice || analyzedCostPrice <= 0) {
      const estimate = estimateCostPrice(livePrice, product.category || undefined);
      analyzedCostPrice = estimate.costPrice;
      isEstimated = true;
    }

    const economics = calculateUnitEconomics({
      price: product.estimated_buyer_price || livePrice, // Use Buyer Price for financial analysis if available
      costPrice: analyzedCostPrice,
      category: product.category || 'Other',
      marketplace,
      useOzonCard: true,
      minProfit: product.min_margin || 0, // Target min profit (RUB)
    });

    if (!isEstimated) {
      for (const warning of economics.warnings) {
        let threatType: ThreatType = ThreatType.MARGIN_BELOW_ZERO;
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

        if (warning.code === 'NEGATIVE_PROFIT') {
          threatType = ThreatType.MARGIN_BELOW_ZERO;
          severity = 'critical';
        } else if (warning.code === 'OZON_CARD_IMPACT') {
          threatType = ThreatType.OZON_CARD_EROSION;
          severity = 'high';
        }

        threats.push({
          type: threatType,
          severity,
          productId: product.product_id,
          nmId: product.nm_id,
          message: warning.message,
          data: { ...economics, warningDetails: warning, minPrice: product.min_price || 0 },
        });
      }
    } else if (economics.profit < (product.min_margin || 0)) {
      threats.push({
        type: ThreatType.MARGIN_BELOW_ZERO,
        severity: economics.profit < 0 ? 'high' : 'medium',
        productId: product.product_id,
        nmId: product.nm_id,
        message:
          economics.profit < 0
            ? `Убыток (${economics.profit}₽) — проверьте себестоимость!`
            : `Маржа ниже установленного минимума (${economics.profit}₽ < ${product.min_margin}₽)`,
        data: { ...economics, minPrice: product.min_price || 0 },
      });
    }

    if (!isEstimated && economics.profit > 0 && economics.margin < 3) {
      threats.push({
        type: ThreatType.MARGIN_BELOW_ZERO,
        severity: 'high',
        productId: product.product_id,
        nmId: product.nm_id,
        message: `Критически низкая маржинальность (${economics.margin}%) — продажа почти в ноль или убыток по налогам.`,
        data: economics,
      });
    }

    // 3. Stop-Loss Check (API Price)
    const minPriceToCheck = product.min_price || 0;
    const bufferPercent = product.card_discount_buffer || 0;
    const effectiveMinPrice = Math.round(minPriceToCheck * (1 + bufferPercent / 100));

    if (minPriceToCheck > 0 && livePrice < effectiveMinPrice) {
      threats.push({
        type: ThreatType.COMPETITOR_PRICE_DROP,
        severity: 'critical',
        productId: product.product_id,
        nmId: product.nm_id,
        message: `Цена товара (${livePrice}₽) упала ниже Stop-Loss ${bufferPercent > 0 ? `с буфером (${effectiveMinPrice}₽)` : `(${minPriceToCheck}₽)`}.`,
        data: { livePrice, minPrice: minPriceToCheck, effectiveMinPrice, bufferPercent },
      });
    }

    // 4. CRITICAL: Real Buyer Price Check (what customer actually pays)
    // This catches promos, WB Wallet, Ozon Card discounts that the seller doesn't control
    const realBuyerPrice = product.estimated_buyer_price;
    if (realBuyerPrice && realBuyerPrice > 0 && minPriceToCheck > 0) {
      // Check if buyer price is below stop-loss
      if (realBuyerPrice < minPriceToCheck) {
        const discount = Math.round(((livePrice - realBuyerPrice) / livePrice) * 100);
        const isPromoActive = discount > 5; // More than 5% discount = likely promo

        threats.push({
          type: isPromoActive
            ? ThreatType.PROMO_PRICE_VIOLATION
            : ThreatType.BUYER_PRICE_BELOW_STOPLOSS,
          severity: 'critical',
          productId: product.product_id,
          nmId: product.nm_id,
          message: isPromoActive
            ? `🚨 АКЦИЯ! Покупатель видит ${realBuyerPrice}₽ (скидка ${discount}%), ваш стоп-лосс: ${minPriceToCheck}₽`
            : `⚠️ Цена для покупателя (${realBuyerPrice}₽) ниже стоп-лосса (${minPriceToCheck}₽)`,
          data: {
            sellerPrice: livePrice,
            buyerPrice: realBuyerPrice,
            minPrice: minPriceToCheck,
            discountPercent: discount,
            isPromoActive,
            ...economics, // Include full financial context (profit, margin) for the alert template
          },
        });
      }
    }

    return {
      hasThreats: threats.length > 0,
      threats,
      isSafeToAutoUpdate:
        !threats.some(t => t.severity === 'critical') ||
        threats.some(t => t.type === ThreatType.COMPETITOR_PRICE_DROP),
    };
  }
}

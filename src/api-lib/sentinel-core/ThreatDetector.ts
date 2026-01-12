import type { DBUser, DBProduct } from '../lib/types.js';
import { calculateUnitEconomics, estimateCostPrice } from '../services/unit-economics.js';

export const ThreatType = {
  OZON_CARD_EROSION: 'ozon_card_erosion',
  COMMISSION_INCREASE: 'commission_increase',
  COMPETITOR_PRICE_DROP: 'competitor_price_drop',
  DB_PRICE_MISMATCH: 'db_price_mismatch',
  MARGIN_BELOW_ZERO: 'margin_below_zero',
} as const;

export type ThreatType = (typeof ThreatType)[keyof typeof ThreatType];

export interface Threat {
  type: ThreatType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  productId: string;
  nmId?: number | null;
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
   * Scan a single product for threats
   */
  public scanProductThreats(
    product: DBProduct,
    livePrice: number,
    marketplace: 'WB' | 'Ozon'
  ): ScanResult {
    const threats: Threat[] = [];

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
      price: livePrice,
      costPrice: analyzedCostPrice,
      category: product.category || 'Other',
      marketplace,
      useOzonCard: true,
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
          data: { ...economics, warningDetails: warning },
        });
      }
    } else if (economics.profit < 0) {
      threats.push({
        type: ThreatType.MARGIN_BELOW_ZERO,
        severity: 'high',
        productId: product.product_id,
        nmId: product.nm_id,
        message: `Потенциальный убыток (${economics.profit}₽) — проверьте себестоимость!`,
        data: economics,
      });
    }

    if (!isEstimated && economics.profit > 0 && economics.margin < 10) {
      threats.push({
        type: ThreatType.MARGIN_BELOW_ZERO,
        severity: 'high',
        productId: product.product_id,
        nmId: product.nm_id,
        message: `Низкая маржинальность (${economics.margin}%)`,
        data: economics,
      });
    }

    // 3. Stop-Loss Check
    const minPriceToCheck = product.min_price || 0;
    const bufferPercent = product.card_discount_buffer || 0;
    const effectiveMinPrice = Math.round(minPriceToCheck * (1 + bufferPercent / 100));

    if (minPriceToCheck > 0 && livePrice < effectiveMinPrice) {
      threats.push({
        type: ThreatType.COMPETITOR_PRICE_DROP,
        severity: 'critical',
        productId: product.product_id,
        nmId: product.nm_id,
        message: `Цена (${livePrice}₽) упала ниже Stop-Loss ${bufferPercent > 0 ? `с учетом буфера (${effectiveMinPrice}₽)` : `(${minPriceToCheck}₽)`}.`,
        data: { livePrice, minPrice: minPriceToCheck, effectiveMinPrice, bufferPercent },
      });
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

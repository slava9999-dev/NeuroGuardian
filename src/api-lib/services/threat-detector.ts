// ============================================
// NeuroGUARDIAN — Threat Detector Service
// Scans marketplace products for financial threats
// Version: 2.1.0 | Date: December 2024
// ============================================

import { calculateUnitEconomics, estimateCostPrice } from './unit-economics.js';
import type { DBProduct } from '../lib/types.js';

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

/**
 * Scan a single product for threats
 */
export function scanProductThreats(
  product: DBProduct, // strictly typed
  livePrice: number,
  marketplace: 'WB' | 'Ozon'
): ScanResult {
  const threats: Threat[] = [];

  // 1. DB Price Mismatch (Price in DB older than 1 hour or significantly different)
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
    // NOTE: This is NOT a threat, just an informational flag.
    // Don't spam users with "укажите себестоимость" messages.
    // The isEstimated flag is used in subsequent calculations.
  }

  // NOTE: Missing min_price is a configuration issue, not a threat.
  // Don't spam users with setup reminders every 30 minutes.
  // They'll see this in the dashboard/product list.

  const economics = calculateUnitEconomics({
    price: livePrice,
    costPrice: analyzedCostPrice,
    category: product.category || 'Other',
    marketplace,
    useOzonCard: true,
  });

  // Map Economics Warnings to Threats
  // BUT: Skip if cost_price is estimated - these warnings are meaningless noise
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
    // NEW (Jan 2026): Alert even on ESTIMATED costs if it's a loss
    // But mark it as 'high' instead of 'critical' to reflect estimation uncertainty
    threats.push({
      type: ThreatType.MARGIN_BELOW_ZERO,
      severity: 'high',
      productId: product.product_id,
      nmId: product.nm_id,
      message: `Потенциальный убыток (${economics.profit}₽) — проверьте себестоимость!`,
      data: economics,
    });
  }

  // Skip low-margin warnings on ESTIMATED costs - they're just noise
  // Only alert if we have REAL cost_price set by user
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

  // 3. Stop-Loss check (integrated with Sentinel but detected here as threat)
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

/**
 * Scan all products for threats
 */
export async function scanAllThreats(
  products: DBProduct[], // strictly typed
  priceMap: Map<string | number, number>,
  marketplace: 'WB' | 'Ozon'
): Promise<Threat[]> {
  const allThreats: Threat[] = [];

  for (const product of products) {
    const key =
      marketplace === 'WB' ? product.nm_id : parseInt(product.product_id.replace('ozon-', ''));

    if (key) {
      const livePrice = priceMap.get(key);

      if (livePrice !== undefined) {
        const result = scanProductThreats(product, livePrice, marketplace);
        allThreats.push(...result.threats);
      }
    }
  }

  return allThreats;
}

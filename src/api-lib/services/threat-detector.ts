// ============================================
// NeuroGUARDIAN — Threat Detector Service
// Scans marketplace products for financial threats
// Version: 2.0.0 | Date: December 2024
// ============================================

import { calculateUnitEconomics } from './unit-economics.js';

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
  nmId?: number;
  message: string;
  data: any;
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
  product: any, // db product
  livePrice: number,
  marketplace: 'WB' | 'Ozon'
): ScanResult {
  const threats: Threat[] = [];
  const minPrice = product.min_price || 0;

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
  if (product.cost_price > 0) {
    const economics = calculateUnitEconomics({
      price: livePrice,
      costPrice: product.cost_price,
      category: product.category,
      marketplace,
      useOzonCard: true, // Always account for this as it's the most common erosion
    });

    if (economics.profit <= 0) {
      threats.push({
        type: ThreatType.MARGIN_BELOW_ZERO,
        severity: 'critical',
        productId: product.product_id,
        nmId: product.nm_id,
        message: `Товар в убытке! Прибыль: ${economics.profit}₽, Маржа: ${economics.margin}%`,
        data: economics,
      });
    } else if (economics.margin < 10) {
      threats.push({
        type: ThreatType.MARGIN_BELOW_ZERO,
        severity: 'high',
        productId: product.product_id,
        nmId: product.nm_id,
        message: `Низкая маржинальность (${economics.margin}%).`,
        data: economics,
      });
    }

    // Ozon Card specific threat
    if (marketplace === 'Ozon' && economics.ozonCardCosts > 0) {
      // If profit is thin, Ozon Card might be the reason for erosion
      if (economics.profit < economics.ozonCardCosts) {
        threats.push({
          type: ThreatType.OZON_CARD_EROSION,
          severity: 'high',
          productId: product.product_id,
          message: `Скидка по Ozon Card (${economics.ozonCardCosts}₽) съедает всю прибыль.`,
          data: { ozonCardCosts: economics.ozonCardCosts, profit: economics.profit },
        });
      }
    }
  }

  // 3. Stop-Loss check (integrated with Sentinel but detected here as threat)
  // Support effectiveMinPrice using card_discount_buffer (from tests/TZ logic)
  const bufferPercent = product.card_discount_buffer || 0;
  const effectiveMinPrice = Math.round(minPrice * (1 + bufferPercent / 100));

  if (minPrice > 0 && livePrice < effectiveMinPrice) {
    threats.push({
      type: ThreatType.COMPETITOR_PRICE_DROP, // usually caused by competitor matching or promo
      severity: 'critical',
      productId: product.product_id,
      nmId: product.nm_id,
      message: `Цена (${livePrice}₽) упала ниже Stop-Loss ${bufferPercent > 0 ? `с учетом буфера (${effectiveMinPrice}₽)` : `(${minPrice}₽)`}.`,
      data: { livePrice, minPrice, effectiveMinPrice, bufferPercent },
    });
  }

  return {
    hasThreats: threats.length > 0,
    threats,
    isSafeToAutoUpdate:
      !threats.some(t => t.severity === 'critical') ||
      threats.some(t => t.type === ThreatType.COMPETITOR_PRICE_DROP),
    // Auto-update is only safe if it's a stop-loss trigger or low severity items
  };
}

/**
 * Scan all products for threats
 */
export async function scanAllThreats(
  products: any[],
  priceMap: Map<string | number, number>,
  marketplace: 'WB' | 'Ozon'
): Promise<Threat[]> {
  const allThreats: Threat[] = [];

  for (const product of products) {
    const key =
      marketplace === 'WB' ? product.nm_id : parseInt(product.product_id.replace('ozon-', ''));
    const livePrice = priceMap.get(key);

    if (livePrice !== undefined) {
      const result = scanProductThreats(product, livePrice, marketplace);
      allThreats.push(...result.threats);
    }
  }

  return allThreats;
}

// ============================================
// NeuroGUARDIAN — Threat Detector Service
// Scans marketplace products for financial threats
// Version: 2.1.0 | Date: December 2024
// ============================================

import { calculateUnitEconomics } from './unit-economics.js';
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
  // Fix: DBProduct doesn't technically have cost_price in the Interface I saw in types.ts?
  // Let me check types.ts again. I don't recall seeing cost_price in DBProduct.
  // If strict typing fails because of missing fields, I need to update DBProduct or use intersection.
  // Assuming strict DBProduct for now. If cost_price is missing, TS will error and I will fix types.ts.

  // Wait, I strictly viewed types.ts. DBProduct did NOT have cost_price.
  // It matches `products` table. Does `products` table have `cost_price`?
  // The `scanProductThreats` previously accessed `product.cost_price`.
  // I must check if `products` table has `cost_price`.
  // If it does, I must update types.ts.

  // Implicitly assuming ANY was hiding that property existence.
  // Let's assume for a moment it might not exist on DBProduct interface yet.
  // I will check for cost_price existence safely or extend interface.

  // Re-reading types.ts content I saved...
  // export interface DBProduct { ... id, user_id, product_id, nm_id, offer_id, title, image_url, current_price, min_price, current_stock, marketplace, status, is_monitored, card_discount_buffer, pending_..., created_at, updated_at }
  // created_at, updated_at are Date.
  // cost_price IS MISSING.

  // So I need to update types.ts first if I want to use it here.
  // OR cast to `DBProduct & { cost_price?: number, category?: string }`.
  // `product.category` is also accessed.

  if (product.cost_price && product.cost_price > 0) {
    const economics = calculateUnitEconomics({
      price: livePrice,
      costPrice: product.cost_price,
      category: product.category || 'Other', // default category
      marketplace,
      useOzonCard: true,
    });

    // Map Economics Warnings to Threats
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

    // Additional low-margin check (if not already negative)
    if (economics.profit > 0 && economics.margin < 10) {
      threats.push({
        type: ThreatType.MARGIN_BELOW_ZERO,
        severity: 'high',
        productId: product.product_id,
        nmId: product.nm_id,
        message: `Низкая маржинальность (${economics.margin}%).`,
        data: economics,
      });
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

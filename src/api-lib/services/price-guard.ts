// ============================================
// NeuroGUARDIAN — Price Guard Service
// Safety limits and validation for price adjustments
// Version: 1.0.0 | Date: December 2024
// ============================================

export interface PriceSecurityCheck {
  productId: string;
  nmId?: number;
  currentPrice: number;
  proposedPrice: number;
  minPrice?: number;
  marketplace: 'WB' | 'Ozon';
}

export interface PriceSecurityResult {
  allowed: boolean;
  safePrice: number;
  reason?: string;
  isAdjusted: boolean;
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Safety limits for price changes
 */
const LIMITS = {
  MAX_SINGLE_DECREASE_PERCENT: 0.3, // 30% max drop in one go
  MAX_SINGLE_INCREASE_PERCENT: 1.0, // 100% max increase in one go
  ABSOLUTE_MIN_PRICE: 100, // Never below 100 RUB for most items
};

/**
 * Validate price update against security policies
 */
export function validatePriceUpdate(check: PriceSecurityCheck): PriceSecurityResult {
  const { currentPrice, proposedPrice, minPrice, marketplace } = check;

  // 1. Mandatory check against stop-loss (minPrice)
  if (minPrice && minPrice > 0 && proposedPrice < minPrice) {
    return {
      allowed: true, // We allow but cap it at minPrice
      safePrice: minPrice,
      reason: `Цена ${proposedPrice} ₽ ниже установленного Stop-Loss (${minPrice} ₽) для ${marketplace}. Ограничено по лимиту защиты.`,
      isAdjusted: true,
      severity: 'warning',
    };
  }

  // 2. Anomaly Check: Extreme Decrease
  const decreasePercent = currentPrice > 0 ? (currentPrice - proposedPrice) / currentPrice : 0;
  if (decreasePercent > LIMITS.MAX_SINGLE_DECREASE_PERCENT) {
    const safeDrop = Math.round(currentPrice * (1 - LIMITS.MAX_SINGLE_DECREASE_PERCENT));
    return {
      allowed: true,
      safePrice: Math.max(safeDrop, minPrice || 0),
      reason: `Слишком резкое снижение цены на ${Math.round(decreasePercent * 100)}%. Ограничено до -${LIMITS.MAX_SINGLE_DECREASE_PERCENT * 100}% для безопасности.`,
      isAdjusted: true,
      severity: 'critical',
    };
  }

  // 3. Anomaly Check: Extreme Increase
  const increasePercent = currentPrice > 0 ? (proposedPrice - currentPrice) / currentPrice : 0;
  if (increasePercent > LIMITS.MAX_SINGLE_INCREASE_PERCENT) {
    const safeIncr = Math.round(currentPrice * (1 + LIMITS.MAX_SINGLE_INCREASE_PERCENT));
    return {
      allowed: true,
      safePrice: safeIncr,
      reason: `Слишком резкое повышение цены на ${Math.round(increasePercent * 100)}%. Ограничено до +${LIMITS.MAX_SINGLE_INCREASE_PERCENT * 100}% для безопасности.`,
      isAdjusted: true,
      severity: 'critical',
    };
  }

  // 4. Absolute Minimum
  if (proposedPrice < LIMITS.ABSOLUTE_MIN_PRICE) {
    return {
      allowed: true,
      safePrice: LIMITS.ABSOLUTE_MIN_PRICE,
      reason: `Цена ${proposedPrice} ₽ ниже системного минимума (${LIMITS.ABSOLUTE_MIN_PRICE} ₽).`,
      isAdjusted: true,
      severity: 'warning',
    };
  }

  // Everything OK
  return {
    allowed: true,
    safePrice: proposedPrice,
    isAdjusted: false,
    severity: 'info',
  };
}

/**
 * Batch version of validation
 */
export function validatePriceUpdates(updates: PriceSecurityCheck[]): {
  validated: PriceSecurityCheck[];
  adjustments: string[];
} {
  const validated: PriceSecurityCheck[] = [];
  const adjustments: string[] = [];

  for (const update of updates) {
    const result = validatePriceUpdate(update);
    validated.push({
      ...update,
      proposedPrice: result.safePrice,
    });

    if (result.isAdjusted) {
      adjustments.push(`${update.nmId || update.productId}: ${result.reason}`);
    }
  }

  return { validated, adjustments };
}

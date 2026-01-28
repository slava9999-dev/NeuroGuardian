// ============================================
// NeuroGUARDIAN — Price Guard Service
// Safety limits and validation for price adjustments
// Version: 2.0.0 | Date: December 2024
// TZ v2.0 Production Compliant
// ============================================

import { sql } from './database.js';

export interface PriceSecurityCheck {
  productId: string;
  nmId?: number;
  userId: number;
  currentPrice: number;
  proposedPrice: number;
  minPrice?: number;
  costPrice?: number;
  marketplace: 'WB' | 'Ozon';
}

export interface PriceSecurityResult {
  allowed: boolean;
  safePrice: number;
  reason?: string;
  isAdjusted: boolean;
  severity: 'info' | 'warning' | 'critical' | 'blocked';
  action: 'apply' | 'adjust' | 'block' | 'dry-run';
}

export interface KillSwitchStatus {
  global: boolean;
  user: boolean;
  marketplace: boolean;
  product: boolean;
  reason?: string;
}

/**
 * Safety limits for price changes per TZ v2.0 Section 7.2
 */
const LIMITS = {
  // Per-cycle limits
  MAX_SINGLE_DECREASE_PERCENT: 0.1, // 10% max drop per cycle
  MAX_SINGLE_INCREASE_PERCENT: 0.15, // 15% max increase per cycle

  // Daily limits (accumulated)
  MAX_DAILY_DECREASE_PERCENT: 0.2, // 20% max total drop per day
  MAX_DAILY_INCREASE_PERCENT: 0.3, // 30% max total increase per day
  MAX_DAILY_CHANGES_PER_PRODUCT: 5, // Max 5 changes per product per day

  // Absolute limits
  ABSOLUTE_MIN_PRICE: 50, // Never below 50 RUB
  MIN_MARGIN_PERCENT: 0, // Never go negative margin

  // Anomaly detection
  ANOMALY_DETECTION_THRESHOLD: 0.25, // 25% sudden change = possible API error

  // Marketplace standard discounts for safety calculation
  ESTIMATED_MAX_WB_SPP: 35, // Assume WB can take up to 35% as SPP
  ESTIMATED_OZON_CARD_DISCOUNT: 10, // Assume Ozon Card is ~10%
};

/**
 * Check if kill switch is active for user/marketplace/product
 */
export async function checkKillSwitch(
  userId: number,
  _marketplace?: string,
  productId?: string
): Promise<KillSwitchStatus> {
  const status: KillSwitchStatus = {
    global: false,
    user: false,
    marketplace: false,
    product: false,
  };

  try {
    // Check user-level kill switch
    const userResult = await sql`
      SELECT protection_enabled, defense_mode 
      FROM users WHERE id = ${userId}
    `;

    if (userResult.rows[0]) {
      const user = userResult.rows[0];
      if (!user.protection_enabled) {
        status.user = true;
        status.reason = 'Защита отключена пользователем';
      }
      if (user.defense_mode === 'disabled' || user.defense_mode === 'notify_only') {
        status.user = true;
        status.reason = `Режим защиты: ${user.defense_mode}`;
      }
    }

    // Check product-level kill switch
    if (productId) {
      const productResult = await sql`
        SELECT is_monitored, status 
        FROM products 
        WHERE user_id = ${userId} AND product_id = ${productId}
      `;

      if (productResult.rows[0]) {
        const product = productResult.rows[0];
        if (!product.is_monitored || product.status === 'paused') {
          status.product = true;
          status.reason = 'Товар исключен из мониторинга';
        }
      }
    }
  } catch (error) {
    console.error('Kill switch check error:', error);
  }

  return status;
}

/**
 * Check daily change limits for a product
 */
export async function checkDailyLimits(
  userId: number,
  productId: string
): Promise<{
  allowed: boolean;
  changesCount: number;
  totalChangePercent: number;
  reason?: string;
}> {
  try {
    const result = await sql`
      SELECT 
        COUNT(*) as changes_count,
        SUM(
          CASE 
            WHEN detected_price > 0 AND new_price IS NOT NULL 
            THEN ABS(new_price - detected_price) / detected_price 
            ELSE 0 
          END
        ) as total_change_percent
      FROM sentinel_logs
      WHERE user_id = ${userId}
        AND product_id = ${productId}
        AND created_at > NOW() - INTERVAL '24 hours'
        AND defense_action IN ('price_fix', 'price_correction')
    `;

    const row = result.rows[0];
    const changesCount = parseInt(row?.changes_count || '0');
    const totalChangePercent = parseFloat(row?.total_change_percent || '0');

    if (changesCount >= LIMITS.MAX_DAILY_CHANGES_PER_PRODUCT) {
      return {
        allowed: false,
        changesCount,
        totalChangePercent,
        reason: `Достигнут дневной лимит изменений (${LIMITS.MAX_DAILY_CHANGES_PER_PRODUCT} раз)`,
      };
    }

    if (totalChangePercent > LIMITS.MAX_DAILY_DECREASE_PERCENT) {
      return {
        allowed: false,
        changesCount,
        totalChangePercent,
        reason: `Достигнут дневной лимит изменения цены (${Math.round(LIMITS.MAX_DAILY_DECREASE_PERCENT * 100)}%)`,
      };
    }

    return { allowed: true, changesCount, totalChangePercent };
  } catch (error) {
    console.error('Daily limits check error:', error);
    // Fail-safe: allow if check fails
    return { allowed: true, changesCount: 0, totalChangePercent: 0 };
  }
}

/**
 * Check if user should use dry-run mode (first-time protection)
 */
export async function shouldUseDryRun(userId: number): Promise<boolean> {
  try {
    // Check if user has completed at least 2 monitoring cycles
    const result = await sql`
      SELECT COUNT(DISTINCT DATE_TRUNC('hour', created_at)) as cycles
      FROM sentinel_logs
      WHERE user_id = ${userId}
        AND created_at > NOW() - INTERVAL '7 days'
    `;

    const cycles = parseInt(result.rows[0]?.cycles || '0');

    // First 2 cycles = dry-run mode
    return cycles < 2;
  } catch (error) {
    console.error('Dry-run check error:', error);
    return true; // Default to dry-run on error
  }
}

/**
 * Detect anomalies that might indicate API errors
 */
function detectAnomaly(check: PriceSecurityCheck): {
  isAnomaly: boolean;
  reason?: string;
} {
  const { currentPrice, proposedPrice, costPrice } = check;

  // Sudden extreme change
  const changePercent = Math.abs(proposedPrice - currentPrice) / currentPrice;
  if (currentPrice > 0 && changePercent > LIMITS.ANOMALY_DETECTION_THRESHOLD) {
    return {
      isAnomaly: true,
      reason: `Аномальное изменение цены на ${Math.round(changePercent * 100)}% - возможная ошибка API`,
    };
  }

  // Price below cost (should never happen automatically)
  if (costPrice && proposedPrice < costPrice) {
    return {
      isAnomaly: true,
      reason: `Цена ${proposedPrice}₽ ниже себестоимости ${costPrice}₽`,
    };
  }

  // Zero or negative price
  if (proposedPrice <= 0) {
    return {
      isAnomaly: true,
      reason: 'Некорректная цена: ноль или отрицательное значение',
    };
  }

  return { isAnomaly: false };
}

/**
 * Validate price update against all security policies
 * TZ v2.0 Section 7.2 compliant
 */
export async function validatePriceUpdate(
  check: PriceSecurityCheck,
  options?: { forceDryRun?: boolean }
): Promise<PriceSecurityResult> {
  const { userId, productId, currentPrice, proposedPrice, minPrice, marketplace } = check;

  // Calculate ESTIMATED buyer price (what the client actually sees)
  // Logic: RealPrice = PortalPrice * (1 - KnownSPP)
  let estimatedBuyerPrice = proposedPrice;
  let discountFactor = 0.7; // Default for WB

  if (marketplace === 'WB') {
    try {
      const prodIdStr = String(productId);
      const res = await sql`
        SELECT spp_buffer_percent FROM products 
        WHERE user_id = ${userId} AND (product_id = ${prodIdStr} OR nm_id = ${check.nmId || 0})
        LIMIT 1
      `;
      if (res.rows[0] && res.rows[0].spp_buffer_percent) {
        discountFactor = (100 - res.rows[0].spp_buffer_percent) / 100;
      }
    } catch (e) {
      // Fallback to default block if DB fetch fails
    }
    estimatedBuyerPrice = Math.round(proposedPrice * discountFactor);
  } else {
    discountFactor = 0.9; // Default for Ozon
    estimatedBuyerPrice = Math.round(proposedPrice * discountFactor);
  }

  // 1. Kill switch check
  const killSwitch = await checkKillSwitch(userId, marketplace, productId);
  if (killSwitch.user || killSwitch.product || killSwitch.global) {
    return {
      allowed: false,
      safePrice: currentPrice,
      reason: killSwitch.reason || 'Kill switch активен',
      isAdjusted: false,
      severity: 'blocked',
      action: 'block',
    };
  }

  // 2. Anomaly detection
  const anomaly = detectAnomaly(check);
  if (anomaly.isAnomaly) {
    return {
      allowed: false,
      safePrice: currentPrice,
      reason: anomaly.reason,
      isAdjusted: false,
      severity: 'critical',
      action: 'block',
    };
  }

  // 3. Dry-run mode for new users
  const isDryRun = options?.forceDryRun || (await shouldUseDryRun(userId));
  if (isDryRun) {
    return {
      allowed: false,
      safePrice: proposedPrice,
      reason: 'Режим тестирования: изменения только логируются (первые 2 цикла)',
      isAdjusted: false,
      severity: 'info',
      action: 'dry-run',
    };
  }

  // 4. Daily limits check
  const dailyLimits = await checkDailyLimits(userId, productId);
  if (!dailyLimits.allowed) {
    return {
      allowed: false,
      safePrice: currentPrice,
      reason: dailyLimits.reason,
      isAdjusted: false,
      severity: 'warning',
      action: 'block',
    };
  }

  // 5. Stop-Loss Check (REAL PRICE AWARENESS)
  if (minPrice && minPrice > 0 && estimatedBuyerPrice < minPrice) {
    // Determine what portal price is needed to keep buyer price >= minPrice
    const requiredPortalPrice = Math.ceil(minPrice / discountFactor);

    return {
      allowed: true,
      safePrice: requiredPortalPrice,
      reason: `RECOVERY: Ваша цена ${proposedPrice}₽ приведет к цене покупателя ~${estimatedBuyerPrice}₽ (с учетом СПП ${Math.round((1 - discountFactor) * 100)}%), что ниже Stop-Loss ${minPrice}₽. Минимально допустимая цена в портале для безопасности: ${requiredPortalPrice}₽.`,
      isAdjusted: true,
      severity: 'critical',
      action: 'adjust',
    };
  }

  // 6. Per-cycle decrease limit
  const decreasePercent = currentPrice > 0 ? (currentPrice - proposedPrice) / currentPrice : 0;
  if (decreasePercent > LIMITS.MAX_SINGLE_DECREASE_PERCENT) {
    const safeDrop = Math.round(currentPrice * (1 - LIMITS.MAX_SINGLE_DECREASE_PERCENT));
    return {
      allowed: true,
      safePrice: Math.max(safeDrop, minPrice || LIMITS.ABSOLUTE_MIN_PRICE),
      reason: `Снижение ${Math.round(decreasePercent * 100)}% превышает лимит ${LIMITS.MAX_SINGLE_DECREASE_PERCENT * 100}% за цикл`,
      isAdjusted: true,
      severity: 'critical',
      action: 'adjust',
    };
  }

  // 7. Per-cycle increase limit
  const increasePercent = currentPrice > 0 ? (proposedPrice - currentPrice) / currentPrice : 0;
  if (increasePercent > LIMITS.MAX_SINGLE_INCREASE_PERCENT) {
    const safeIncr = Math.round(currentPrice * (1 + LIMITS.MAX_SINGLE_INCREASE_PERCENT));
    return {
      allowed: true,
      safePrice: safeIncr,
      reason: `Повышение ${Math.round(increasePercent * 100)}% превышает лимит ${LIMITS.MAX_SINGLE_INCREASE_PERCENT * 100}% за цикл`,
      isAdjusted: true,
      severity: 'warning',
      action: 'adjust',
    };
  }

  // 8. Absolute minimum
  if (proposedPrice < LIMITS.ABSOLUTE_MIN_PRICE) {
    return {
      allowed: true,
      safePrice: LIMITS.ABSOLUTE_MIN_PRICE,
      reason: `Цена ${proposedPrice}₽ ниже системного минимума (${LIMITS.ABSOLUTE_MIN_PRICE}₽)`,
      isAdjusted: true,
      severity: 'warning',
      action: 'adjust',
    };
  }

  // All checks passed
  return {
    allowed: true,
    safePrice: proposedPrice,
    isAdjusted: false,
    severity: 'info',
    action: 'apply',
  };
}

/**
 * Synchronous version for backward compatibility
 */
export function validatePriceUpdateSync(check: PriceSecurityCheck): PriceSecurityResult {
  const { currentPrice, proposedPrice, minPrice } = check;

  // Stop-loss check
  if (minPrice && minPrice > 0 && proposedPrice < minPrice) {
    return {
      allowed: true,
      safePrice: minPrice,
      reason: `Цена ниже Stop-Loss. Ограничено до ${minPrice}₽`,
      isAdjusted: true,
      severity: 'warning',
      action: 'adjust',
    };
  }

  // Per-cycle limits
  const decreasePercent = currentPrice > 0 ? (currentPrice - proposedPrice) / currentPrice : 0;
  if (decreasePercent > LIMITS.MAX_SINGLE_DECREASE_PERCENT) {
    const safeDrop = Math.round(currentPrice * (1 - LIMITS.MAX_SINGLE_DECREASE_PERCENT));
    return {
      allowed: true,
      safePrice: Math.max(safeDrop, minPrice || LIMITS.ABSOLUTE_MIN_PRICE),
      reason: `Снижение ограничено до ${LIMITS.MAX_SINGLE_DECREASE_PERCENT * 100}%`,
      isAdjusted: true,
      severity: 'critical',
      action: 'adjust',
    };
  }

  const increasePercent = currentPrice > 0 ? (proposedPrice - currentPrice) / currentPrice : 0;
  if (increasePercent > LIMITS.MAX_SINGLE_INCREASE_PERCENT) {
    const safeIncr = Math.round(currentPrice * (1 + LIMITS.MAX_SINGLE_INCREASE_PERCENT));
    return {
      allowed: true,
      safePrice: safeIncr,
      reason: `Повышение ограничено до ${LIMITS.MAX_SINGLE_INCREASE_PERCENT * 100}%`,
      isAdjusted: true,
      severity: 'warning',
      action: 'adjust',
    };
  }

  if (proposedPrice < LIMITS.ABSOLUTE_MIN_PRICE) {
    return {
      allowed: true,
      safePrice: LIMITS.ABSOLUTE_MIN_PRICE,
      reason: `Цена ниже минимума ${LIMITS.ABSOLUTE_MIN_PRICE}₽`,
      isAdjusted: true,
      severity: 'warning',
      action: 'adjust',
    };
  }

  return {
    allowed: true,
    safePrice: proposedPrice,
    isAdjusted: false,
    severity: 'info',
    action: 'apply',
  };
}

/**
 * Batch validation with summary
 */
export async function validatePriceUpdates(updates: PriceSecurityCheck[]): Promise<{
  validated: Array<PriceSecurityCheck & { result: PriceSecurityResult }>;
  summary: {
    total: number;
    allowed: number;
    adjusted: number;
    blocked: number;
    dryRun: number;
  };
  adjustments: string[];
}> {
  const validated: Array<PriceSecurityCheck & { result: PriceSecurityResult }> = [];
  const adjustments: string[] = [];
  const summary = { total: 0, allowed: 0, adjusted: 0, blocked: 0, dryRun: 0 };

  for (const update of updates) {
    const result = await validatePriceUpdate(update);
    validated.push({ ...update, proposedPrice: result.safePrice, result });

    summary.total++;

    if (result.action === 'apply') {
      summary.allowed++;
    } else if (result.action === 'adjust') {
      summary.adjusted++;
      adjustments.push(`${update.productId}: ${result.reason}`);
    } else if (result.action === 'block') {
      summary.blocked++;
      adjustments.push(`❌ ${update.productId}: ${result.reason}`);
    } else if (result.action === 'dry-run') {
      summary.dryRun++;
    }
  }

  return { validated, summary, adjustments };
}

/**
 * Get current limits (for display in UI)
 */
export function getLimits() {
  return { ...LIMITS };
}

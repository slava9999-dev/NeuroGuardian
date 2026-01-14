// ============================================
// NeuroGUARDIAN — Price Protection Agent
// Automated price monitoring and protection
// ============================================

import { sql } from '../services/database.js';
import {
  fetchWbProducts,
  fetchWbPrices,
  fetchOzonProducts,
  fetchOzonCurrentPrices,
  updateWbPrices,
  updateOzonPrices,
  getMarketplaceKeys,
  type MarketplaceProduct,
} from '../services/marketplace-bridge.js';
import { logOpsEvent, logPriceChange } from '../services/ops-logger.js';

// ============================================
// TYPES
// ============================================

export interface PriceRule {
  id: number;
  productId: string;
  userId: number;
  minPrice: number;
  maxPrice: number;
  costPrice: number | null;
  targetMargin: number;
  minMargin: number;
  competitorTracking: boolean;
  autoAdjust: boolean;
  autoProtect: boolean;
  notificationEnabled: boolean;
  alertThresholdPercent: number;
  active: boolean;
}

export interface PriceAnalysis {
  product: MarketplaceProduct;
  currentPrice: number;
  recommendedPrice: number;
  reason: string;
  action: 'none' | 'increase' | 'decrease' | 'alert';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  rule: PriceRule | null;
}

export interface ProtectionResult {
  analyzed: number;
  updated: number;
  alerts: number;
  errors: number;
  details: Array<{
    productId: string;
    productName: string;
    action: string;
    oldPrice: number;
    newPrice?: number;
    reason: string;
    success: boolean;
    error?: string;
  }>;
  durationMs: number;
}

// ============================================
// PRICE RULES MANAGEMENT
// ============================================

/**
 * Load price rules from database
 */
export async function loadPriceRules(userId?: number): Promise<Map<string, PriceRule>> {
  const rules = new Map<string, PriceRule>();

  try {
    // Use sql template literal with conditional
    const result = userId
      ? await sql`SELECT * FROM price_rules WHERE active = true AND user_id = ${userId}`
      : await sql`SELECT * FROM price_rules WHERE active = true`;

    for (const row of result.rows) {
      rules.set(row.product_id, {
        id: row.id,
        productId: row.product_id,
        userId: row.user_id,
        minPrice: parseFloat(row.min_price),
        maxPrice: parseFloat(row.max_price),
        costPrice: row.cost_price ? parseFloat(row.cost_price) : null,
        targetMargin: parseFloat(row.target_margin),
        minMargin: parseFloat(row.min_margin || '10'),
        competitorTracking: row.competitor_tracking,
        autoAdjust: row.auto_adjust,
        autoProtect: row.auto_protect,
        notificationEnabled: row.notification_enabled,
        alertThresholdPercent: parseFloat(row.alert_threshold_percent || '10'),
        active: row.active,
      });
    }
  } catch (error) {
    console.error('Failed to load price rules:', error);
    // Return empty map - table might not exist yet
  }

  return rules;
}

/**
 * Create or update a price rule
 */
export async function upsertPriceRule(
  productId: string,
  userId: number,
  rule: Partial<PriceRule>
): Promise<boolean> {
  try {
    const minPrice = rule.minPrice ?? 0;
    const maxPrice = rule.maxPrice ?? 0;
    const costPrice = rule.costPrice ?? null;
    const targetMargin = rule.targetMargin ?? 20;
    const minMarginVal = rule.minMargin ?? 10;
    const competitorTracking = rule.competitorTracking ?? false;
    const autoAdjust = rule.autoAdjust ?? false;
    const autoProtect = rule.autoProtect ?? true;
    const notificationEnabled = rule.notificationEnabled ?? true;
    const alertThresholdPercent = rule.alertThresholdPercent ?? 10;
    const active = rule.active ?? true;

    await sql`
      INSERT INTO price_rules (
        product_id, user_id, min_price, max_price, cost_price,
        target_margin, min_margin, competitor_tracking,
        auto_adjust, auto_protect, notification_enabled,
        alert_threshold_percent, active
      ) VALUES (
        ${productId}, ${userId}, ${minPrice}, ${maxPrice}, ${costPrice},
        ${targetMargin}, ${minMarginVal}, ${competitorTracking},
        ${autoAdjust}, ${autoProtect}, ${notificationEnabled},
        ${alertThresholdPercent}, ${active}
      )
      ON CONFLICT (product_id) DO UPDATE SET
        min_price = EXCLUDED.min_price,
        max_price = EXCLUDED.max_price,
        cost_price = COALESCE(EXCLUDED.cost_price, price_rules.cost_price),
        target_margin = EXCLUDED.target_margin,
        min_margin = EXCLUDED.min_margin,
        competitor_tracking = EXCLUDED.competitor_tracking,
        auto_adjust = EXCLUDED.auto_adjust,
        auto_protect = EXCLUDED.auto_protect,
        notification_enabled = EXCLUDED.notification_enabled,
        alert_threshold_percent = EXCLUDED.alert_threshold_percent,
        active = EXCLUDED.active,
        updated_at = NOW()
    `;
    return true;
  } catch (error) {
    console.error('Failed to upsert price rule:', error);
    return false;
  }
}

// ============================================
// PRICE ANALYSIS
// ============================================

/**
 * Analyze a product against its price rule
 */
function analyzeProduct(product: MarketplaceProduct, rule: PriceRule | null): PriceAnalysis {
  const analysis: PriceAnalysis = {
    product,
    currentPrice: product.current_price,
    recommendedPrice: product.current_price,
    reason: '',
    action: 'none',
    urgency: 'low',
    rule,
  };

  if (!rule) {
    return analysis; // No rule - no action needed
  }

  // Check 1: Price below minimum (CRITICAL)
  if (product.current_price < rule.minPrice) {
    analysis.recommendedPrice = rule.minPrice;
    analysis.reason = `Цена ${product.current_price}₽ ниже минимума ${rule.minPrice}₽`;
    analysis.action = 'increase';
    analysis.urgency = 'critical';
    return analysis;
  }

  // Check 2: Price above maximum (HIGH)
  if (product.current_price > rule.maxPrice) {
    analysis.recommendedPrice = rule.maxPrice;
    analysis.reason = `Цена ${product.current_price}₽ выше максимума ${rule.maxPrice}₽`;
    analysis.action = 'decrease';
    analysis.urgency = 'high';
    return analysis;
  }

  // Check 3: Margin below target (if cost price is known)
  if (rule.costPrice && rule.costPrice > 0) {
    const currentMargin = ((product.current_price - rule.costPrice) / product.current_price) * 100;

    if (currentMargin < rule.minMargin) {
      // Critical - below minimum margin
      const targetPrice = rule.costPrice / (1 - rule.targetMargin / 100);
      analysis.recommendedPrice = Math.min(Math.ceil(targetPrice), rule.maxPrice);
      analysis.reason = `Маржа ${currentMargin.toFixed(1)}% ниже минимума ${rule.minMargin}%`;
      analysis.action = 'increase';
      analysis.urgency = 'critical';
      return analysis;
    }

    if (currentMargin < rule.targetMargin * 0.8) {
      // High - significantly below target
      const targetPrice = rule.costPrice / (1 - rule.targetMargin / 100);
      analysis.recommendedPrice = Math.min(Math.ceil(targetPrice), rule.maxPrice);
      analysis.reason = `Маржа ${currentMargin.toFixed(1)}% ниже целевой ${rule.targetMargin}%`;
      analysis.action = 'increase';
      analysis.urgency = 'high';
      return analysis;
    }
  }

  return analysis;
}

// ============================================
// PRICE PROTECTION EXECUTION
// ============================================

/**
 * Main price protection function
 * Analyzes all products and takes protective actions
 */
export async function runPriceProtection(userId: number): Promise<ProtectionResult> {
  const startTime = Date.now();
  const result: ProtectionResult = {
    analyzed: 0,
    updated: 0,
    alerts: 0,
    errors: 0,
    details: [],
    durationMs: 0,
  };

  try {
    // Load rules
    const rules = await loadPriceRules(userId);
    if (rules.size === 0) {
      console.log('No price rules configured for user', userId);
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Get marketplace keys
    const keys = await getMarketplaceKeys(userId);

    // Fetch products from both marketplaces
    const products: MarketplaceProduct[] = [];

    if (keys.wb) {
      try {
        const wbProducts = await fetchWbProducts(keys.wb);
        products.push(...wbProducts);
      } catch (error) {
        console.error('Failed to fetch WB products:', error);
        result.errors++;
      }
    }

    if (keys.ozon?.clientId && keys.ozon?.apiKey) {
      try {
        const ozonProducts = await fetchOzonProducts(keys.ozon.clientId, keys.ozon.apiKey);
        products.push(...ozonProducts);
      } catch (error) {
        console.error('Failed to fetch Ozon products:', error);
        result.errors++;
      }
    }

    // Analyze each product
    const analyses: PriceAnalysis[] = [];
    for (const product of products) {
      const productKey = `${product.marketplace.toLowerCase()}_${product.nm_id || product.product_id}`;
      const rule = rules.get(productKey);

      const analysis = analyzeProduct(product, rule ?? null);
      result.analyzed++;

      if (analysis.action !== 'none') {
        analyses.push(analysis);
      }
    }

    // Sort by urgency (critical first)
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    analyses.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    // Execute actions
    for (const analysis of analyses) {
      const { product, rule, action, recommendedPrice, reason } = analysis;

      if (!rule) continue;

      const detail = {
        productId: `${product.marketplace.toLowerCase()}_${product.nm_id || product.product_id}`,
        productName: product.title,
        action: action,
        oldPrice: product.current_price,
        newPrice: recommendedPrice,
        reason,
        success: false,
        error: undefined as string | undefined,
      };

      // Auto-adjust if enabled
      if (rule.autoAdjust && (action === 'increase' || action === 'decrease')) {
        try {
          let success = false;

          if (product.marketplace === 'WB' && keys.wb && product.nm_id) {
            const updateResult = await updateWbPrices(keys.wb, [
              { nmId: product.nm_id, price: recommendedPrice },
            ]);
            success = updateResult.success;
            if (!success) detail.error = updateResult.error;
          } else if (product.marketplace === 'Ozon' && keys.ozon?.clientId && keys.ozon?.apiKey) {
            const productId = parseInt(product.product_id);
            const updateResult = await updateOzonPrices(keys.ozon.clientId, keys.ozon.apiKey, [
              { productId, price: recommendedPrice },
            ]);
            success = updateResult.success;
            if (!success) detail.error = updateResult.error;
          }

          if (success) {
            result.updated++;
            detail.success = true;

            // Log the price change
            await logPriceChange({
              actorType: 'agent',
              actorId: 'price_protection',
              productId: detail.productId,
              marketplace: product.marketplace.toLowerCase() as 'wildberries' | 'ozon',
              oldPrice: product.current_price,
              newPrice: recommendedPrice,
              reason,
            });
          } else {
            result.errors++;
          }
        } catch (error) {
          result.errors++;
          detail.error = error instanceof Error ? error.message : 'Unknown error';
          console.error('Price update failed:', error);
        }
      } else {
        // Just log alert
        result.alerts++;
        detail.success = true;
        detail.action = 'alert';

        await logOpsEvent({
          eventType: 'price_alert',
          eventSource: 'price_protection',
          userId,
          oldPrice: product.current_price,
          newPrice: recommendedPrice,
          marketplace: product.marketplace.toLowerCase() as 'wildberries' | 'ozon',
          externalId: String(product.nm_id || product.product_id),
          actionTaken: 'alert_sent',
          payload: { reason, urgency: analysis.urgency },
        });
      }

      result.details.push(detail);
    }
  } catch (error) {
    console.error('Price protection run failed:', error);
    result.errors++;
  }

  result.durationMs = Date.now() - startTime;

  // Log the run
  await logOpsEvent({
    eventType: 'price_protection_run',
    eventSource: 'price_protection',
    userId,
    payload: {
      analyzed: result.analyzed,
      updated: result.updated,
      alerts: result.alerts,
      errors: result.errors,
      durationMs: result.durationMs,
    },
  });

  return result;
}

/**
 * Quick check for a single product against its rule
 */
export async function checkProductPrice(
  userId: number,
  productId: string
): Promise<PriceAnalysis | null> {
  const rules = await loadPriceRules(userId);
  const rule = rules.get(productId);

  if (!rule) {
    return null;
  }

  // Parse product ID to get marketplace and external ID
  const [marketplace, externalId] = productId.split('_');

  const keys = await getMarketplaceKeys(userId);
  let currentPrice = 0;

  try {
    if (marketplace === 'wb' && keys.wb) {
      const pricesResult = await fetchWbPrices(keys.wb, [parseInt(externalId)]);
      currentPrice = pricesResult.priceMap.get(parseInt(externalId)) || 0;
    } else if (marketplace === 'ozon' && keys.ozon?.clientId && keys.ozon?.apiKey) {
      const prices = await fetchOzonCurrentPrices(keys.ozon.clientId, keys.ozon.apiKey, [
        parseInt(externalId),
      ]);
      currentPrice = prices.get(parseInt(externalId)) || 0;
    }
  } catch (error) {
    console.error('Failed to fetch current price:', error);
    return null;
  }

  const proxyProduct: MarketplaceProduct = {
    product_id: externalId,
    nm_id: marketplace === 'wb' ? parseInt(externalId) : undefined,
    title: 'Product ' + externalId, // Placeholder title as we don't have full data here
    image_url: null,
    current_price: currentPrice,
    current_stock: 0,
    marketplace: marketplace === 'wb' ? 'WB' : 'Ozon',
  };

  return analyzeProduct(proxyProduct, rule);
}

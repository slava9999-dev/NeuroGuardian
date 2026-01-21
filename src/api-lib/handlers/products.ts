// ============================================
// NeuroGUARDIAN — Products Handler
// Product management and sync
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../services/database.js';

// Import from modular library
import { sanitizeInput, isSubscriptionActive, getProductLimit } from '../lib/index.js';
import {
  getUserById,
  getProductsByUserId,
  updateProductMinPrice,
  updateProductCostPrice,
} from '../services/index.js';
import type { DBProduct } from '../lib/types.js';
import { mediaQueue } from '../../vision/index.js';

// fetchWithRetry moved to api-lib/lib/index.js

/**
 * Handle products action (GET and POST)
 */
export async function handleProducts(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  console.log(`🔍 [handleProducts] userId=${userId}, method=${req.method}`);
  if (req.method === 'GET') {
    const products = await getProductsByUserId(userId);

    const rows = products as unknown as DBProduct[];
    const formatted = rows.map(p => ({
      id: p.product_id,
      productId: p.product_id,
      nmId: p.nm_id,
      vendorCode: p.official_sku || p.product_id,
      title: sanitizeInput(String(p.title || '')),
      imageUrl: p.image_url,
      currentPrice: Number(p.current_price || 0),
      estimatedBuyerPrice: Number(p.estimated_buyer_price || p.current_price || 0),
      marketplaceDiscountPercent: Number(p.marketplace_discount_percent || 0),
      minPrice: Number(p.min_price || 0),
      stock: Number(p.current_stock || 0),
      marketplace: p.marketplace,
      status: p.status,
      isMonitored: p.is_monitored,
    }));

    return res.json({ products: formatted, total: formatted.length });
  }

  // POST: Update product prices (min price or cost price)
  const { productId, minPrice, costPrice } = req.body || {};

  if (!productId || (minPrice === undefined && costPrice === undefined)) {
    return res.status(400).json({
      error: 'Invalid parameters',
      received: { productId, minPrice, costPrice },
    });
  }

  try {
    // SECURITY: Verify product ownership before update (IDOR protection)
    const ownershipCheck = await sql`
      SELECT id FROM products WHERE user_id = ${userId} AND product_id = ${productId}
    `;

    if (ownershipCheck.rows.length === 0) {
      console.warn(`⚠️ IDOR attempt blocked: user=${userId} tried to update product=${productId}`);
      return res.status(403).json({ error: 'Product not found or access denied' });
    }

    const updates: string[] = [];
    const promises: Promise<void>[] = [];

    if (minPrice !== undefined) {
      promises.push(updateProductMinPrice(userId, productId, minPrice));
      updates.push(`minPrice=${minPrice}`);
    }

    if (costPrice !== undefined) {
      promises.push(updateProductCostPrice(userId, productId, costPrice));
      updates.push(`costPrice=${costPrice}`);
    }

    await Promise.all(promises);

    console.log(
      `✅ Product updated (Modular): user=${userId}, product=${productId}, updates=[${updates.join(', ')}]`
    );
    return res.json({ success: true, productId, minPrice, costPrice });
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({ error: 'Failed to update product' });
  }
}

import { marketplaceService } from '../core-services/MarketplaceService.js';
import { productRepository } from '../repositories/ProductRepository.js';
import { smartDefaultsService } from '../core-services/SmartDefaultsService.js';

/**
 * Handle sync-products action — fetch products from WB/Ozon APIs
 *
 * Phase 1 Enhancement: Auto-calculates min_price (smart defaults) for all products
 * This reduces Setup Cost from 3,000₽ → 0₽
 */
export async function handleSyncProducts(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  const { marketplace, enableSmartDefaults = true } = req.body || {};
  const mp = (marketplace || 'Ozon') as 'WB' | 'Ozon';

  // Get user's subscription status
  const user = await getUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Check if user has active subscription
  if (!isSubscriptionActive(user)) {
    return res.status(403).json({
      error: 'Для синхронизации товаров требуется активная подписка',
      code: 'SUBSCRIPTION_REQUIRED',
    });
  }

  const productLimit = getProductLimit(user.subscription_plan);

  // Import locally to avoid circular dependency issues if any
  const { getMarketplaceAccounts } = await import('../services/users.js');
  const accounts = await getMarketplaceAccounts(userId);

  // Filter active accounts for the requested marketplace
  const activeAccounts = accounts.filter(
    a => a.is_active && a.marketplace.toLowerCase() === mp.toLowerCase()
  );

  console.log(
    `DEBUG: handleSyncProducts userId=${userId} mp=${mp} accounts=${accounts.length} active=${activeAccounts.length} smartDefaults=${enableSmartDefaults}`
  );

  let totalSaved = 0;
  let smartDefaultsApplied = 0;
  const summary: string[] = [];
  let limitReached = false;

  try {
    if (activeAccounts.length > 0) {
      // Multi-account sync
      for (const account of activeAccounts) {
        try {
          const products = await marketplaceService.fetchProducts(userId, mp, 100, account.id);

          // Assign account_id and filter by limit
          const productsToSave = products.map(p => ({
            ...p,
            account_id: account.id,
          }));

          const limitedProducts = productsToSave.slice(0, productLimit);
          if (productsToSave.length > productLimit) limitReached = true;

          if (limitedProducts.length > 0) {
            // Phase 1: Calculate smart defaults for each product
            let smartDefaults: Map<
              string,
              ReturnType<typeof smartDefaultsService.calculateDefaults>
            > | null = null;

            if (enableSmartDefaults) {
              const productsForDefaults = limitedProducts.map(p => ({
                productId: p.product_id,
                currentPrice: p.current_price,
                marketplace: p.marketplace,
                title: p.title,
                category: undefined,
                currentStock: p.current_stock,
                costPrice: null,
              }));
              smartDefaults = smartDefaultsService.calculateBatch(productsForDefaults);
            }

            // Map to DBProduct shape with smart defaults
            const dbProducts = limitedProducts.map(p => {
              const defaults = smartDefaults?.get(p.product_id);
              return {
                user_id: String(userId),
                product_id: p.product_id,
                nm_id: p.nm_id || null,
                title: p.title,
                image_url: p.image_url,
                current_price: p.current_price,
                estimated_buyer_price: p.current_price,
                current_stock: p.current_stock,
                marketplace: p.marketplace,
                account_id: account.id,
                // Smart Defaults: Auto-calculated min_price
                min_price: defaults?.minPrice || 0,
                spp_buffer_percent: defaults?.sppBufferPercent || 25,
                auto_adjust_min_price: true, // Enable auto-adjust by default
                is_monitored: true, // Enable monitoring by default
                status: defaults?.minPrice ? 'protected' : 'active',
              };
            });

            await productRepository.saveBatch(userId, dbProducts);

            // Auto-Ingest Media (Fire-and-forget-ish, but await safely)
            if (enableSmartDefaults) {
              const ingestPromises = dbProducts
                .filter(p => p.image_url)
                .map(p =>
                  mediaQueue
                    .enqueue('ingest_marketplace_image', p.image_url!, {
                      userId,
                      productId: p.product_id,
                      metadata: { userId, productId: p.product_id },
                    })
                    .catch(err =>
                      console.error(`Failed to enqueue media ingest for ${p.product_id}`, err)
                    )
                );

              await Promise.all(ingestPromises);
            }

            totalSaved += limitedProducts.length;
            smartDefaultsApplied += dbProducts.filter(p => p.min_price > 0).length;
            summary.push(`${account.name}: ${limitedProducts.length}`);

            // TRIGGER ONBOARDING ANALYSIS (Sales Hook)
            await mediaQueue
              .enqueue('onboarding_analysis', account.marketplace, {
                userId,
                metadata: { userId },
              })
              .catch(e => console.error('Failed to trigger onboarding analysis', e));
          }
        } catch (e) {
          console.error(`Error syncing account ${account.name}:`, e);
        }
      }
    } else {
      // Legacy sync
      try {
        const products = await marketplaceService.fetchProducts(userId, mp, 100);

        const productsToSave = products.map(p => ({
          ...p,
          account_id: undefined,
        }));

        const limitedProducts = productsToSave.slice(0, productLimit);
        if (productsToSave.length > productLimit) limitReached = true;

        if (limitedProducts.length > 0) {
          // Phase 1: Calculate smart defaults for each product
          let smartDefaults: Map<
            string,
            ReturnType<typeof smartDefaultsService.calculateDefaults>
          > | null = null;

          if (enableSmartDefaults) {
            const productsForDefaults = limitedProducts.map(p => ({
              productId: p.product_id,
              currentPrice: p.current_price,
              marketplace: p.marketplace,
              title: p.title,
              category: undefined,
              currentStock: p.current_stock,
              costPrice: null,
            }));
            smartDefaults = smartDefaultsService.calculateBatch(productsForDefaults);
          }

          const dbProducts = limitedProducts.map(p => {
            const defaults = smartDefaults?.get(p.product_id);
            return {
              user_id: String(userId),
              product_id: p.product_id,
              nm_id: p.nm_id || null,
              title: p.title,
              image_url: p.image_url,
              current_price: p.current_price,
              estimated_buyer_price: p.current_price,
              current_stock: p.current_stock,
              marketplace: p.marketplace,
              // Smart Defaults: Auto-calculated min_price
              min_price: defaults?.minPrice || 0,
              spp_buffer_percent: defaults?.sppBufferPercent || 25,
              auto_adjust_min_price: true,
              is_monitored: true,
              status: defaults?.minPrice ? 'protected' : 'active',
            };
          });

          await productRepository.saveBatch(userId, dbProducts);

          // Auto-Ingest Media (Legacy Branch)
          if (enableSmartDefaults) {
            const ingestPromises = dbProducts
              .filter(p => p.image_url)
              .map(p =>
                mediaQueue
                  .enqueue('ingest_marketplace_image', p.image_url!, {
                    userId,
                    productId: p.product_id,
                    metadata: { userId, productId: p.product_id },
                  })

                  .catch(err =>
                    console.error(`Failed to enqueue media ingest for ${p.product_id}`, err)
                  )
              );

            await Promise.all(ingestPromises);
          }

          totalSaved += limitedProducts.length;
          smartDefaultsApplied += dbProducts.filter(p => p.min_price > 0).length;
          summary.push(`Основной: ${limitedProducts.length}`);

          // TRIGGER ONBOARDING ANALYSIS (Sales Hook)
          await mediaQueue
            .enqueue('onboarding_analysis', mp, {
              userId,
              metadata: { userId },
            })
            .catch(e => console.error('Failed to trigger onboarding analysis (legacy)', e));
        }
      } catch (e) {
        // If legacy sync fails, it might be due to missing keys, which is expected for new users
        console.warn('Legacy sync failed (expected if only accounts used):', e);
      }
    }

    // Update user total and enable protection by default
    await sql`
      UPDATE users SET 
        total_products = (SELECT COUNT(*) FROM products WHERE user_id = ${userId}),
        protection_enabled = true,
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = ${userId}
    `;

    console.log(
      `✅ Sync complete: userId=${userId}, saved=${totalSaved}, smartDefaults=${smartDefaultsApplied}`
    );

    return res.json({
      success: true,
      message: `Синхронизировано ${totalSaved} товаров из ${mp} (${summary.join(', ')})`,
      count: totalSaved,
      marketplace: mp,
      smartDefaultsApplied,
      protectionEnabled: true,
      warning: limitReached
        ? `Достигнут лимит тарифа. Всего сохранено товаров: ${totalSaved}`
        : undefined,
    });
  } catch (error) {
    console.error('Sync products error:', error);
    return res.status(500).json({ error: 'Internal sync error' });
  }
}

/**
 * Handle batch-set-stop-loss action
 */
export async function handleBatchSetStopLoss(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  const { percentage, productIds } = req.body || {};

  // Validate percentage (5-50% as per index.ts logic)
  if (typeof percentage !== 'number' || percentage < 5 || percentage > 50) {
    return res.status(400).json({
      error: 'Invalid percentage',
      message: 'Percentage must be between 5 and 50',
      received: percentage,
    });
  }

  // Validate productIds array (optional - if not provided, update all products without stop-loss)
  let targetProductIds: string[] = [];
  if (Array.isArray(productIds) && productIds.length > 0) {
    if (productIds.length > 100) {
      return res.status(400).json({
        error: 'Batch too large',
        message: 'Max 100 products per request',
      });
    }
    targetProductIds = productIds.map(String);
  }

  try {
    let productsToUpdate;

    if (targetProductIds.length > 0) {
      // Update specific products
      const allProducts = await sql`
        SELECT product_id, current_price FROM products 
        WHERE user_id = ${userId}
      `;
      productsToUpdate = {
        rows: allProducts.rows.filter(p => targetProductIds.includes(p.product_id)),
      };
    } else {
      // Update all products WITHOUT stop-loss (fail-safe logic from index.ts)
      productsToUpdate = await sql`
        SELECT product_id, current_price FROM products 
        WHERE user_id = ${userId} 
        AND (min_price = 0 OR min_price IS NULL)
      `;
    }

    let successCount = 0;
    let failedCount = 0;

    for (const product of productsToUpdate.rows) {
      try {
        const currentPrice = Number(product.current_price || 0);
        if (currentPrice > 0) {
          const newMinPrice = Math.floor(currentPrice * (1 - percentage / 100));

          await sql`
            UPDATE products SET 
              min_price = ${newMinPrice},
              status = 'protected',
              updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ${userId} AND product_id = ${product.product_id}
          `;

          successCount++;
        }
      } catch (e) {
        console.error(`Failed to update product ${product.product_id}:`, e);
        failedCount++;
      }
    }

    console.log(
      `✅ Bulk Stop-Loss (Modular): user=${userId}, percentage=${percentage}%, updated=${successCount}, failed=${failedCount}`
    );

    return res.json({
      success: true,
      updated: successCount,
      failed: failedCount,
      percentage,
      message: `Stop-Loss установлен для ${successCount} товаров на -${percentage}% от текущей цены`,
    });
  } catch (error) {
    console.error('Batch stop-loss error:', error);
    return res.status(500).json({
      error: 'Failed to set bulk stop-loss',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle apply-min-prices action
 * Applies min_price to WB/Ozon for all products that have min_price set
 * This is used to fix prices on marketplaces after bugs
 */
/**
 * Handle apply-min-prices action
 * Applies min_price to WB/Ozon for all products that have min_price set
 * This is used to fix prices on marketplaces after bugs
 */
export async function handleApplyMinPrices(
  _req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  console.log(`🔧 Apply min_prices to marketplace for user ${userId}`);

  try {
    // Get products with min_price set, including account_id
    const productsRes = await sql`
      SELECT product_id, title, nm_id, min_price, marketplace, offer_id, account_id
      FROM products
      WHERE user_id = ${userId}
      AND min_price > 0
    `;

    const products = productsRes.rows;

    if (products.length === 0) {
      return res.json({
        success: true,
        message: 'Нет товаров с установленным min_price',
        updated: 0,
      });
    }

    let totalUpdated = 0;
    const errors: string[] = [];

    // Group by marketplace and account_id
    // Key: "MARKETPLACE:ACCOUNT_ID" (account_id can be 'null')
    const grouped = new Map<string, typeof products>();

    for (const p of products) {
      const key = `${p.marketplace}:${p.account_id || 'legacy'}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(p);
    }

    for (const [key, groupProducts] of grouped.entries()) {
      const [mp, accIdStr] = key.split(':');
      const marketplace = mp as 'WB' | 'Ozon';
      const accountId = accIdStr === 'legacy' ? undefined : Number(accIdStr);

      try {
        const updates = groupProducts
          .map(p => ({
            id: marketplace === 'WB' ? p.nm_id : parseInt(p.product_id.replace('ozon-', '')),
            price: p.min_price,
          }))
          .filter(u => u.id); // Ensure valid IDs

        if (updates.length > 0) {
          const result = await marketplaceService.updatePrices(
            userId,
            marketplace,
            updates,
            accountId
          );
          if (result.success) {
            totalUpdated += result.count;
            console.log(`✅ ${marketplace} (acc=${accountId}): Updated ${result.count} prices`);
          } else {
            errors.push(`${marketplace} (acc=${accountId}): ${result.error}`);
          }
        }
      } catch (e) {
        errors.push(
          `${marketplace} (acc=${accountId}): ${e instanceof Error ? e.message : 'Unknown error'}`
        );
      }
    }

    // Update current_price in DB to min_price
    await sql`
      UPDATE products
      SET current_price = min_price, updated_at = NOW()
      WHERE user_id = ${userId}
      AND min_price > 0
    `;

    return res.json({
      success: errors.length === 0,
      message: `Цены применены. Обновлено: ${totalUpdated}`,
      updated: totalUpdated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Apply min_prices error:', error);
    return res.status(500).json({
      error: 'Failed to apply min_prices',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle batch-update-costs action
 * Allows mass updating of cost_price for unit economics
 */
export async function handleBatchUpdateCosts(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  const { updates } = req.body || {};

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      error: 'Invalid updates format',
      message: 'Expected array of { productId, costPrice }',
    });
  }

  // Limit batch size to prevent timeouts
  if (updates.length > 100) {
    return res.status(400).json({
      error: 'Batch too large',
      message: 'Max 100 items per request',
    });
  }

  try {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // 1. Get all user products to verify ownership efficiently
    const ownershipCheck = await sql`
      SELECT product_id FROM products WHERE user_id = ${userId}
    `;
    const userProductIds = new Set(ownershipCheck.rows.map(r => r.product_id));

    // 2. Process updates
    interface UpdateItem {
      productId?: string;
      barcode?: string;
      costPrice: number;
      minMargin?: number;
    }

    const updatePromises = (updates as UpdateItem[]).map(async item => {
      const { productId, barcode, costPrice, minMargin } = item;
      const cost = Number(costPrice);

      let targetId = productId;

      // Try matching by barcode if productId is missing
      if (!targetId && barcode) {
        const match =
          await sql`SELECT product_id FROM products WHERE user_id = ${userId} AND barcode = ${barcode} LIMIT 1`;
        if (match.rows.length > 0) {
          targetId = match.rows[0].product_id;
        }
      }

      if (!targetId || isNaN(cost) || cost < 0) {
        results.failed++;
        results.errors.push(`Invalid data for ${productId || barcode}: cost must be >= 0`);
        return;
      }

      if (!userProductIds.has(targetId)) {
        results.failed++;
        results.errors.push(`Access denied for ${targetId}`);
        return;
      }

      try {
        await sql`
          UPDATE products
          SET 
            cost_price = ${cost},
            min_margin = ${minMargin !== undefined ? Number(minMargin) : sql`min_margin`},
            updated_at = NOW()
          WHERE user_id = ${userId} AND product_id = ${targetId}
        `;
        results.success++;
      } catch (e) {
        const error = e as Error;
        results.failed++;
        results.errors.push(`DB Error ${targetId}: ${error.message}`);
      }
    });

    await Promise.all(updatePromises);

    console.log(
      `💰 Batch Costs (Modular): user=${userId}, success=${results.success}, failed=${results.failed}`
    );

    return res.json({
      success: true,
      updated: results.success,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error) {
    console.error('Batch update costs error:', error);
    return res.status(500).json({ error: 'Internal server error during batch update' });
  }
}

// ============================================
// 🔴 LOSS PRODUCTS - "5 товаров торгуются в минус"
// Critical for Dashboard value proposition
// ============================================

/**
 * Get products with negative or zero margin
 * Shows: products where price <= cost_price (trading at loss)
 */
export async function handleLossProducts(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  try {
    const { threshold = 0 } = req.query;
    const marginThreshold = parseFloat(String(threshold)) || 0;

    // Find products where profit margin is below threshold
    // Uses estimated_buyer_price (what buyer pays after all discounts)
    const result = await sql`
      SELECT 
        p.product_id,
        p.nm_id,
        p.title,
        p.marketplace,
        p.current_price,
        p.estimated_buyer_price,
        p.cost_price,
        p.min_price,
        CASE 
          WHEN p.cost_price > 0 AND p.estimated_buyer_price > 0 
          THEN ROUND(((p.estimated_buyer_price - p.cost_price) / p.estimated_buyer_price * 100)::numeric, 1)
          ELSE NULL
        END as margin_percent,
        CASE 
          WHEN p.cost_price > 0 AND p.estimated_buyer_price > 0 
          THEN ROUND((p.estimated_buyer_price - p.cost_price)::numeric, 2)
          ELSE NULL
        END as profit_per_unit
      FROM products p
      WHERE p.user_id = ${userId}
        AND p.cost_price IS NOT NULL
        AND p.cost_price > 0
        AND p.estimated_buyer_price IS NOT NULL
        AND (
          p.estimated_buyer_price <= p.cost_price 
          OR (p.estimated_buyer_price - p.cost_price) / p.estimated_buyer_price * 100 < ${marginThreshold}
        )
      ORDER BY profit_per_unit ASC NULLS LAST
      LIMIT 50
    `;

    const lossProducts = result.rows;
    const totalLoss = lossProducts
      .filter(p => p.profit_per_unit !== null && p.profit_per_unit < 0)
      .reduce((sum, p) => sum + Math.abs(Number(p.profit_per_unit) || 0), 0);

    return res.json({
      success: true,
      count: lossProducts.length,
      totalPotentialLossPerUnit: Math.round(totalLoss),
      products: lossProducts,
      alert:
        lossProducts.length > 0
          ? `⚠️ Внимание! ${lossProducts.length} товаров торгуются в минус или с низкой маржой. Исправьте цены!`
          : null,
    });
  } catch (error) {
    console.error('Loss products error:', error);
    return res.status(500).json({ error: 'Failed to get loss products' });
  }
}

// ============================================
// NeuroGUARDIAN — Products Handler
// Product management and sync
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

// Import from modular library
import {
  decryptApiKey,
  sanitizeInput,
  isSubscriptionActive,
  getProductLimit,
} from '../lib/index.js';
import {
  getUserById,
  getProductsByUserId,
  updateProductMinPrice,
  type MarketplaceProduct,
} from '../services/index.js';

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

    const formatted = products.map((p: Record<string, unknown>) => ({
      id: p.product_id,
      productId: p.product_id, // CRITICAL: Frontend needs this for updates!
      nmId: p.nm_id,
      vendorCode: p.vendor_code || p.product_id,
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

  // POST: Update product min price
  const { productId, minPrice } = req.body || {};

  if (!productId || typeof minPrice !== 'number') {
    return res.status(400).json({
      error: 'Invalid parameters',
      received: { productId, minPrice },
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

    await updateProductMinPrice(userId, productId, minPrice);

    console.log(
      `✅ Stop-Loss updated (Modular): user=${userId}, product=${productId}, minPrice=${minPrice}`
    );
    return res.json({ success: true, productId, minPrice });
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({ error: 'Failed to update product' });
  }
}

/**
 * Handle sync-products action — fetch products from WB/Ozon APIs
 */
export async function handleSyncProducts(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  const { marketplace } = req.body || {};
  const mp = marketplace || 'Ozon';

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

  let totalSaved = 0;
  const summary: string[] = [];
  let limitReached = false;

  try {
    if (activeAccounts.length > 0) {
      // Multi-account sync
      for (const account of activeAccounts) {
        let apiKey = '';
        if (mp === 'WB' && account.wb_token) {
          apiKey = decryptApiKey(account.wb_token);
        } else if (mp === 'Ozon' && account.ozon_client_id && account.ozon_api_key) {
          // Encode in format expected by legacy logic (clientId:apiKey) or handle separately
          // The logic below decodes standard strings, let's adapt it.
          // Actually, let's just use the logic below which expects 'clientId:apiKey' for Ozon if we reuse code,
          // OR we can make the sync logic invalidatingly cleaner.
          // For minimal refactor, let's construct the key string.
          const clientId = decryptApiKey(account.ozon_client_id);
          const token = decryptApiKey(account.ozon_api_key);
          if (clientId && token) {
            apiKey = `${clientId}:${token}`;
          }
        }

        if (!apiKey) continue;

        const result = await performSync(userId, mp, apiKey, productLimit, account.id);
        totalSaved += result.savedCount;
        summary.push(`${account.name}: ${result.savedCount}`);
        if (result.limitReached) limitReached = true;
      }
    } else {
      // Legacy sync (Single account from user table)
      const encryptedApiKey = mp === 'WB' ? user.api_key_wb : user.api_key_ozon;
      if (!encryptedApiKey) {
        return res.status(400).json({ error: `${mp} API ключ не настроен` });
      }
      const apiKey = decryptApiKey(encryptedApiKey);

      const result = await performSync(userId, mp, apiKey, productLimit);
      totalSaved += result.savedCount;
      summary.push(`Основной: ${result.savedCount}`);
      if (result.limitReached) limitReached = true;
    }

    // Update user total
    await sql`UPDATE users SET total_products = (SELECT COUNT(*) FROM products WHERE user_id = ${userId}), updated_at = CURRENT_TIMESTAMP WHERE id = ${userId}`;

    return res.json({
      success: true,
      message: `Синхронизировано ${totalSaved} товаров из ${mp} (${summary.join(', ')})`,
      count: totalSaved,
      marketplace: mp,
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
 * Helper function to perform sync for a specific set of keys
 */
async function performSync(
  userId: number,
  mp: string,
  apiKey: string,
  productLimit: number,
  accountId?: number
): Promise<{ savedCount: number; limitReached: boolean }> {
  // Import unified services
  const { fetchWbProducts, fetchOzonProducts, saveProducts } = await import('../services/index.js');

  let products: MarketplaceProduct[] = [];

  try {
    if (mp === 'Ozon') {
      const [clientId, apiToken] = apiKey.includes(':') ? apiKey.split(':') : [apiKey, apiKey];
      products = await fetchOzonProducts(clientId, apiToken, 100);
    } else if (mp === 'WB') {
      products = await fetchWbProducts(apiKey, 100);
    }

    // Assign account_id and filter by limit if needed
    const productsToSave = products.map(p => ({
      ...p,
      account_id: accountId,
    }));

    // Handle subscription limits
    const limitedProducts = productsToSave.slice(0, productLimit);
    const limitReached = productsToSave.length > productLimit;

    if (limitedProducts.length > 0) {
      await saveProducts(userId, limitedProducts);
    }

    return {
      savedCount: limitedProducts.length,
      limitReached,
    };
  } catch (error) {
    console.error(
      `❌ [performSync] Error syncing ${mp} for account ${accountId || 'legacy'}:`,
      error
    );
    return { savedCount: 0, limitReached: false };
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
export async function handleApplyMinPrices(
  _req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  console.log(`🔧 Apply min_prices to marketplace for user ${userId}`);

  try {
    // Import marketplace functions
    const { getMarketplaceKeys, updateWbPrices, updateOzonPrices } =
      await import('../services/marketplace.js');

    // Get user's marketplace keys
    const keys = await getMarketplaceKeys(userId);

    if (!keys.wb && !keys.ozon) {
      return res.status(400).json({ error: 'No marketplace keys configured' });
    }

    // Get products with min_price set
    const productsRes = await sql`
      SELECT product_id, title, nm_id, min_price, marketplace, offer_id
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

    let wbUpdated = 0;
    let ozonUpdated = 0;
    const errors: string[] = [];

    // Apply WB prices
    if (keys.wb) {
      const wbProducts = products.filter(p => p.marketplace === 'WB' && p.nm_id && p.min_price > 0);

      if (wbProducts.length > 0) {
        const updates = wbProducts.map(p => ({
          nmId: p.nm_id,
          price: p.min_price, // min_price is already in RUBLES
        }));

        console.log(`📡 Applying ${updates.length} WB prices:`, JSON.stringify(updates));

        const result = await updateWbPrices(keys.wb, updates);

        if (result.success) {
          wbUpdated = result.count;
          console.log(`✅ WB: Updated ${wbUpdated} prices`);
        } else {
          errors.push(`WB: ${result.error}`);
        }
      }
    }

    // Apply Ozon prices
    if (keys.ozon) {
      const ozonProducts = products.filter(p => p.marketplace === 'Ozon' && p.min_price > 0);

      if (ozonProducts.length > 0) {
        const updates = ozonProducts.map(p => ({
          productId: parseInt(p.product_id.replace('ozon-', '')),
          price: p.min_price,
        }));

        const result = await updateOzonPrices(keys.ozon.clientId, keys.ozon.apiKey, updates);

        if (result.success) {
          ozonUpdated = result.count;
          console.log(`✅ Ozon: Updated ${ozonUpdated} prices`);
        } else {
          errors.push(`Ozon: ${result.error}`);
        }
      }
    }

    // Update current_price in DB to min_price
    await sql`
      UPDATE products
      SET current_price = min_price, updated_at = NOW()
      WHERE user_id = ${userId}
      AND min_price > 0
    `;

    const totalUpdated = wbUpdated + ozonUpdated;

    return res.json({
      success: errors.length === 0,
      message: `Цены применены: WB=${wbUpdated}, Ozon=${ozonUpdated}`,
      updated: totalUpdated,
      wbUpdated,
      ozonUpdated,
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

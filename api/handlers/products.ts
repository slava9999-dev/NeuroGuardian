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
} from '../../src/api-lib/lib/index.js';
import {
  getUserById,
  getProductsByUserId,
  updateProductMinPrice,
  fetchWbStocks,
} from '../../src/api-lib/services/index.js';

// fetchWithRetry moved to api-lib/lib/index.js

/**
 * Handle products action (GET and POST)
 */
export async function handleProducts(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
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

  // Get user's API key
  const user = await getUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Check if user has active subscription
  if (!isSubscriptionActive(user)) {
    return res.status(403).json({
      error: 'Для синхронизации товаров требуется активная подписка',
      code: 'SUBSCRIPTION_REQUIRED',
    });
  }

  const encryptedApiKey = mp === 'WB' ? user.api_key_wb : user.api_key_ozon;
  if (!encryptedApiKey) {
    return res.status(400).json({ error: `${mp} API ключ не настроен` });
  }

  // Decrypt API key (ТЗ Security)
  const apiKey = decryptApiKey(encryptedApiKey);
  const productLimit = getProductLimit(user.subscription_plan);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let products: any[] = [];

    if (mp === 'Ozon') {
      // Ozon API v3 integration
      const clientId = apiKey.split(':')[0];
      const apiToken = apiKey.includes(':') ? apiKey.split(':')[1] : apiKey;

      const listResponse = await fetch('https://api-seller.ozon.ru/v3/product/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': clientId,
          'Api-Key': apiToken,
        },
        body: JSON.stringify({ filter: {}, last_id: '', limit: 100 }),
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        return res
          .status(400)
          .json({ error: `Ozon API error: ${listResponse.status}`, details: errorText });
      }

      const listData = await listResponse.json();
      const items = listData.result?.items || [];

      if (items.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const productIds = items.map((item: any) => item.product_id);
        const detailResponse = await fetch('https://api-seller.ozon.ru/v3/product/info/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Id': clientId,
            'Api-Key': apiToken,
          },
          body: JSON.stringify({ product_id: productIds }),
        });

        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          const detailItems = detailData.result?.items || detailData.items || [];

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          products = detailItems.map((item: any) => {
            const totalStock =
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              item.stocks?.stocks?.reduce((acc: number, s: any) => acc + (s.present || 0), 0) || 0;
            let price = 0;
            if (typeof item.price === 'object' && item.price !== null) {
              price = parseFloat(item.price.marketing_price || item.price.price || '0');
            } else {
              price = parseFloat(item.price || item.marketing_price || '0');
            }

            return {
              product_id: `ozon-${item.id}`,
              title: item.name || 'Без названия',
              image_url:
                (typeof item.primary_image === 'string'
                  ? item.primary_image
                  : item.primary_image?.[0]) ||
                item.images?.[0] ||
                null,
              current_price: price,
              current_stock: totalStock,
              marketplace: 'Ozon',
              offer_id: item.offer_id || '', // CRITICAL: Save offer_id for price updates
            };
          });
        }
      }
    } else if (mp === 'WB') {
      // WB Content API v2
      const wbResponse = await fetch(
        'https://content-api.wildberries.ru/content/v2/get/cards/list',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: apiKey,
          },
          body: JSON.stringify({ settings: { cursor: { limit: 100 }, filter: { withPhoto: -1 } } }),
        }
      );

      if (!wbResponse.ok) {
        const errorBody = await wbResponse.text();
        console.error(`❌ WB Content API error: ${wbResponse.status}`, errorBody);
        return res.status(400).json({
          error: `WB API error: ${wbResponse.status}`,
          details: errorBody.substring(0, 200),
        });
      }

      const wbData = await wbResponse.json();
      const cards = wbData.cards || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nmIds = cards.map((card: any) => card.nmID);

      // Fetch REAL prices from WB Prices API
      const priceMap: Map<number, number> = new Map();
      if (nmIds.length > 0) {
        try {
          console.log(`🔍 WB: Fetching prices for ${nmIds.length} products...`);

          // Try POST method first
          // WB API uses GET with query parameters
          // If we have nmIds, we assume we want all of them.
          // WB API might require paginated requests or filterNmID if list is huge,
          // but for sync we usually want all. filterNmID works for specific subsets.
          // Since we might have > 1 product, and filterNmID accepts only one in some contexts (or array?),
          // Let's use the general list endpoint without filterNmID to get all prices,
          // OR if the list is small enough and API supports array, pass it.
          // Based on marketplace.ts investigation: GET is correct.

          const url = new URL(
            'https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter'
          );
          url.searchParams.set('limit', '1000');
          url.searchParams.set('offset', '0');

          // NOTE: WB API documentation says filterNmID is integer, but for GET it usually supports one value.
          // For bulk sync, we generally want ALL prices. So no filterNmID.

          console.log(`🔍 WB: Fetching prices via GET ${url.toString()}`);

          const pricesResponse = await fetch(url.toString(), {
            method: 'GET',
            headers: { Authorization: apiKey },
          });

          if (pricesResponse.ok) {
            const pricesData = await pricesResponse.json();
            const goods = pricesData.data?.listGoods || [];

            console.log(`📦 WB Prices API: received ${goods.length} goods`);

            for (const good of goods) {
              // Try multiple price fields (WB API changes frequently)
              const size = good.sizes?.[0];
              let price = 0;

              if (size) {
                // Priority: discountedPrice > clubDiscountedPrice > salePrice > price
                // WB API 2024: prices are in RUBLES (not kopecks!)
                price =
                  size.discountedPrice ||
                  size.clubDiscountedPrice ||
                  size.salePrice ||
                  size.price ||
                  good.price ||
                  0;

                // If price looks like kopecks (>10000 for cheap items), convert
                // But WB now uses rubles, so this is just a safety check
                if (price > 100000) {
                  price = Math.round(price / 100);
                }
              }

              if (price > 0) {
                priceMap.set(good.nmID, Math.round(price));
              } else {
                console.warn(`⚠️ WB: Zero price for nmID=${good.nmID}`, JSON.stringify(size));
              }
            }

            console.log(`💰 WB: Extracted prices for ${priceMap.size}/${goods.length} goods`);
          } else {
            const errorBody = await pricesResponse.text();
            console.error(`❌ WB Prices API error: ${pricesResponse.status}`, errorBody);
          }
        } catch (_e) {
          console.warn('Failed to fetch WB prices during sync:', _e);
        }
      }

      // Fetch REAL stocks from Warehouse Stocks API
      let stockMap = new Map<number, number>();
      if (nmIds.length > 0) {
        try {
          stockMap = await fetchWbStocks(apiKey, nmIds);
          console.log(`📦 WB Stocks: ${stockMap.size}/${nmIds.length} products have stock data`);
        } catch (e) {
          console.warn('Failed to fetch WB stocks during sync:', e);
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      products = cards.map((card: any) => {
        // Price priority: Prices API > Content API sizes > 0
        let price = priceMap.get(card.nmID) || 0;

        // Content API fallback - use size price if Prices API didn't return
        if (price === 0 && card.sizes?.length > 0) {
          const sizePrice = card.sizes[0]?.price || card.sizes[0]?.discountedPrice || 0;
          if (sizePrice > 0) {
            // Content API prices might be in kopecks
            price = sizePrice > 100000 ? Math.round(sizePrice / 100) : sizePrice;
            console.log(`💡 WB: Using Content API price for ${card.nmID}: ${price}`);
          }
        }

        return {
          product_id: `wb-${card.nmID}`,
          nm_id: card.nmID,
          title: card.title || card.subjectName || 'Без названия',
          image_url: card.photos?.[0]?.big || card.photos?.[0]?.c246x328 || null,
          current_price: price,
          current_stock: stockMap.get(card.nmID) || 0,
          marketplace: 'WB',
        };
      });
    }

    // Limit and Save
    const productsToSave = products.slice(0, productLimit);
    const limitReached = products.length > productLimit;

    let savedCount = 0;
    for (const p of productsToSave) {
      try {
        await sql`
          INSERT INTO products (user_id, product_id, nm_id, title, image_url, current_price, current_stock, marketplace, status, offer_id)
          VALUES (${userId}, ${p.product_id}, ${p.nm_id || null}, ${p.title}, ${p.image_url}, ${Math.round(p.current_price)}, ${p.current_stock}, ${p.marketplace}, 'active', ${(p as { offer_id?: string }).offer_id || null})
          ON CONFLICT (user_id, product_id) DO UPDATE SET
            title = EXCLUDED.title,
            image_url = EXCLUDED.image_url,
            current_price = EXCLUDED.current_price,
            current_stock = EXCLUDED.current_stock,
            offer_id = EXCLUDED.offer_id,
            updated_at = CURRENT_TIMESTAMP
        `;
        savedCount++;
      } catch (e) {
        console.error('Error saving product in sync:', e);
      }
    }

    // Update user total
    await sql`UPDATE users SET total_products = (SELECT COUNT(*) FROM products WHERE user_id = ${userId}), updated_at = CURRENT_TIMESTAMP WHERE id = ${userId}`;

    return res.json({
      success: true,
      message: `Синхронизировано ${savedCount} товаров из ${mp}`,
      count: savedCount,
      marketplace: mp,
      warning: limitReached
        ? `Достигнут лимит тарифа: сохранено ${savedCount} из ${products.length} товаров.`
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

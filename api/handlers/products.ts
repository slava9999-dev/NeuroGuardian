// ============================================
// NeuroGUARDIAN — Products Handler
// Product management and sync
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

// Import from modular library
import { decryptApiKey, sanitizeInput, isValidPrice } from '../../src/api-lib/lib/index.js';
import {
  getUserById,
  getProductsByUserId,
  updateProductMinPrice,
} from '../../src/api-lib/services/index.js';

/**
 * Fetch with retry for marketplace APIs
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error as Error;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  throw lastError || new Error('Fetch failed');
}

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
      nmId: p.nm_id,
      title: sanitizeInput(String(p.title || '')),
      imageUrl: p.image_url,
      currentPrice: Number(p.current_price || 0),
      minPrice: Number(p.min_price || 0),
      currentStock: Number(p.current_stock || 0),
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
  _req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  const user = await getUserById(userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const results = {
    wb: { synced: 0, error: null as string | null },
    ozon: { synced: 0, error: null as string | null },
  };

  // Sync WB products
  if (user.api_key_wb) {
    try {
      const apiKey = decryptApiKey(user.api_key_wb);

      // Get card list from WB
      const cardsResponse = await fetchWithRetry(
        'https://content-api.wildberries.ru/content/v2/get/cards/list',
        {
          method: 'POST',
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            settings: { cursor: { limit: 100 }, filter: { withPhoto: -1 } },
          }),
        }
      );

      if (!cardsResponse.ok) {
        const errText = await cardsResponse.text();
        results.wb.error = `WB API error: ${cardsResponse.status}`;
        console.error('WB cards error:', errText);
      } else {
        const cardsData = await cardsResponse.json();
        const cards = cardsData.cards || [];

        // Get prices
        const nmIds = cards.map((c: { nmID: number }) => c.nmID);

        let pricesMap: Map<number, number> = new Map();

        if (nmIds.length > 0) {
          const pricesResponse = await fetchWithRetry(
            'https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter',
            {
              method: 'POST',
              headers: {
                Authorization: apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ nmIDs: nmIds }),
            }
          );

          if (pricesResponse.ok) {
            const pricesData = await pricesResponse.json();
            const goods = pricesData.data?.listGoods || [];
            pricesMap = new Map(
              goods.map((g: { nmID: number; sizes: Array<{ price: number }> }) => [
                g.nmID,
                g.sizes?.[0]?.price || 0,
              ])
            );
          }
        }

        // Upsert products
        for (const card of cards) {
          const currentPrice = pricesMap.get(card.nmID) || 0;
          const imageUrl = card.mediaFiles?.[0] || card.photos?.[0]?.big || '';

          await sql`
            INSERT INTO products (user_id, product_id, nm_id, title, image_url, current_price, marketplace)
            VALUES (${userId}, ${String(card.nmID)}, ${card.nmID}, ${card.title || 'Без названия'}, ${imageUrl}, ${currentPrice}, 'WB')
            ON CONFLICT (user_id, product_id) DO UPDATE SET
              title = EXCLUDED.title,
              image_url = EXCLUDED.image_url,
              current_price = EXCLUDED.current_price,
              updated_at = NOW()
          `;
          results.wb.synced++;
        }
      }
    } catch (error) {
      results.wb.error = error instanceof Error ? error.message : 'WB sync failed';
      console.error('WB sync error:', error);
    }
  }

  // Sync Ozon products
  if (user.api_key_ozon && user.ozon_client_id) {
    try {
      const apiKey = decryptApiKey(user.api_key_ozon);
      const clientId = user.ozon_client_id;

      const productsResponse = await fetchWithRetry('https://api-seller.ozon.ru/v2/product/list', {
        method: 'POST',
        headers: {
          'Client-Id': clientId,
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filter: { visibility: 'ALL' }, limit: 100 }),
      });

      if (!productsResponse.ok) {
        const errText = await productsResponse.text();
        results.ozon.error = `Ozon API error: ${productsResponse.status}`;
        console.error('Ozon products error:', errText);
      } else {
        const productsData = await productsResponse.json();
        const items = productsData.result?.items || [];

        if (items.length > 0) {
          // Get detailed info
          const productIds = items.map((i: { product_id: number }) => i.product_id);

          const infoResponse = await fetchWithRetry(
            'https://api-seller.ozon.ru/v2/product/info/list',
            {
              method: 'POST',
              headers: {
                'Client-Id': clientId,
                'Api-Key': apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ product_id: productIds }),
            }
          );

          if (infoResponse.ok) {
            const infoData = await infoResponse.json();
            const infoItems = infoData.result?.items || [];

            for (const item of infoItems) {
              const imageUrl = item.primary_image || item.images?.[0] || '';
              const currentPrice = parseInt(item.price || item.marketing_price || '0', 10);

              await sql`
                INSERT INTO products (user_id, product_id, title, image_url, current_price, marketplace)
                VALUES (${userId}, ${String(item.id)}, ${item.name || 'Без названия'}, ${imageUrl}, ${currentPrice}, 'Ozon')
                ON CONFLICT (user_id, product_id) DO UPDATE SET
                  title = EXCLUDED.title,
                  image_url = EXCLUDED.image_url,
                  current_price = EXCLUDED.current_price,
                  updated_at = NOW()
              `;
              results.ozon.synced++;
            }
          }
        }
      }
    } catch (error) {
      results.ozon.error = error instanceof Error ? error.message : 'Ozon sync failed';
      console.error('Ozon sync error:', error);
    }
  }

  // Update user total products
  const totalResult = await sql`SELECT COUNT(*) as count FROM products WHERE user_id = ${userId}`;
  const total = Number(totalResult.rows[0]?.count || 0);
  await sql`UPDATE users SET total_products = ${total} WHERE id = ${userId}`;

  return res.json({
    success: true,
    synced: {
      wb: results.wb.synced,
      ozon: results.ozon.synced,
      total,
    },
    errors: {
      wb: results.wb.error,
      ozon: results.ozon.error,
    },
  });
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

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

  if (!productId) {
    return res.status(400).json({ error: 'Product ID required' });
  }

  if (minPrice !== undefined && !isValidPrice(minPrice)) {
    return res.status(400).json({ error: 'Invalid price' });
  }

  await updateProductMinPrice(userId, productId, minPrice || 0);

  return res.json({ success: true });
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
  const { percentage, productIds, marketplace } = req.body || {};

  if (!percentage || percentage < 1 || percentage > 50) {
    return res.status(400).json({ error: 'Percentage must be between 1 and 50' });
  }

  // Get products based on filters
  let products: Record<string, unknown>[] = [];

  if (productIds && Array.isArray(productIds) && productIds.length > 0) {
    // For specific product IDs, query each one (Vercel Postgres limitation)
    const allProducts = await sql`SELECT * FROM products WHERE user_id = ${userId}`;
    products = allProducts.rows.filter(p => productIds.includes(String(p.product_id)));
  } else if (marketplace && marketplace !== 'all') {
    const result =
      await sql`SELECT * FROM products WHERE user_id = ${userId} AND marketplace = ${marketplace}`;
    products = result.rows;
  } else {
    const result = await sql`SELECT * FROM products WHERE user_id = ${userId}`;
    products = result.rows;
  }

  let updated = 0;

  for (const product of products) {
    const currentPrice = Number(product.current_price || 0);
    const productId = product.id as number;

    if (currentPrice > 0) {
      const minPrice = Math.round(currentPrice * (1 - percentage / 100));
      await sql`UPDATE products SET min_price = ${minPrice} WHERE id = ${productId}`;
      updated++;
    }
  }

  return res.json({
    success: true,
    updated,
    percentage,
  });
}

// ============================================
// NeuroGUARDIAN — Products API Endpoint
// GET /api/products — Get user's products
// POST /api/products — Update product minPrice
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateInitData, parseInitDataUnsafe } from './lib/telegram';
import { getProductsByUserId, updateProductMinPrice, getProductById } from './lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // Get initData from header or body
    const initData = req.headers['x-init-data'] as string || req.body?.initData;

    if (!initData) {
      return res.status(401).json({ error: 'Missing initData' });
    }

    // Validate auth
    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    const parsed = isDev ? parseInitDataUnsafe(initData) : validateInitData(initData);

    if (!parsed || !parsed.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = parsed.user.id;

    if (req.method === 'GET') {
      // Get all products for user
      const products = await getProductsByUserId(userId);

      // Transform to frontend format
      const formattedProducts = products.map((p) => ({
        id: p.id.toString(),
        userId: p.user_id,
        productId: p.product_id,
        nmId: p.nm_id,
        offerId: p.offer_id,
        vendorCode: p.vendor_code,
        barcode: p.barcode,
        title: p.title,
        imageUrl: p.image_url,
        brand: p.brand,
        category: p.category,
        currentPrice: p.current_price,
        minPrice: p.min_price,
        originalPrice: p.original_price,
        stock: p.current_stock,
        marketplace: p.marketplace,
        status: p.status,
        isMonitored: p.is_monitored,
        lastCheckedAt: p.last_checked_at,
        lastTriggeredAt: p.last_triggered_at,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));

      return res.status(200).json({
        success: true,
        products: formattedProducts,
      });
    }

    if (req.method === 'POST') {
      const { productId, minPrice } = req.body;

      if (!productId) {
        return res.status(400).json({ error: 'Missing productId' });
      }

      if (typeof minPrice !== 'number' || minPrice < 0) {
        return res.status(400).json({ error: 'Invalid minPrice' });
      }

      // Update minPrice
      await updateProductMinPrice(userId, productId, minPrice);

      // Get updated product
      const product = await getProductById(productId, userId);

      return res.status(200).json({
        success: true,
        product: product ? {
          id: product.id.toString(),
          productId: product.product_id,
          minPrice: product.min_price,
          status: product.status,
        } : null,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Products error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

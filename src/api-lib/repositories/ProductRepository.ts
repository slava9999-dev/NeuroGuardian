import { sql } from '../services/database.js';
import type { DBProduct, PendingPriceUpdate } from '../lib/types.js';

export class ProductRepository {
  async getByUserId(userId: number, accountId?: number): Promise<DBProduct[]> {
    if (accountId) {
      const result = await sql`
        SELECT p.*,
          COALESCE(
             json_agg(
               json_build_object(
                 'id', m.id,
                 'productId', m.product_id,
                 'userId', m.user_id,
                 'type', m.type,
                 'status', m.status,
                 'originalUrl', m.original_url,
                 'processedUrl', m.processed_url,
                 'thumbnailUrl', m.thumbnail_url,
                 'visionMetadata', m.vision_metadata,
                 'width', m.width,
                 'height', m.height,
                 'mimeType', m.mime_type,
                 'createdAt', m.created_at
               )
             ) FILTER (WHERE m.id IS NOT NULL),
             '[]'
          ) as media_assets
        FROM products p
        LEFT JOIN media_assets m ON p.product_id = m.product_id
        WHERE p.user_id = ${userId} AND p.account_id = ${accountId}
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `;
      // Returned media_assets are now uniformly camelCase arrays
      return result.rows as DBProduct[];
    }

    const result = await sql`
      SELECT p.*,
        COALESCE(
           json_agg(
             json_build_object(
               'id', m.id,
               'productId', m.product_id,
               'userId', m.user_id,
               'type', m.type,
               'status', m.status,
               'originalUrl', m.original_url,
               'processedUrl', m.processed_url,
               'thumbnailUrl', m.thumbnail_url,
               'visionMetadata', m.vision_metadata,
               'width', m.width,
               'height', m.height,
               'mimeType', m.mime_type,
               'createdAt', m.created_at
             )
           ) FILTER (WHERE m.id IS NOT NULL),
           '[]'
        ) as media_assets
      FROM products p
      LEFT JOIN media_assets m ON p.product_id = m.product_id
      WHERE p.user_id = ${userId}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;
    return result.rows as DBProduct[];
  }

  async saveBatch(userId: number, products: Partial<DBProduct>[]): Promise<void> {
    for (const p of products) {
      await sql`
        INSERT INTO products (
          user_id, product_id, nm_id, official_sku, offer_id, title, 
          image_url, current_price, estimated_buyer_price, marketplace_discount_percent,
          current_stock, marketplace, account_id, 
          min_price, spp_buffer_percent, auto_adjust_min_price, is_monitored, status,
          min_margin, barcode,
          updated_at
        )

        VALUES (
          ${userId}, ${p.product_id}, ${p.nm_id || null}, ${p.official_sku || null}, 
          ${p.offer_id || null}, ${p.title}, ${p.image_url}, ${p.current_price}, 
          ${p.estimated_buyer_price || null}, ${p.marketplace_discount_percent || null},
          ${p.current_stock}, ${p.marketplace}, ${p.account_id || null},
          ${p.min_price || 0}, ${p.spp_buffer_percent || 25}, ${p.auto_adjust_min_price ?? false}, 
          ${p.is_monitored ?? true}, ${p.status || 'active'},
          ${p.min_margin || 0}, ${p.barcode || null},
          NOW()
        )

        ON CONFLICT (user_id, product_id) DO UPDATE SET
          current_price = EXCLUDED.current_price,
          estimated_buyer_price = EXCLUDED.estimated_buyer_price,
          marketplace_discount_percent = EXCLUDED.marketplace_discount_percent,
          current_stock = EXCLUDED.current_stock,
          title = EXCLUDED.title,
          image_url = EXCLUDED.image_url,
          account_id = COALESCE(EXCLUDED.account_id, products.account_id),
          -- Smart Defaults: Update min_price ONLY if product doesn't have one set already
          min_price = CASE 
            WHEN products.min_price = 0 OR products.min_price IS NULL 
            THEN EXCLUDED.min_price 
            ELSE products.min_price 
          END,
          -- Update SPP buffer only if not manually set
          spp_buffer_percent = COALESCE(products.spp_buffer_percent, EXCLUDED.spp_buffer_percent),
          -- Keep existing monitoring settings if already set
          is_monitored = COALESCE(products.is_monitored, EXCLUDED.is_monitored),
          barcode = COALESCE(products.barcode, EXCLUDED.barcode),
          min_margin = COALESCE(products.min_margin, EXCLUDED.min_margin),
          updated_at = NOW()
      `;
    }
  }

  async updatePrice(userId: number, productId: string, price: number): Promise<void> {
    await sql`UPDATE products SET current_price = ${price}, updated_at = NOW() WHERE user_id = ${userId} AND product_id = ${productId}`;
  }

  async updateMinPrice(userId: number, productId: string, minPrice: number): Promise<void> {
    await sql`UPDATE products SET min_price = ${minPrice}, updated_at = NOW() WHERE user_id = ${userId} AND product_id = ${productId}`;
  }

  async updateCostPrice(userId: number, productId: string, costPrice: number): Promise<void> {
    await sql`UPDATE products SET cost_price = ${costPrice}, updated_at = NOW() WHERE user_id = ${userId} AND product_id = ${productId}`;
  }

  async batchUpdateCostPrices(
    userId: number,
    updates: Array<{ productId: string; costPrice: number }>
  ): Promise<void> {
    for (const update of updates) {
      await this.updateCostPrice(userId, update.productId, update.costPrice);
    }
  }

  async updateMonitoring(
    userId: number,
    productId: string,
    isMonitored: boolean,
    minPrice?: number
  ): Promise<void> {
    if (minPrice !== undefined) {
      await sql`
        UPDATE products 
        SET is_monitored = ${isMonitored}, min_price = ${minPrice}, updated_at = NOW() 
        WHERE user_id = ${userId} AND product_id = ${productId}
      `;
    } else {
      await sql`
        UPDATE products 
        SET is_monitored = ${isMonitored}, updated_at = NOW() 
        WHERE user_id = ${userId} AND product_id = ${productId}
      `;
    }
  }

  // Pending Price methods
  async setPendingPrice(
    userId: number,
    productId: string,
    price: number,
    taskId?: string
  ): Promise<void> {
    await sql`
      UPDATE products 
      SET pending_price = ${price}, pending_task_id = ${taskId || null}, pending_status = 'pending', pending_since = NOW()
      WHERE user_id = ${userId} AND product_id = ${productId}
    `;
  }

  async batchSetPendingPrices(
    userId: number,
    updates: PendingPriceUpdate[],
    taskId?: string
  ): Promise<void> {
    for (const u of updates) {
      await this.setPendingPrice(userId, u.productId, u.pendingPrice, taskId);
    }
  }

  async getWithPendingPrices(userId: number): Promise<DBProduct[]> {
    const result =
      await sql`SELECT * FROM products WHERE user_id = ${userId} AND pending_price IS NOT NULL`;
    return result.rows as DBProduct[];
  }

  async confirmPendingByTaskId(userId: number, taskId: string): Promise<void> {
    await sql`
      UPDATE products 
      SET current_price = pending_price, 
          pending_price = NULL, pending_task_id = NULL, pending_status = 'completed', pending_since = NULL
      WHERE user_id = ${userId} AND pending_task_id = ${taskId}
    `;
  }
}

export const productRepository = new ProductRepository();

import { sql } from '../services/database.js';
import type { DBProduct, PendingPriceUpdate } from '../lib/types.js';

export class ProductRepository {
  async getByUserId(userId: number, accountId?: number): Promise<DBProduct[]> {
    if (accountId) {
      const result = await sql`
        SELECT * FROM products 
        WHERE user_id = ${userId} AND account_id = ${accountId}
        ORDER BY created_at DESC
      `;
      return result.rows as DBProduct[];
    }

    const result = await sql`
      SELECT * FROM products 
      WHERE user_id = ${userId} 
      ORDER BY created_at DESC
    `;
    return result.rows as DBProduct[];
  }

  async saveBatch(userId: number, products: Partial<DBProduct>[]): Promise<void> {
    for (const p of products) {
      await sql`
        INSERT INTO products (
          user_id, product_id, nm_id, official_sku, offer_id, title, 
          image_url, current_price, estimated_buyer_price, marketplace_discount_percent,
          current_stock, marketplace, account_id, updated_at
        )
        VALUES (
          ${userId}, ${p.product_id}, ${p.nm_id || null}, ${p.official_sku || null}, 
          ${p.offer_id || null}, ${p.title}, ${p.image_url}, ${p.current_price}, 
          ${p.estimated_buyer_price || null}, ${p.marketplace_discount_percent || null},
          ${p.current_stock}, ${p.marketplace}, ${p.account_id || null}, NOW()
        )
        ON CONFLICT (user_id, product_id) DO UPDATE SET
          current_price = EXCLUDED.current_price,
          estimated_buyer_price = EXCLUDED.estimated_buyer_price,
          marketplace_discount_percent = EXCLUDED.marketplace_discount_percent,
          current_stock = EXCLUDED.current_stock,
          title = EXCLUDED.title,
          image_url = EXCLUDED.image_url,
          account_id = COALESCE(EXCLUDED.account_id, products.account_id),
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

/* eslint-disable @typescript-eslint/no-explicit-any */
import { sql } from '../../core/db';
import { ProductSchema, type Product } from '../../schemas/product.schema';
import { logger } from '../../utils/logger';

export class ProductService {
  /**
   * Fetch all products for a user
   */
  async getProductsByUserId(userId: number): Promise<Product[]> {
    try {
      // Vercel Postgres types are loose sometimes
      const result = await sql`
        SELECT * FROM products 
        WHERE user_id = ${userId}
        ORDER BY current_price DESC
      `;

      return result.rows.map((row: any) => ({
        product_id: row.product_id,
        user_id: row.user_id,
        marketplace: row.marketplace,
        title: row.title,
        current_price: row.current_price,
        min_price: row.min_price,
        current_stock: row.current_stock,
        status: row.status,
        last_updated: row.updated_at,
        metadata: row.metadata,
      }));
    } catch (error) {
      logger.error('Failed to get products', error, { userId });
      throw error;
    }
  }

  /**
   * Update min_price (stop-loss) for a product
   */
  async updateMinPrice(userId: number, productId: string, minPrice: number): Promise<void> {
    try {
      await sql`
        UPDATE products 
        SET 
          min_price = ${minPrice},
          status = 'protected',
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${userId} AND product_id = ${productId}
      `;
      logger.info('Updated product min price', { userId, productId, minPrice });
    } catch (error) {
      logger.error('Failed to update product min price', error, { userId, productId });
      throw error;
    }
  }

  /**
   * Update current_price for a product (Price Update Tool)
   */
  async updatePrice(userId: number, productId: string, newPrice: number): Promise<void> {
    try {
      // Validate input (basic check using schema logic)
      ProductSchema.shape.current_price.parse(newPrice);

      await sql`
            UPDATE products 
            SET 
              current_price = ${newPrice},
              updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ${userId} AND product_id = ${productId}
          `;
      logger.info('Updated product price locally', { userId, productId, newPrice });

      // NOTE: In a real scenario, this would also need to call the Marketplace API
      // to update the price remotely. For now, we update the DB state.
    } catch (error) {
      logger.error('Failed to update product price', error, { userId, productId });
      throw error;
    }
  }
}

export const productService = new ProductService();

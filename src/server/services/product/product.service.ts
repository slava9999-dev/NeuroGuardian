/* eslint-disable @typescript-eslint/no-explicit-any */
import { sql } from '../../core/db';
import { ProductSchema, type Product } from '../../schemas/product.schema';
import { logger } from '../../utils/logger';
import { userService } from '../user/user.service';
import { decryptApiKey } from '../../utils/crypto';

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
   * Update current_price for a product (Internal DB update)
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
    } catch (error) {
      logger.error('Failed to update product price', error, { userId, productId });
      throw error;
    }
  }

  /**
   * REAL Update Price on Marketplace (WB/Ozon)
   */
  async updateMarketplacePrice(
    userId: number,
    updates: Array<{ productId: string; newPrice: number }>
  ): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const user = await userService.getUserById(userId);

      if (!user || (!user.api_key_wb && !user.api_key_ozon)) {
        return { success: false, count: 0, error: 'API Key not found' };
      }

      // We'll focus on WB for now
      if (user.api_key_wb) {
        const wbApiKey = decryptApiKey(user.api_key_wb);
        // WB API expects numeric IDs. Handle "wb-12345" or raw "12345"
        const payload = updates.map(u => ({
          nmId: parseInt(u.productId.replace(/\D/g, ''), 10),
          price: u.newPrice,
        }));

        const response = await fetch('https://openapi.wildberries.ru/prices/api/v2/upload/task', {
          method: 'POST',
          headers: {
            Authorization: wbApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: payload }),
        });

        if (response.ok) {
          // Update local DB
          for (const update of updates) {
            await this.updatePrice(userId, update.productId, update.newPrice);
          }
          return { success: true, count: updates.length };
        } else {
          const errText = await response.text();
          logger.error(`WB API Error: ${response.status} ${errText}`);
          return { success: false, count: 0, error: `WB API Error: ${errText}` };
        }
      }

      return { success: false, count: 0, error: 'No suitable marketplace API key found' };
    } catch (error) {
      logger.error('Failed to update marketplace price', error, { userId });
      return {
        success: false,
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const productService = new ProductService();

import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';
import { wbService } from '../src/api-lib/core-services/WbService.js';
import { decryptApiKey, logger } from '../src/api-lib/lib/index.js';

async function run() {
  logger.info('🚀 Starting Product Dimensions Update Worker...');

  try {
    // 1. Find users with products missing dimensions
    // Limit to avoid processing everything at once in this run
    const users = await sql`
        SELECT DISTINCT user_id 
        FROM products 
        WHERE marketplace = 'WB' 
        AND (width_cm IS NULL OR height_cm IS NULL OR depth_cm IS NULL)
        LIMIT 50
    `;

    logger.info(`Found ${users.rows.length} users with incomplete product data.`);

    for (const user of users.rows) {
      const userId = user.user_id;

      // 2. Get credentials (prioritize marketplace_accounts, fallback to users table if legacy)
      // Current architecture prefers marketplace_accounts
      const accounts = await sql`
            SELECT id, wb_token 
            FROM marketplace_accounts 
            WHERE user_id = ${userId} AND marketplace = 'WB' AND is_active = true
            LIMIT 1
        `;

      let apiKey: string | null = null;

      if (accounts.rows.length > 0) {
        apiKey = accounts.rows[0].wb_token;
      } else {
        // Check legacy users table
        const userRec = await sql`SELECT api_key_wb FROM users WHERE id = ${userId}`;
        if (userRec.rows.length > 0) {
          apiKey = userRec.rows[0].api_key_wb;
        }
      }

      if (!apiKey) {
        logger.warn(`No active WB token found for user ${userId}. Skipping.`);
        continue;
      }

      try {
        apiKey = decryptApiKey(apiKey);
      } catch (e) {
        logger.warn(`Failed to decrypt key for user ${userId}. Skipping.`);
        continue;
      }

      // 3. Get products to update (batch of 100)
      const products = await sql`
            SELECT id, nm_id 
            FROM products 
            WHERE user_id = ${userId} 
            AND marketplace = 'WB' 
            AND (width_cm IS NULL OR height_cm IS NULL OR depth_cm IS NULL)
            AND nm_id IS NOT NULL
            LIMIT 100
        `;

      if (products.rows.length === 0) continue;

      const nmIds = products.rows.map(p => parseInt(p.nm_id as string)).filter(n => !isNaN(n));

      if (nmIds.length === 0) continue;

      logger.info(`Fetching dimensions for user ${userId}, ${nmIds.length} products...`);

      // 4. Fetch details
      const dimensionsMap = await wbService.updateProductDimensions(apiKey, nmIds);

      logger.info(`Received stats for ${dimensionsMap.size}/${nmIds.length} products.`);

      // 5. Update DB
      for (const [nmId, dims] of dimensionsMap) {
        await sql`
                UPDATE products 
                SET width_cm = ${dims.width}, 
                    height_cm = ${dims.height}, 
                    depth_cm = ${dims.depth},
                    weight_kg = ${dims.weight || 0},
                    updated_at = NOW()
                WHERE user_id = ${userId} AND nm_id = ${String(nmId)}
            `;
      }
    }

    logger.info('✅ Dimensions update cycle completed');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Worker failed:', error);
    process.exit(1);
  }
}

run();

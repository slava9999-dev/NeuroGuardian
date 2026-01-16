import { sql } from '../src/api-lib/services/database.js';
import { marketplaceService } from '../src/api-lib/core-services/MarketplaceService.js';
import { decryptApiKey } from '../src/api-lib/lib/index.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function syncAllOrders() {
  console.log('📦 --- GLOBAL ORDER SYNC (V2 - With Throttle & Diagnostics) ---');
  
  try {
    const accounts = await sql`
      SELECT id, user_id, name, marketplace, wb_token, ozon_api_key, ozon_client_id
      FROM marketplace_accounts 
      WHERE is_active = true
    `;

    console.log(`Found ${accounts.rows.length} accounts to sync.\n`);

    for (const acc of accounts.rows) {
      console.log(`\n--- Processing [${acc.marketplace}] ${acc.name} (User: ${acc.user_id}) ---`);
      
      // key diagnostics
      try {
          if (acc.marketplace === 'WB') {
              const token = decryptApiKey(acc.wb_token);
              console.log(`Diagnostic: Token length = ${token?.length || 0} characters.`);
          } else if (acc.marketplace === 'Ozon') {
              const cid = decryptApiKey(acc.ozon_client_id);
              const key = decryptApiKey(acc.ozon_api_key);
              console.log(`Diagnostic: ClientID=${cid}, APIKey length=${key?.length || 0}.`);
          }
      } catch (err) {
          console.warn('Diagnostic failed (decryption error).');
      }

      try {
        const result = await marketplaceService.syncSalesHistory(
          Number(acc.user_id),
          30,
          acc.id
        );

        if (result.success) {
          console.log(`✅ Success! Imported/Updated: ${result.imported} orders.`);
        } else {
          console.error(`❌ Sync failed: ${result.error}`);
        }
      } catch (err) {
        console.error(`❌ Unexpected error for ${acc.name}:`, err);
      }

      // Throttle to avoid 429
      if (acc.marketplace === 'WB') {
          console.log('Sleeping 10s to satisfy WB Rate Limiter...');
          await sleep(10000);
      }
    }

    console.log('\n--- GLOBAL SYNC COMPLETED ---');

    // Final summary
    const stats = await sql`
        SELECT marketplace, count(*) as count 
        FROM marketplace_orders 
        GROUP BY marketplace
    `;
    console.table(stats.rows);

  } catch (e) {
    console.error('Fatal sync failure:', e);
  }
  process.exit(0);
}

syncAllOrders();

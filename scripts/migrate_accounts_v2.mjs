import { sql } from '../src/api-lib/services/database.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function migrate() {
  console.log('🚀 Starting Advanced Key Migration (V2.1 - Fix Syntax)...');
  
  try {
    const users = await sql`
      SELECT id, first_name, api_key_wb, api_key_ozon, ozon_client_id 
      FROM users 
      WHERE api_key_wb IS NOT NULL OR api_key_ozon IS NOT NULL
    `;

    for (const user of users.rows) {
      const userName = user.first_name || 'User';
      console.log(`\nProcessing ${userName} (${user.id})...`);

      // 1. WB Migration
      if (user.api_key_wb) {
        const existingWB = await sql`SELECT id FROM marketplace_accounts WHERE user_id = ${user.id} AND marketplace = 'WB'`;
        if (existingWB.rows.length === 0) {
          const accRes = await sql`
            INSERT INTO marketplace_accounts (user_id, name, marketplace, wb_token, is_active)
            VALUES (${user.id}, ${userName + ' - WB'}, 'WB', ${user.api_key_wb}, true)
            RETURNING id
          `;
          const accountId = accRes.rows[0].id;
          await sql`UPDATE products SET account_id = ${accountId} WHERE user_id::text = ${user.id}::text AND marketplace = 'WB'`;
          console.log(`✅ WB Migrated. Account ID: ${accountId}`);
        } else {
          console.log('⏩ WB already migrated, ensuring links...');
          await sql`UPDATE products SET account_id = ${existingWB.rows[0].id} WHERE user_id::text = ${user.id}::text AND marketplace = 'WB' AND account_id IS NULL`;
        }
      }

      // 2. Ozon Migration
      if (user.api_key_ozon) {
        let clientId = user.ozon_client_id;
        let apiKey = user.api_key_ozon;

        if (apiKey.includes(':')) {
            const parts = apiKey.split(':');
            clientId = parts[0];
            apiKey = parts[1];
        }

        if (clientId && apiKey) {
            const existingOzon = await sql`SELECT id FROM marketplace_accounts WHERE user_id = ${user.id} AND marketplace = 'Ozon'`;
            if (existingOzon.rows.length === 0) {
                const accRes = await sql`
                    INSERT INTO marketplace_accounts (user_id, name, marketplace, ozon_client_id, ozon_api_key, is_active)
                    VALUES (${user.id}, ${userName + ' - Ozon'}, 'Ozon', ${clientId}, ${apiKey}, true)
                    RETURNING id
                `;
                const accountId = accRes.rows[0].id;
                const updateRes = await sql`UPDATE products SET account_id = ${accountId} WHERE user_id::text = ${user.id}::text AND marketplace = 'Ozon'`;
                console.log(`✅ Ozon Migrated (ID: ${clientId}). Linked ${updateRes.rowCount} products.`);
            } else {
                console.log('⏩ Ozon already migrated, ensuring links...');
                await sql`UPDATE products SET account_id = ${existingOzon.rows[0].id} WHERE user_id::text = ${user.id}::text AND marketplace = 'Ozon' AND account_id IS NULL`;
            }
        }
      }
    }

    console.log('\n✨ Migration V2.1 finished.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  }
  process.exit(0);
}

migrate();

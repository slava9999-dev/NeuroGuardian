import { sql } from '../src/api-lib/services/database.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function migrate() {
  console.log('🚀 Starting Key Migration to marketplace_accounts...');
  
  try {
    // 1. Get users with keys
    const users = await sql`
      SELECT id, first_name, api_key_wb, api_key_ozon, ozon_client_id 
      FROM users 
      WHERE api_key_wb IS NOT NULL OR api_key_ozon IS NOT NULL
    `;

    console.log(`Found ${users.rows.length} users to migrate.`);

    for (const user of users.rows) {
      console.log(`\nProcessing ${user.first_name} (${user.id})...`);

      // Migrating WB
      if (user.api_key_wb) {
        const wbName = `${user.first_name || 'User'} - WB`;
        const existingWB = await sql`
          SELECT id FROM marketplace_accounts 
          WHERE user_id = ${user.id} AND marketplace = 'WB' AND wb_token = ${user.api_key_wb}
        `;

        if (existingWB.rows.length === 0) {
          const res = await sql`
            INSERT INTO marketplace_accounts (user_id, name, marketplace, wb_token, is_active)
            VALUES (${user.id}, ${wbName}, 'WB', ${user.api_key_wb}, true)
            RETURNING id
          `;
          const accountId = res.rows[0].id;
          console.log(`✅ Created WB Account: ${accountId}`);

          // Update products
          const productsRes = await sql`
            UPDATE products 
            SET account_id = ${accountId}
            WHERE user_id::text = ${user.id}::text AND marketplace = 'WB'
          `;
          console.log(`   Linked ${productsRes.rowCount} WB products.`);
        } else {
          console.log('⏩ WB Account already exists.');
        }
      }

      // Migrating Ozon
      if (user.api_key_ozon && user.ozon_client_id) {
        const ozonName = `${user.first_name || 'User'} - Ozon`;
        const existingOzon = await sql`
          SELECT id FROM marketplace_accounts 
          WHERE user_id = ${user.id} AND marketplace = 'Ozon' AND ozon_api_key = ${user.api_key_ozon}
        `;

        if (existingOzon.rows.length === 0) {
          const res = await sql`
            INSERT INTO marketplace_accounts (user_id, name, marketplace, ozon_api_key, ozon_client_id, is_active)
            VALUES (${user.id}, ${ozonName}, 'Ozon', ${user.api_key_ozon}, ${user.ozon_client_id}, true)
            RETURNING id
          `;
          const accountId = res.rows[0].id;
          console.log(`✅ Created Ozon Account: ${accountId}`);

          // Update products
          const productsRes = await sql`
            UPDATE products 
            SET account_id = ${accountId}
            WHERE user_id::text = ${user.id}::text AND marketplace = 'Ozon'
          `;
          console.log(`   Linked ${productsRes.rowCount} Ozon products.`);
        } else {
          console.log('⏩ Ozon Account already exists.');
        }
      }
    }

    console.log('\n✨ Migration finished successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  }
  process.exit(0);
}

migrate();

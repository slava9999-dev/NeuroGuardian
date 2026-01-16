import { sql } from '../src/api-lib/services/database.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function checkAccounts() {
  console.log('--- MARKETPLACE ACCOUNTS SCHEMA ---');
  try {
    const cols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'marketplace_accounts'
      ORDER BY ordinal_position
    `;
    console.table(cols.rows);

    const counts = await sql`SELECT count(*) FROM marketplace_accounts`;
    console.log(`Current record count: ${counts.rows[0].count}`);

    const legacy = await sql`
      SELECT id, first_name, api_key_wb, api_key_ozon, ozon_client_id 
      FROM users 
      WHERE api_key_wb IS NOT NULL OR api_key_ozon IS NOT NULL
    `;
    console.log(`\nUsers with legacy keys: ${legacy.rows.length}`);
    legacy.rows.forEach(u => {
      console.log(`- ${u.first_name} (${u.id}): WB=${u.api_key_wb ? 'YES' : 'NO'}, Ozon=${u.api_key_ozon ? 'YES' : 'NO'}`);
    });

  } catch (e) {
    console.error('Check failed:', e);
  }
  process.exit(0);
}

checkAccounts();

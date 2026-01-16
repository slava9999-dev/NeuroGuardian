import { sql } from '../src/api-lib/services/database.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function checkOzonKeys() {
  console.log('--- OZON KEYS CHECK ---');
  try {
    const res = await sql`
      SELECT id, first_name, api_key_ozon, ozon_client_id 
      FROM users 
      WHERE api_key_ozon IS NOT NULL
    `;
    console.table(res.rows);
  } catch (e) {
    console.error('Check failed:', e);
  }
  process.exit(0);
}

checkOzonKeys();

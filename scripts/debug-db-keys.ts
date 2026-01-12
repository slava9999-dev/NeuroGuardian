import { sql } from '../src/api-lib/services/database.js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function checkKeys() {
  const userId = 7548070478;
  console.log(`🔍 Checking keys for User ${userId}`);

  const rows =
    await sql`SELECT api_key_wb, api_key_ozon, ozon_client_id FROM users WHERE id = ${userId}`;
  const user = rows.rows[0];

  if (!user) {
    console.log('User not found');
    process.exit(0);
  }

  function analyze(name: string, val: string | null) {
    console.log(`\nField: ${name}`);
    if (!val) {
      console.log('Value: NULL');
      return;
    }
    console.log(`Length: ${val.length}`);
    console.log(`Contains ':': ${val.includes(':')}`);
    if (val.includes(':')) {
      const parts = val.split(':');
      console.log(`Parts count: ${parts.length}`);
      parts.forEach((p, i) => console.log(`  Part ${i} length: ${p.length}`));
    } else {
      console.log('Format: Plaintext or Opaque');
    }
  }

  analyze('api_key_wb', user.api_key_wb);
  analyze('api_key_ozon', user.api_key_ozon);
  analyze('ozon_client_id', user.ozon_client_id);

  process.exit(0);
}

checkKeys();

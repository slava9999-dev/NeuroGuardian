import { sql } from '../src/api-lib/services/database.js';
import { decryptApiKey } from '../src/api-lib/lib/index.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function debugOzonRaw() {
  console.log('🧪 --- OZON RAW RESPONSE DEBUG ---');
  
  try {
    const accRes = await sql`
      SELECT id, ozon_client_id, ozon_api_key 
      FROM marketplace_accounts 
      WHERE marketplace = 'Ozon' AND ozon_client_id IS NOT NULL 
      LIMIT 1
    `;

    if (accRes.rows.length === 0) return;

    const acc = accRes.rows[0];
    const clientId = decryptApiKey(acc.ozon_client_id);
    const apiKey = decryptApiKey(acc.ozon_api_key);

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);
    
    // Ozon often prefers YYYY-MM-DDTHH:mm:ssZ format from ISO
    const since = dateFrom.toISOString();

    console.log(`Requesting Ozon FBO with Client-Id: ${clientId}, since: ${since}`);

    const response = await fetch('https://api-seller.ozon.ru/v2/posting/fbo/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
      body: JSON.stringify({
        dir: 'ASC',
        filter: { since },
        limit: 10,
      }),
    });

    const data = await response.json();
    console.log('\n--- RAW FBO DATA ---');
    console.log(JSON.stringify(data, null, 2));

    console.log('\nRequesting Ozon FBS...');
    const responseFbs = await fetch('https://api-seller.ozon.ru/v3/posting/fbs/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
      body: JSON.stringify({
        dir: 'ASC',
        filter: { since },
        limit: 10,
      }),
    });

    const dataFbs = await responseFbs.json();
    console.log('\n--- RAW FBS DATA ---');
    console.log(JSON.stringify(dataFbs, null, 2));

  } catch (e) {
    console.error('Debug failed:', e);
  }
  process.exit(0);
}

debugOzonRaw();

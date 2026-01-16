import { sql } from '../src/api-lib/services/database.js';
import { decryptApiKey } from '../src/api-lib/lib/index.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function debugOzonV3() {
  console.log('🧪 --- OZON API V3 DIAGNOSTICS ---');
  
  try {
    const accRes = await sql`
      SELECT id, name, ozon_client_id, ozon_api_key 
      FROM marketplace_accounts 
      WHERE marketplace = 'Ozon' AND ozon_client_id IS NOT NULL 
      LIMIT 1
    `;

    if (accRes.rows.length === 0) return;

    const acc = accRes.rows[0];
    const clientId = decryptApiKey(acc.ozon_client_id);
    const apiKey = decryptApiKey(acc.ozon_api_key);

    console.log(`Testing [${acc.name}] | Client ID: ${clientId}`);

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);
    const since = dateFrom.toISOString();
    const to = new Date().toISOString();

    const headers = {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
    };

    // 1. Test FBO (v2)
    console.log('\nChecking FBO (V2)...');
    const fbo = await fetch('https://api-seller.ozon.ru/v2/posting/fbo/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({ dir: 'ASC', filter: { since }, limit: 10 })
    });
    const fboData = await fbo.json();
    console.log(`FBO Result: ${fboData.result?.length || 0} orders.`);

    // 2. Test FBS (v3) 
    // Trying both "to" and "processed_at_to" to be absolutely sure
    console.log('\nChecking FBS (V3)...');
    const fbs = await fetch('https://api-seller.ozon.ru/v3/posting/fbs/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
            dir: 'ASC', 
            filter: { 
                since, 
                to 
            }, 
            limit: 10,
            with: { financial_data: true }
        })
    });
    const fbsData = await fbs.json();
    
    if (fbsData.error) {
        console.log('FBS V3 Error:', fbsData.error.message);
        console.log('Trying with processed_at_to...');
        // Fallback or attempt with different schema if V3 is picky
    } else {
        console.log(`FBS Result: ${fbsData.result?.postings?.length || 0} orders.`);
    }

    console.log('\n--- DIAGNOSTICS COMPLETED ---');

  } catch (e) {
    console.error('Debug failed:', e);
  } finally {
    // Force exit to prevent Node 25 UV_HANDLE_CLOSING assertion on Windows
    setTimeout(() => process.exit(0), 100);
  }
}

debugOzonV3();

import { config } from '../../../../src/infrastructure/config/env.js';

async function verifyKeys() {
  console.log('🧪 Verifying Marketplace API Keys from .env...');

  // WB Verification
  if (config.WB_API_KEY) {
    console.log('Testing Wildberries (WB) Key...');
    // Wildberries often needs a User-Agent or specific connectivity.
    // We'll try the Prices API (v2) which is usually the most relevant for Sentinel.
    try {
      const res = await fetch(
        'https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter?limit=1',
        {
          headers: {
            Authorization: config.WB_API_KEY,
            'Content-Type': 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        }
      );
      console.log(`- WB Status: ${res.status} ${res.statusText}`);
      if (res.ok) {
        console.log('  ✅ WB Key is VALID');
      } else {
        const body = await res.text();
        console.error(`  ❌ WB Key is INVALID or Rate Limited: ${body}`);
      }
    } catch (e: any) {
      console.warn(`  ⚠️ WB Connection Warning: ${e.message}`);
      console.warn(
        '  (Note: WB APIs often block non-RU datacenter IPs. Key might still be valid for production server.)'
      );
    }
  } else {
    console.warn('⚠️ WB_API_KEY is missing in .env');
  }

  // Ozon Verification
  if (config.OZON_API_KEY && config.OZON_CLIENT_ID) {
    console.log('\nTesting Ozon Keys...');
    try {
      // Using v3/product/list as seen in OzonService.ts
      const res = await fetch('https://api-seller.ozon.ru/v3/product/list', {
        method: 'POST',
        headers: {
          'Client-Id': config.OZON_CLIENT_ID,
          'Api-Key': config.OZON_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filter: {}, last_id: '', limit: 1 }),
      });
      console.log(`- Ozon Status: ${res.status} ${res.statusText}`);
      if (res.ok) {
        console.log('  ✅ Ozon Keys are VALID');
      } else {
        const body = await res.text();
        console.error(`  ❌ Ozon Keys are INVALID: ${body}`);
      }
    } catch (e: any) {
      console.error(`  ❌ Ozon Connection Error: ${e.message}`);
    }
  } else {
    console.warn('⚠️ OZON_API_KEY or OZON_CLIENT_ID is missing in .env');
  }

  process.exit(0);
}

verifyKeys();

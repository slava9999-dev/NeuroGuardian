/**
 * Debug script to inspect actual Ozon API response for price fields
 * Run: npx tsx scripts/debug-ozon-prices.ts
 */

import 'dotenv/config';

async function debugOzonPrices() {
  console.log('🔍 Debug: Inspecting Ozon API price response fields\n');

  // Get keys from environment
  const clientId = process.env.OZON_CLIENT_ID;
  const apiKey = process.env.OZON_API_KEY;

  if (!clientId || !apiKey) {
    console.error('❌ No OZON_CLIENT_ID or OZON_API_KEY in environment');
    console.log('   Set them in .env file');
    return;
  }

  console.log(`✅ Found Ozon keys from environment\n`);

  try {
    // Fetch prices using v5 API
    const response = await fetch('https://api-seller.ozon.ru/v5/product/info/prices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
      body: JSON.stringify({
        filter: { visibility: 'ALL' },
        cursor: '',
        limit: 5, // Just get first 5 products
      }),
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status}`);
      console.error(await response.text());
      return;
    }

    const data = await response.json();
    const items = data.items || data.result?.items || [];

    console.log(`📦 Got ${items.length} products\n`);
    console.log('='.repeat(80));

    for (const item of items) {
      console.log(`\n📦 Product ID: ${item.product_id}`);
      console.log(`   Offer ID: ${item.offer_id || 'N/A'}`);

      // Log ALL price fields
      console.log('\n   💰 PRICE OBJECT:');
      console.log(JSON.stringify(item.price, null, 4));

      // Log price_index if exists
      if (item.price_index || item.price_indexes) {
        console.log('\n   📊 PRICE INDEX:');
        console.log(JSON.stringify(item.price_index || item.price_indexes, null, 4));
      }

      // Log commissions if exists
      if (item.commissions) {
        console.log('\n   💸 COMMISSIONS:');
        console.log(JSON.stringify(item.commissions, null, 4));
      }

      // Log any discount fields
      if (item.discounts || item.discount) {
        console.log('\n   🏷️ DISCOUNTS:');
        console.log(JSON.stringify(item.discounts || item.discount, null, 4));
      }

      // Log marketing fields
      if (item.marketing_actions || item.actions) {
        console.log('\n   📢 MARKETING ACTIONS:');
        console.log(JSON.stringify(item.marketing_actions || item.actions, null, 4));
      }

      console.log('\n   📋 RAW ITEM (all fields):');
      console.log(JSON.stringify(item, null, 2));

      console.log('\n' + '='.repeat(80));
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugOzonPrices();

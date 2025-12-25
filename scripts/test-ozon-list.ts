#!/usr/bin/env tsx
/**
 * Test Ozon product list to see what products are actually available
 */

const OZON_CLIENT_ID = process.env.OZON_CLIENT_ID || '';
const OZON_API_KEY = process.env.OZON_API_KEY || '';

async function testOzonProductList() {
  if (!OZON_CLIENT_ID || !OZON_API_KEY) {
    console.error('❌ Set OZON_CLIENT_ID and OZON_API_KEY environment variables');
    process.exit(1);
  }

  console.log('🔍 Testing Ozon Product List API...\n');

  try {
    // Step 1: Get product list
    const listResponse = await fetch('https://api-seller.ozon.ru/v3/product/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': OZON_CLIENT_ID,
        'Api-Key': OZON_API_KEY,
      },
      body: JSON.stringify({
        filter: {},
        last_id: '',
        limit: 10,
      }),
    });

    console.log(`📡 Product List API: status=${listResponse.status}\n`);

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error(`❌ API Error:\n${errorText}`);
      return;
    }

    const listData = await listResponse.json();
    const items = listData.result?.items || [];

    console.log(`📦 Found ${items.length} products\n`);

    if (items.length === 0) {
      console.warn('⚠️ No products found!');
      return;
    }

    // Show first few products
    console.log('First products:');
    for (const item of items.slice(0, 5)) {
      console.log(`  - Product ID: ${item.product_id}`);
      console.log(`    Offer ID: ${item.offer_id || 'N/A'}`);
      console.log('');
    }

    // Step 2: Get detailed info for these products
    const productIds = items.map((i: { product_id: number }) => i.product_id);

    console.log(`\n📡 Fetching details for ${productIds.length} products...\n`);

    const infoResponse = await fetch('https://api-seller.ozon.ru/v3/product/info/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': OZON_CLIENT_ID,
        'Api-Key': OZON_API_KEY,
      },
      body: JSON.stringify({
        product_id: productIds,
      }),
    });

    console.log(`📡 Product Info API: status=${infoResponse.status}\n`);

    if (infoResponse.ok) {
      const infoData = await infoResponse.json();
      const infoItems = infoData.result?.items || [];

      console.log(`📦 Received ${infoItems.length} product details\n`);

      for (const item of infoItems.slice(0, 3)) {
        console.log(`Product ID: ${item.id}`);
        console.log(`  Name: ${item.name?.substring(0, 50)}...`);
        console.log(`  Price:`, JSON.stringify(item.price));
        console.log('');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testOzonProductList();

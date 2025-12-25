#!/usr/bin/env tsx
/**
 * Test Ozon API directly to diagnose why prices are not returned
 */

const OZON_CLIENT_ID = process.env.OZON_CLIENT_ID || '';
const OZON_API_KEY = process.env.OZON_API_KEY || '';

async function testOzonPricesAPI() {
  if (!OZON_CLIENT_ID || !OZON_API_KEY) {
    console.error('❌ Set OZON_CLIENT_ID and OZON_API_KEY environment variables');
    process.exit(1);
  }

  console.log('🔍 Testing Ozon Prices API...\n');

  // Test product IDs from your logs
  const testProductIds = [
    1720270428, 1720270439, 1720270427, 1720270425, 1720270426, 1720270455, 1720270448, 1720270450,
  ];

  console.log(`📦 Testing with ${testProductIds.length} product IDs`);
  console.log(`Product IDs: ${testProductIds.join(', ')}\n`);

  try {
    // Try v3/product/info/list instead (includes prices in response)
    const response = await fetch('https://api-seller.ozon.ru/v3/product/info/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': OZON_CLIENT_ID,
        'Api-Key': OZON_API_KEY,
      },
      body: JSON.stringify({
        product_id: testProductIds,
      }),
    });

    console.log(`📡 Response status: ${response.status}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error:\n${errorText}`);
      return;
    }

    const data = await response.json();
    const items = data.result?.items || [];

    console.log(`📦 Received ${items.length} items\n`);

    if (items.length === 0) {
      console.warn('⚠️ No items returned! Possible reasons:');
      console.warn('  - Product IDs are incorrect');
      console.warn('  - Products are not published');
      console.warn('  - Products belong to different seller');
      return;
    }

    // Analyze each item
    for (const item of items) {
      console.log(`\n📦 Product ID: ${item.product_id}`);
      console.log(`   Offer ID: ${item.offer_id || 'N/A'}`);

      if (item.price) {
        console.log(`   Price object:`, JSON.stringify(item.price, null, 2));

        const marketingPrice = parseFloat(item.price.marketing_price || '0');
        const regularPrice = parseFloat(item.price.price || '0');

        console.log(`   Marketing price: ${marketingPrice}₽`);
        console.log(`   Regular price: ${regularPrice}₽`);

        if (marketingPrice === 0 && regularPrice === 0) {
          console.warn(`   ⚠️ Both prices are 0! Product may not be published.`);
        }
      } else {
        console.warn(`   ⚠️ No price object!`);
      }
    }

    console.log(`\n✅ Test complete!`);
    console.log(`\nSummary:`);
    console.log(`  - Requested: ${testProductIds.length} products`);
    console.log(`  - Received: ${items.length} items`);
    console.log(
      `  - With prices: ${items.filter(i => parseFloat(i.price?.marketing_price || i.price?.price || '0') > 0).length}`
    );
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testOzonPricesAPI();

/**
 * TEST SCRIPT: Check WB API price format (kopecks vs rubles)
 *
 * Run: npx tsx scripts/test-wb-price-format.ts
 */

import 'dotenv/config';
import { config } from 'dotenv';

config({ path: '.env.production' });

async function testPriceFormat() {
  const apiKey = process.env.WB_API_KEY;

  if (!apiKey) {
    console.error('❌ WB_API_KEY not found!');
    process.exit(1);
  }

  console.log('🔍 Testing WB API price format...\n');

  // 1. Fetch current prices from WB
  const url = new URL('https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter');
  url.searchParams.set('limit', '5');
  url.searchParams.set('offset', '0');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: apiKey },
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status}`);
      return;
    }

    const data = (await response.json()) as { data: { listGoods: any[] } };
    const goods = data.data?.listGoods || [];

    console.log('📦 Sample prices from WB API:\n');

    for (const good of goods.slice(0, 5)) {
      const size = good.sizes?.[0];
      console.log(`nmId: ${good.nmID}`);
      console.log(`  sizes[0].price: ${size?.price}`);
      console.log(`  sizes[0].discountedPrice: ${size?.discountedPrice}`);
      console.log(`  sizes[0].clubDiscountedPrice: ${size?.clubDiscountedPrice}`);
      console.log('');
    }

    // Analyze format
    const firstPrice = goods[0]?.sizes?.[0]?.discountedPrice || goods[0]?.sizes?.[0]?.price;

    console.log('═══════════════════════════════════════════════════════');
    if (firstPrice > 50000) {
      console.log(`🔢 First price value: ${firstPrice}`);
      console.log(`📌 This looks like KOPECKS (${firstPrice / 100} RUB)`);
      console.log('   → extractWbPrice should DIVIDE by 100');
      console.log('   → updateWbPrices should MULTIPLY by 100');
    } else {
      console.log(`🔢 First price value: ${firstPrice}`);
      console.log(`📌 This looks like RUBLES`);
      console.log('   → extractWbPrice should NOT divide');
      console.log('   → updateWbPrices should NOT multiply');
    }
    console.log('═══════════════════════════════════════════════════════');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testPriceFormat();

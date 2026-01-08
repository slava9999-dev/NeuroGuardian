/**
 * TEST: Single price update to WB
 */

import 'dotenv/config';
import { config } from 'dotenv';

config({ path: '.env.production' });

async function testSingleUpdate() {
  const wbApiKey = process.env.WB_API_KEY;
  
  if (!wbApiKey) {
    console.error('❌ WB_API_KEY not found!');
    return;
  }

  console.log('Key prefix:', wbApiKey.substring(0, 15) + '...');

  // Test with single product
  const payload = {
    data: [
      { nmId: 704777082, price: 10795, discount: 0 },
    ]
  };

  console.log('\n📡 Sending test payload:', JSON.stringify(payload, null, 2));

  const response = await fetch(
    'https://discounts-prices-api.wildberries.ru/api/v2/upload/task',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: wbApiKey,
      },
      body: JSON.stringify(payload),
    }
  );

  const text = await response.text();
  console.log(`\n📡 Response (${response.status}):`, text);
}

testSingleUpdate();

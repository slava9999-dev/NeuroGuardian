import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';
import { fetchWithRetry } from '../src/api-lib/lib/index.js';
import { getMarketplaceKeys } from '../src/api-lib/services/marketplace.js';

dotenv.config({ path: '.env.production' });
console.log('DB URL:', process.env.POSTGRES_URL ? 'PRESENT' : 'MISSING');
console.log('ENV:', process.env.VERCEL_ENV);

async function testWb() {
  console.log('--- Testing WB Price Update ---');
  const userId = 1634470382; // Example user from logs
  const { wb: apiKey } = await getMarketplaceKeys(userId);

  if (!apiKey) {
    console.error('No WB API Key found');
    return;
  }

  const payload = [
    {
      nmID: 705453044, // Example product from logs
      price: 1500,
      discount: 0,
    },
  ];

  console.log('Trying with { data: payload }...');
  const res1 = await fetch('https://discounts-prices-api.wildberries.ru/api/v2/upload/task', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: payload }),
  });
  console.log('Response 1:', res1.status, await res1.text());

  console.log('\nTrying with array directly...');
  const res2 = await fetch('https://discounts-prices-api.wildberries.ru/api/v2/upload/task', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  console.log('Response 2:', res2.status, await res2.text());
}

async function testOzon() {
  console.log('\n--- Testing Ozon Price Fetch ---');
  const userId = 1634470382;
  const { ozon } = await getMarketplaceKeys(userId);

  if (!ozon) {
    console.error('No Ozon API Keys found');
    return;
  }

  const productIds = [1426466367]; // Example product from logs

  const endpoints = [
    'https://api-seller.ozon.ru/v4/product/info/prices',
    'https://api-seller.ozon.ru/v3/product/info/list',
    'https://api-seller.ozon.ru/v2/product/info/prices',
    'https://api-seller.ozon.ru/v1/product/info/prices',
  ];

  for (const url of endpoints) {
    console.log(`Testing ${url}...`);
    try {
      const body: any = {};
      if (url.includes('prices')) {
        body.filter = { product_id: productIds.map(String), visibility: 'ALL' };
      } else {
        body.product_id = productIds.map(Number);
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Client-Id': ozon.clientId,
          'Api-Key': ozon.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      console.log(`Response ${url}:`, res.status);
      if (res.ok) {
        const text = await res.text();
        console.log('Body:', text.substring(0, 500));
      } else {
        console.log('Error:', await res.text());
      }
    } catch (e) {
      console.error(`Failed ${url}:`, e);
    }
  }
}

async function run() {
  await testWb();
  await testOzon();
  process.exit(0);
}

run();

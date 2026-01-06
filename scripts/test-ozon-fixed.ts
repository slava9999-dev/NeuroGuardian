/**
 * 🔍 ТЕСТ ИСПРАВЛЕННОГО fetchOzonCurrentPrices
 */

import 'dotenv/config';
import { sql } from '@vercel/postgres';

// Скопировал логику из исправленного marketplace.ts
async function fetchOzonCurrentPrices(
  clientId: string,
  apiKey: string,
  productIds: number[]
): Promise<Map<number, number>> {
  const priceMap = new Map<number, number>();
  if (productIds.length === 0) return priceMap;
  
  const validIds = Array.from(new Set(productIds.filter(id => typeof id === 'number' && id > 0)));
  if (validIds.length === 0) return priceMap;

  console.log(`📡 Ozon Prices API v5: Fetching for ${validIds.length} products`);
  console.log(`   IDs to find: ${validIds.slice(0, 5).join(', ')}${validIds.length > 5 ? '...' : ''}`);

  const requestedIds = new Set(validIds);
  let cursor = '';
  let totalFetched = 0;
  const MAX_PAGES = 10;
  let pageCount = 0;

  while (pageCount < MAX_PAGES) {
    pageCount++;
    console.log(`\n   📄 Page ${pageCount}...`);
    
    const response = await fetch('https://api-seller.ozon.ru/v5/product/info/prices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
      body: JSON.stringify({
        filter: { visibility: 'ALL' },
        cursor,
        limit: 1000,
      }),
    });

    if (!response.ok) {
      console.error(`   ❌ Error: ${response.status}`);
      break;
    }

    const data = await response.json() as any;
    const items = data.items || data.result?.items || [];
    totalFetched += items.length;
    console.log(`   Received: ${items.length} items`);

    for (const p of items) {
      const pid = Number(p.product_id);
      if (requestedIds.has(pid)) {
        const priceObj = p.price || {};
        const actualPrice = parseFloat(priceObj.price || priceObj.marketing_seller_price || '0');
        if (actualPrice > 0) {
          priceMap.set(pid, Math.round(actualPrice));
          console.log(`   ✅ Found: ${pid} = ${actualPrice}₽`);
        }
      }
    }

    if (priceMap.size >= validIds.length) {
      console.log(`   ✅ All ${priceMap.size} prices found!`);
      break;
    }

    const nextCursor = data.cursor || '';
    if (!nextCursor || nextCursor === cursor || items.length < 1000) {
      console.log(`   📄 No more pages (cursor: ${nextCursor ? 'exists' : 'empty'})`);
      break;
    }
    cursor = nextCursor;
  }

  console.log(`\n💰 Result: ${priceMap.size}/${validIds.length} prices (scanned ${totalFetched} total)`);
  
  const missing = validIds.filter(id => !priceMap.has(id));
  if (missing.length > 0) {
    console.log(`   ⚠️ Missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
  }

  return priceMap;
}

async function main() {
  console.log('🔍 ТЕСТ ИСПРАВЛЕННОГО fetchOzonCurrentPrices');
  console.log('='.repeat(60));

  // Получаем ключи
  const userRes = await sql`
    SELECT api_key_ozon FROM users WHERE protection_enabled = true LIMIT 1
  `;
  const [clientId, apiKey] = (userRes.rows[0].api_key_ozon as string).split(':');

  // Получаем product_id из БД
  const productsRes = await sql`
    SELECT product_id FROM products WHERE marketplace = 'Ozon' LIMIT 10
  `;
  
  const ozonIds = productsRes.rows
    .map(p => parseInt(String(p.product_id).replace('ozon-', '')))
    .filter(id => id > 0);

  console.log(`\n📦 Ищем ${ozonIds.length} товаров:`);
  ozonIds.forEach(id => console.log(`   - ${id}`));

  // Тест
  const priceMap = await fetchOzonCurrentPrices(clientId, apiKey, ozonIds);

  console.log('\n' + '='.repeat(60));
  console.log('📊 РЕЗУЛЬТАТ:');
  for (const [id, price] of priceMap) {
    console.log(`   ${id}: ${price}₽`);
  }
  
  console.log('\n✅ Тест завершён');
}

main().catch(console.error);

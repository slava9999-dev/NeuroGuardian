/**
 * 🔍 ТЕСТ: Детальный анализ Ozon API ответа
 */

import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function main() {
  console.log('🔍 ДЕТАЛЬНЫЙ ТЕСТ OZON API');
  console.log('='.repeat(60));

  // Получаем ключи
  const userRes = await sql`
    SELECT id, api_key_ozon FROM users 
    WHERE protection_enabled = true LIMIT 1
  `;

  const user = userRes.rows[0];
  const [clientId, apiKey] = (user.api_key_ozon as string).split(':');

  console.log(`\n✅ Client ID: ${clientId}`);

  // Получаем несколько товаров
  const productsRes = await sql`
    SELECT product_id, nm_id, offer_id, title 
    FROM products 
    WHERE marketplace = 'Ozon'
    LIMIT 5
  `;

  console.log('\n📦 ТОВАРЫ В БД:');
  for (const p of productsRes.rows) {
    console.log(`   product_id: ${p.product_id}, nm_id: ${p.nm_id}, offer_id: ${p.offer_id}`);
  }

  // Тест 1: Запрос v5/product/info/prices БЕЗ фильтра
  console.log('\n📡 ТЕСТ 1: v5/product/info/prices (без фильтра по ID)');
  
  const response1 = await fetch('https://api-seller.ozon.ru/v5/product/info/prices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': clientId,
      'Api-Key': apiKey,
    },
    body: JSON.stringify({
      filter: { visibility: 'ALL' },
      cursor: '',
      limit: 5,
    }),
  });

  console.log(`   Status: ${response1.status}`);
  
  if (response1.ok) {
    const data1 = await response1.json() as any;
    console.log(`   Keys in response: ${Object.keys(data1)}`);
    const items = data1.result?.items || data1.items || [];
    console.log(`   Items count: ${items.length}`);
    
    if (items.length > 0) {
      console.log('\n   📋 Первые 3 товара:');
      for (const item of items.slice(0, 3)) {
        console.log(`      product_id: ${item.product_id}`);
        console.log(`      offer_id: ${item.offer_id}`);
        console.log(`      price: ${JSON.stringify(item.price)}`);
        console.log('      ---');
      }
    }
  } else {
    const err = await response1.text();
    console.log(`   Error: ${err}`);
  }

  // Тест 2: Запрос v3/product/info/list
  console.log('\n📡 ТЕСТ 2: v3/product/info/list');
  
  const ozonIds = productsRes.rows
    .map(p => parseInt(String(p.product_id).replace('ozon-', '')))
    .filter(id => id > 0);
  
  console.log(`   Requesting IDs: ${ozonIds.slice(0, 3).join(', ')}...`);

  const response2 = await fetch('https://api-seller.ozon.ru/v3/product/info/list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': clientId,
      'Api-Key': apiKey,
    },
    body: JSON.stringify({
      product_id: ozonIds.slice(0, 3),
    }),
  });

  console.log(`   Status: ${response2.status}`);
  
  if (response2.ok) {
    const data2 = await response2.json() as any;
    const items = data2.result?.items || data2.items || [];
    console.log(`   Items count: ${items.length}`);
    
    if (items.length > 0) {
      console.log('\n   📋 Детали:');
      for (const item of items) {
        console.log(`      id: ${item.id}`);
        console.log(`      offer_id: ${item.offer_id}`);
        console.log(`      name: ${item.name?.substring(0, 40)}`);
        const price = item.price?.price || item.price?.marketing_price || item.marketing_price;
        console.log(`      price: ${price}`);
        console.log('      ---');
      }
    }
  } else {
    const err = await response2.text();
    console.log(`   Error: ${err}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Тест завершён');
}

main().catch(console.error);

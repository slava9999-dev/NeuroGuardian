/**
 * 🧪 ТЕСТ API ИЗМЕНЕНИЯ ЦЕН НА OZON
 * 
 * Безопасный тест - устанавливаем текущую же цену чтобы проверить что API работает
 */

import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function main() {
  console.log('🧪 ТЕСТ API ИЗМЕНЕНИЯ ЦЕН НА OZON');
  console.log('='.repeat(70));

  // 1. Получаем ключи
  const userRes = await sql`
    SELECT id, first_name, api_key_ozon 
    FROM users WHERE protection_enabled = true LIMIT 1
  `;
  const user = userRes.rows[0];
  const [clientId, apiKey] = (user.api_key_ozon as string).split(':');
  
  console.log(`\n👤 Пользователь: ${user.first_name}`);
  console.log(`   Client ID: ${clientId}`);

  // 2. Получаем первый товар
  const productsRes = await sql`
    SELECT product_id, title, current_price
    FROM products 
    WHERE marketplace = 'Ozon'
    LIMIT 1
  `;

  const product = productsRes.rows[0];
  const ozonId = parseInt(String(product.product_id).replace('ozon-', ''));
  
  console.log(`\n📦 Тестовый товар:`);
  console.log(`   ID: ${ozonId}`);
  console.log(`   Название: ${product.title?.substring(0, 50)}...`);
  console.log(`   Цена в БД: ${product.current_price}₽`);

  // 3. Получаем реальную цену с Ozon
  console.log(`\n📡 Получаем текущую цену с Ozon...`);
  
  const priceResponse = await fetch('https://api-seller.ozon.ru/v5/product/info/prices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': clientId,
      'Api-Key': apiKey,
    },
    body: JSON.stringify({
      filter: { visibility: 'ALL' },
      limit: 100,
    }),
  });

  if (!priceResponse.ok) {
    console.log('   ❌ Ошибка получения цен');
    return;
  }

  const priceData = await priceResponse.json() as any;
  const items = priceData.items || [];
  const targetItem = items.find((p: any) => Number(p.product_id) === ozonId);

  if (!targetItem) {
    console.log(`   ⚠️ Товар ${ozonId} не найден среди ${items.length} товаров`);
    // Пробуем первый доступный
    if (items.length > 0) {
      const firstItem = items[0];
      console.log(`   📋 Использую первый доступный: ${firstItem.product_id}`);
      testPriceUpdate(clientId, apiKey, firstItem);
    }
    return;
  }

  await testPriceUpdate(clientId, apiKey, targetItem);
}

async function testPriceUpdate(clientId: string, apiKey: string, item: any) {
  const productId = Number(item.product_id);
  const offerId = item.offer_id;
  const priceObj = item.price || {};
  const currentPrice = parseFloat(priceObj.price || '0');
  const minPrice = parseFloat(priceObj.min_price || '0');
  const oldPrice = parseFloat(priceObj.old_price || '0');

  console.log(`\n📊 Информация о товаре ${productId}:`);
  console.log(`   offer_id: ${offerId}`);
  console.log(`   Текущая цена: ${currentPrice}₽`);
  console.log(`   Min цена (Ozon): ${minPrice}₽`);
  console.log(`   Old price: ${oldPrice}₽`);

  // 4. Попытка изменить цену (на ту же самую - безопасно!)
  console.log(`\n🔧 ТЕСТ: Устанавливаем цену ${currentPrice}₽ (без изменений)`);

  // Попытка 1: через product_id
  console.log(`\n📤 Попытка 1: через product_id`);
  const payload1 = {
    prices: [{
      product_id: productId,
      price: String(currentPrice),
      old_price: String(oldPrice || currentPrice * 1.2),
      currency_code: 'RUB',
    }],
  };
  console.log(`   Payload: ${JSON.stringify(payload1)}`);

  const response1 = await fetch('https://api-seller.ozon.ru/v1/product/import/prices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': clientId,
      'Api-Key': apiKey,
    },
    body: JSON.stringify(payload1),
  });

  console.log(`   Status: ${response1.status}`);
  const data1 = await response1.json() as any;
  console.log(`   Response: ${JSON.stringify(data1)}`);

  if (data1.result?.[0]?.updated === true) {
    console.log(`   ✅ УСПЕХ через product_id!`);
    return;
  }

  // Попытка 2: через offer_id
  console.log(`\n📤 Попытка 2: через offer_id`);
  const payload2 = {
    prices: [{
      offer_id: offerId,
      price: String(currentPrice),
      old_price: String(oldPrice || currentPrice * 1.2),
      currency_code: 'RUB',
    }],
  };
  console.log(`   Payload: ${JSON.stringify(payload2)}`);

  const response2 = await fetch('https://api-seller.ozon.ru/v1/product/import/prices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': clientId,
      'Api-Key': apiKey,
    },
    body: JSON.stringify(payload2),
  });

  console.log(`   Status: ${response2.status}`);
  const data2 = await response2.json() as any;
  console.log(`   Response: ${JSON.stringify(data2)}`);

  if (data2.result?.[0]?.updated === true) {
    console.log(`   ✅ УСПЕХ через offer_id!`);
  } else {
    console.log(`\n❌ Обе попытки не сработали`);
    console.log(`   Возможные причины:`);
    console.log(`   1. Товар в акции Ozon (цену нельзя менять)`);
    console.log(`   2. Недостаточно прав API ключа`);
    console.log(`   3. Другие ограничения Ozon`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Тест завершён');
}

main().catch(console.error);

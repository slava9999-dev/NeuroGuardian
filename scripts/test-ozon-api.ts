/**
 * 🔍 ТЕСТ: Почему Sentinel не может изменить цену на Ozon?
 *
 * Проверяем API Ozon для update цен
 */

import 'dotenv/config';
import { sql } from '@vercel/postgres';
import { decryptApiKey } from '../src/api-lib/lib/crypto.js';

async function main() {
  console.log('🔍 ТЕСТ OZON API');
  console.log('='.repeat(60));
  console.log();

  // 1. Получаем ключи первого пользователя
  // NOTE: users.id IS the Telegram user ID (no separate telegram_id column)
  const userRes = await sql`
    SELECT id, first_name, api_key_ozon, ozon_client_id
    FROM users 
    WHERE protection_enabled = true
    LIMIT 1
  `;

  if (userRes.rows.length === 0) {
    console.error('❌ Нет пользователей с protection_enabled');
    return;
  }

  const user = userRes.rows[0];
  console.log(`👤 Пользователь: ${user.first_name} (ID: ${user.id})`);
  console.log();

  // 2. Проверяем ключи
  console.log('🔑 ПРОВЕРКА КЛЮЧЕЙ:');

  const hasOzonKey = !!user.api_key_ozon;
  const hasClientId = !!user.ozon_client_id;

  console.log(`   api_key_ozon: ${hasOzonKey ? '✅ Есть (зашифрован)' : '❌ Отсутствует'}`);
  console.log(`   ozon_client_id: ${hasClientId ? '✅ Есть' : '❌ Отсутствует'}`);
  console.log();

  if (!hasOzonKey) {
    console.error('❌ Ozon API ключ не настроен у пользователя!');
    return;
  }

  // 3. Попытка расшифровки
  console.log('🔐 РАСШИФРОВКА КЛЮЧЕЙ:');

  let clientId = '';
  let apiKey = '';

  // Пробуем формат "CLIENT_ID:API_KEY"
  const decryptedOzon = decryptApiKey(user.api_key_ozon);

  if (decryptedOzon?.includes(':')) {
    const [cid, akey] = decryptedOzon.split(':');
    clientId = cid;
    apiKey = akey;
    console.log(`   Формат: CLIENT_ID:API_KEY`);
  } else if (user.ozon_client_id) {
    clientId = decryptApiKey(user.ozon_client_id);
    apiKey = decryptedOzon;
    console.log(`   Формат: Отдельные поля`);
  }

  if (!clientId || !apiKey) {
    console.error('❌ Не удалось получить Ozon ключи!');
    console.log(`   Raw api_key_ozon: ${user.api_key_ozon?.substring(0, 20)}...`);
    return;
  }

  console.log(`   Client ID: ${clientId.substring(0, 5)}...`);
  console.log(`   API Key: ${apiKey.substring(0, 10)}...`);
  console.log();

  // 4. Тест API - получаем цену одного товара
  console.log('📡 ТЕСТ OZON API:');

  // Получаем один товар
  const productRes = await sql`
    SELECT product_id, title, current_price, min_price 
    FROM products 
    WHERE marketplace = 'Ozon' AND min_price > 0
    LIMIT 1
  `;

  if (productRes.rows.length === 0) {
    console.log('   Нет товаров Ozon с min_price');
    return;
  }

  const product = productRes.rows[0];
  const ozonId = parseInt(String(product.product_id).replace('ozon-', ''));

  console.log(`   Товар: ${product.title?.substring(0, 40)}...`);
  console.log(`   Ozon ID: ${ozonId}`);
  console.log(`   Цена в БД: ${product.current_price}₽`);
  console.log(`   Min Price: ${product.min_price}₽`);
  console.log();

  // 5. Запрос текущей цены с Ozon API
  console.log('📥 ЗАПРОС ЦЕНЫ С OZON:');

  try {
    const response = await fetch('https://api-seller.ozon.ru/v5/product/info/prices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
      body: JSON.stringify({
        filter: {
          product_id: [ozonId],
          visibility: 'ALL',
        },
        cursor: '',
        limit: 1,
      }),
    });

    console.log(`   Status: ${response.status}`);

    if (response.ok) {
      const data = (await response.json()) as {
        result?: { items?: Array<{ price?: { price?: string } }> };
      };
      const item = data.result?.items?.[0];

      if (item) {
        const price = parseFloat(item.price?.price || '0');
        console.log(`   ✅ Текущая цена на Ozon: ${price}₽`);
        console.log(`   Цена в БД: ${product.current_price}₽`);

        if (price !== product.current_price) {
          console.log(`   ⚠️ РАСХОЖДЕНИЕ! БД: ${product.current_price}₽ vs Ozon: ${price}₽`);
        }

        if (price < product.min_price) {
          console.log(`   🚨 УГРОЗА! Цена ${price}₽ НИЖЕ min_price ${product.min_price}₽`);
        }
      } else {
        console.log('   ⚠️ Товар не найден в ответе API');
      }
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Ошибка API: ${errorText}`);
    }
  } catch (error) {
    console.error('   ❌ Ошибка запроса:', error);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('✅ Тест завершён');
}

main().catch(console.error);

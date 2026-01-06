/**
 * 🛡️ ТЕСТ ПОЛНОГО ЦИКЛА ЗАЩИТЫ SENTINEL
 * 
 * Проверяем:
 * 1. Найти товар где цена ниже stop-loss
 * 2. Попробовать изменить цену на min_price
 * 3. Проверить результат
 */

import 'dotenv/config';
import { sql } from '@vercel/postgres';

// Функция для получения цен (скопировано из исправленного кода)
async function fetchOzonCurrentPrices(
  clientId: string,
  apiKey: string,
  productIds: number[]
): Promise<Map<number, number>> {
  const priceMap = new Map<number, number>();
  if (productIds.length === 0) return priceMap;
  
  const validIds = Array.from(new Set(productIds.filter(id => typeof id === 'number' && id > 0)));
  if (validIds.length === 0) return priceMap;

  const requestedIds = new Set(validIds);
  let cursor = '';
  let pageCount = 0;

  while (pageCount < 10) {
    pageCount++;
    
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

    if (!response.ok) break;

    const data = await response.json() as any;
    const items = data.items || [];

    for (const p of items) {
      const pid = Number(p.product_id);
      if (requestedIds.has(pid)) {
        const priceObj = p.price || {};
        const actualPrice = parseFloat(priceObj.price || '0');
        if (actualPrice > 0) {
          priceMap.set(pid, Math.round(actualPrice));
        }
      }
    }

    if (priceMap.size >= validIds.length) break;

    const nextCursor = data.cursor || '';
    if (!nextCursor || nextCursor === cursor || items.length < 1000) break;
    cursor = nextCursor;
  }

  return priceMap;
}

// Функция для изменения цены на Ozon
async function updateOzonPrice(
  clientId: string,
  apiKey: string,
  productId: number,
  newPrice: number,
  offerId?: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`\n📤 ПОПЫТКА ИЗМЕНИТЬ ЦЕНУ:`);
  console.log(`   Product ID: ${productId}`);
  console.log(`   Новая цена: ${newPrice}₽`);
  console.log(`   Offer ID: ${offerId || 'не указан'}`);

  // Ozon требует offer_id для update цен
  // Но можно попробовать с product_id тоже
  
  const payload = {
    prices: [{
      product_id: productId,
      price: String(newPrice),
      old_price: String(Math.round(newPrice * 1.2)), // +20% как старая цена
      currency_code: 'RUB',
    }],
  };

  console.log(`   Payload: ${JSON.stringify(payload)}`);

  try {
    const response = await fetch('https://api-seller.ozon.ru/v1/product/import/prices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    console.log(`   Response status: ${response.status}`);

    const data = await response.json() as any;
    console.log(`   Response: ${JSON.stringify(data)}`);

    if (response.ok) {
      const result = data.result?.[0];
      if (result?.updated === true) {
        return { success: true };
      } else if (result?.errors?.length > 0) {
        return { success: false, error: result.errors.map((e: any) => e.message).join('; ') };
      }
      return { success: true };
    } else {
      return { success: false, error: data.message || data.error || 'Unknown error' };
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function main() {
  console.log('🛡️ ТЕСТ ПОЛНОГО ЦИКЛА ЗАЩИТЫ SENTINEL');
  console.log('='.repeat(70));

  // 1. Получаем ключи
  const userRes = await sql`
    SELECT id, first_name, api_key_ozon 
    FROM users WHERE protection_enabled = true LIMIT 1
  `;
  const user = userRes.rows[0];
  const [clientId, apiKey] = (user.api_key_ozon as string).split(':');
  
  console.log(`\n👤 Пользователь: ${user.first_name}`);

  // 2. Получаем товары с min_price
  const productsRes = await sql`
    SELECT product_id, title, current_price, min_price, offer_id
    FROM products 
    WHERE marketplace = 'Ozon' AND min_price > 0
    LIMIT 10
  `;

  console.log(`\n📦 Товаров с min_price: ${productsRes.rows.length}`);

  // 3. Получаем РЕАЛЬНЫЕ цены с Ozon
  const ozonIds = productsRes.rows
    .map(p => parseInt(String(p.product_id).replace('ozon-', '')))
    .filter(id => id > 0);

  console.log(`\n📡 Запрашиваем реальные цены для ${ozonIds.length} товаров...`);
  const priceMap = await fetchOzonCurrentPrices(clientId, apiKey, ozonIds);
  console.log(`   Получено: ${priceMap.size} цен`);

  // 4. Ищем товары где цена < min_price (STOP-LOSS VIOLATION!)
  console.log('\n🔍 ПРОВЕРКА STOP-LOSS:');
  console.log('-'.repeat(70));

  const violations: Array<{
    productId: number;
    title: string;
    currentPrice: number;
    minPrice: number;
    offerId: string | null;
  }> = [];

  for (const product of productsRes.rows) {
    const ozonId = parseInt(String(product.product_id).replace('ozon-', ''));
    const realPrice = priceMap.get(ozonId);
    const minPrice = product.min_price;

    if (realPrice && minPrice) {
      const status = realPrice < minPrice ? '🚨 VIOLATION!' : '✅ OK';
      console.log(`   ${ozonId}: ${realPrice}₽ vs min ${minPrice}₽ ${status}`);
      
      if (realPrice < minPrice) {
        violations.push({
          productId: ozonId,
          title: product.title,
          currentPrice: realPrice,
          minPrice: minPrice,
          offerId: product.offer_id,
        });
      }
    }
  }

  console.log('-'.repeat(70));
  console.log(`\n⚠️ Найдено нарушений: ${violations.length}`);

  if (violations.length === 0) {
    console.log('\n✅ Все цены в норме! Stop-Loss нарушений нет.');
    console.log('\n💡 Чтобы протестировать защиту:');
    console.log('   1. Добавьте товар в акцию на Ozon (снизьте цену)');
    console.log('   2. Или установите min_price выше текущей цены');
    console.log('   3. Дождитесь следующего цикла Sentinel (каждые 30 минут)');
    return;
  }

  // 5. Попробуем исправить первое нарушение!
  console.log('\n🛡️ ПОПЫТКА ЗАЩИТЫ:');
  const violation = violations[0];
  console.log(`   Товар: ${violation.title?.substring(0, 50)}...`);
  console.log(`   Текущая цена: ${violation.currentPrice}₽`);
  console.log(`   Min Price (Stop-Loss): ${violation.minPrice}₽`);
  console.log(`   Нужно поднять на: ${violation.minPrice - violation.currentPrice}₽`);

  // Попытка изменить цену
  const updateResult = await updateOzonPrice(
    clientId,
    apiKey,
    violation.productId,
    violation.minPrice,
    violation.offerId || undefined
  );

  console.log('\n📊 РЕЗУЛЬТАТ:');
  if (updateResult.success) {
    console.log('   ✅ ЦЕНА УСПЕШНО ИЗМЕНЕНА!');
    console.log(`   Новая цена: ${violation.minPrice}₽`);
  } else {
    console.log('   ❌ ОШИБКА ИЗМЕНЕНИЯ ЦЕНЫ:');
    console.log(`   ${updateResult.error}`);
    
    // Подсказка что может быть не так
    if (updateResult.error?.includes('offer_id')) {
      console.log('\n   💡 ПОДСКАЗКА: Нужен offer_id для изменения цены!');
      console.log('      В БД offer_id = null, но Ozon API требует его.');
      console.log('      Нужно синхронизировать offer_id из Ozon в БД.');
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Тест завершён');
}

main().catch(console.error);

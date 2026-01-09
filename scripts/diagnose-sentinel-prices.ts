/**
 * 🔍 ДИАГНОСТИКА SENTINEL: Проверка получения цен
 *
 * Запуск: npx tsx scripts/diagnose-sentinel-prices.ts
 */

import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function main() {
  console.log('🔍 ДИАГНОСТИКА SENTINEL');
  console.log('='.repeat(60));
  console.log();

  console.log('📋 ПРОВЕРКА КОНФИГУРАЦИИ:');
  console.log(`   POSTGRES_URL: ${process.env.POSTGRES_URL ? '✅ Настроен' : '❌ Отсутствует'}`);
  console.log();

  if (!process.env.POSTGRES_URL) {
    console.error('❌ POSTGRES_URL не настроен!');
    process.exit(1);
  }

  try {
    // 1. Пользователи
    // NOTE: users.id IS the Telegram user ID (no separate telegram_id column)
    console.log('👥 ПОЛЬЗОВАТЕЛИ С ЗАЩИТОЙ:');
    const usersRes = await sql`
      SELECT id, id as telegram_id, first_name, protection_enabled, subscription_active
      FROM users 
      WHERE protection_enabled = true OR subscription_active = true
    `;

    console.log(`   Найдено: ${usersRes.rows.length} пользователей`);
    for (const user of usersRes.rows) {
      console.log(
        `   - ID ${user.id}: ${user.first_name || 'Без имени'} (Telegram ID: ${user.id})`
      );
    }
    console.log();

    // 2. Товары для мониторинга
    console.log('📦 ТОВАРЫ ДЛЯ МОНИТОРИНГА:');
    const productsRes = await sql`
      SELECT 
        id, product_id, title, marketplace, 
        current_price, min_price, is_monitored, updated_at
      FROM products 
      WHERE is_monitored = true OR min_price > 0
      ORDER BY marketplace, id
      LIMIT 20
    `;

    console.log(`   Найдено: ${productsRes.rows.length} товаров (показываю первые 20)`);
    console.log();

    const wbProducts = productsRes.rows.filter(p => p.marketplace === 'WB');
    const ozonProducts = productsRes.rows.filter(p => p.marketplace === 'Ozon');

    console.log(`   🟣 Wildberries: ${wbProducts.length} товаров`);
    console.log(`   🔵 Ozon: ${ozonProducts.length} товаров`);
    console.log();

    // 3. Детали товаров
    console.log('📊 ДЕТАЛИ OZON ТОВАРОВ (первые 10):');
    console.log('-'.repeat(95));
    console.log(
      'ID'.padEnd(8) +
        'Ozon ID'.padEnd(15) +
        'Цена в БД'.padEnd(12) +
        'Min Price'.padEnd(12) +
        'Monitored'.padEnd(10) +
        'Название'
    );
    console.log('-'.repeat(95));

    for (const p of ozonProducts.slice(0, 10)) {
      const ozonId = String(p.product_id).replace('ozon-', '');
      console.log(
        String(p.id).padEnd(8) +
          ozonId.padEnd(15) +
          (p.current_price ? `${p.current_price}₽` : 'N/A').padEnd(12) +
          (p.min_price ? `${p.min_price}₽` : '❌ Нет').padEnd(12) +
          (p.is_monitored ? '✅' : '❌').padEnd(10) +
          String(p.title || 'Без названия').substring(0, 35)
      );
    }
    console.log('-'.repeat(95));
    console.log();

    // 4. Статистика
    console.log('📈 СТАТИСТИКА:');
    const statsRes = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN min_price > 0 THEN 1 END) as with_min_price,
        COUNT(CASE WHEN min_price IS NULL OR min_price = 0 THEN 1 END) as without_min_price,
        COUNT(CASE WHEN is_monitored = true THEN 1 END) as monitored
      FROM products
    `;

    const stats = statsRes.rows[0];
    console.log(`   📦 Всего товаров: ${stats.total}`);
    console.log(`   🛡️ С min_price (Stop-Loss): ${stats.with_min_price}`);
    console.log(`   ❌ БЕЗ min_price: ${stats.without_min_price}`);
    console.log(`   👁️ is_monitored = true: ${stats.monitored}`);
    console.log();

    // 5. Проверка логов
    console.log('⚠️ ПОСЛЕДНИЕ ЗАПИСИ SENTINEL (5):');
    const logsRes = await sql`
      SELECT 
        id, product_title, detected_price, min_price, 
        defense_action, threat_type, success, created_at
      FROM sentinel_logs
      ORDER BY created_at DESC
      LIMIT 5
    `;

    if (logsRes.rows.length === 0) {
      console.log('   📭 Нет записей в sentinel_logs');
    } else {
      for (const l of logsRes.rows) {
        const time = new Date(l.created_at).toLocaleTimeString('ru-RU');
        console.log(
          `   ${time}: ${l.threat_type} → ${l.defense_action} (${l.success ? '✅' : '❌'})`
        );
        console.log(`      Товар: ${String(l.product_title || '').substring(0, 40)}...`);
        console.log(`      Цена: ${l.detected_price}₽, Min: ${l.min_price}₽`);
      }
    }
    console.log();

    // 6. ДИАГНОЗ
    console.log('='.repeat(60));
    console.log('🔬 ДИАГНОЗ:');
    console.log();

    // Проверка 1: Есть ли min_price?
    const withMinPrice = parseInt(String(stats.with_min_price) || '0');
    const total = parseInt(String(stats.total) || '0');

    if (withMinPrice === 0) {
      console.log('   ⚠️ КРИТИЧНО: Ни один товар НЕ имеет min_price!');
      console.log('   → Sentinel не может защитить цену без min_price');
      console.log('   → Нужно установить min_price для товаров');
    } else if (withMinPrice < total) {
      console.log(`   ℹ️ ${withMinPrice}/${total} товаров имеют min_price`);
    } else {
      console.log('   ✅ Все товары имеют min_price');
    }
    console.log();

    // Проверка 2: В БД нет колонки cost_price!
    console.log('   ⚠️ ФАКТ: В таблице products НЕТ колонки cost_price!');
    console.log('   → Sentinel ВСЕГДА использует оценочную себестоимость');
    console.log('   → isEstimated = true для ВСЕХ товаров');
    console.log('   → Warnings по марже НЕ должны создаваться (по текущему коду)');
    console.log();

    console.log('='.repeat(60));
    console.log('✅ Диагностика завершена');
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

main();

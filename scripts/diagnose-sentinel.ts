import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function diagnose() {
  console.log('🔍 Диагностика БД Sentinel...');

  // Исправлено: используем username вместо email
  const users =
    await sql`SELECT id, username, first_name, protection_enabled, subscription_active, is_active FROM users`;
  console.log('\n👥 ПОЛЬЗОВАТЕЛИ:');
  console.table(users.rows);

  const stats = await sql`
    SELECT 
      marketplace, 
      COUNT(*) as count, 
      COUNT(*) FILTER (WHERE is_monitored = true) as monitored 
    FROM products 
    GROUP BY marketplace
  `;
  console.log('\n📦 ТОВАРЫ:');
  console.table(stats.rows);

  const activeKeys =
    await sql`SELECT user_id, marketplace, length(wb_token) as wb_len, length(ozon_api_key) as ozon_len FROM marketplace_accounts`;
  console.log('\n🔑 КЛЮЧИ API (Marketplace Accounts):');
  console.table(activeKeys.rows);

  const legacyKeys = await sql`
    SELECT id, username, 
      CASE WHEN api_key_wb IS NOT NULL THEN 'Yes' ELSE 'No' END as has_wb,
      CASE WHEN api_key_ozon IS NOT NULL THEN 'Yes' ELSE 'No' END as has_ozon
    FROM users
    WHERE api_key_wb IS NOT NULL OR api_key_ozon IS NOT NULL
  `;
  console.log('\n🔑 КЛЮЧИ API (Legacy Users Table):');
  console.table(legacyKeys.rows);
}

diagnose().catch(console.error);

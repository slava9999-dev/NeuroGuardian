import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });
import { sql } from '@vercel/postgres';

async function migrate() {
  console.log('🏗️ Запуск миграции базы данных...');

  try {
    // 1. Добавляем колонку details в sentinel_logs
    console.log('- Проверка таблицы sentinel_logs...');
    await sql`
      ALTER TABLE sentinel_logs 
      ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}';
    `;
    console.log('✅ Колонка details добавлена (или уже была).');

    // 2. Создаем таблицу price_rules (если её нет)
    console.log('- Проверка таблицы price_rules...');
    await sql`
      CREATE TABLE IF NOT EXISTS price_rules (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        product_id CHARACTER VARYING(255) NOT NULL,
        min_price INTEGER NOT NULL,
        max_price INTEGER NOT NULL,
        target_margin DECIMAL(5,2) DEFAULT 10.00,
        competitor_tracking BOOLEAN DEFAULT false,
        competitor_nmids TEXT,
        price_match_strategy CHARACTER VARYING(50) DEFAULT 'none',
        undercut_amount DECIMAL(10,2) DEFAULT 0,
        undercut_type CHARACTER VARYING(20) DEFAULT 'absolute',
        auto_adjust BOOLEAN DEFAULT false,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Таблица price_rules готова.');

    console.log('\n✨ Миграция успешно завершена!');
  } catch (err) {
    console.error('\n❌ Ошибка при миграции:', err);
    process.exit(1);
  }
}

migrate().catch(console.error);

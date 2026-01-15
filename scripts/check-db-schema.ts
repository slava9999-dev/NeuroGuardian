import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });
config({ path: path.resolve(process.cwd(), '.env.local') });

import { sql } from '../src/api-lib/services/database.js';

async function checkSchema() {
  console.log('🔍 Checking products table schema...');

  try {
    // Check for duplicates
    const duplicates = await sql`
      SELECT product_id, COUNT(*) 
      FROM products 
      GROUP BY product_id 
      HAVING COUNT(*) > 1
    `;

    if (duplicates.rows.length > 0) {
      console.warn('⚠️ Found duplicates in product_id:', duplicates.rows);
    } else {
      console.log('✅ No duplicates found in product_id. Safe to add UNIQUE constraint.');
    }

    // Check existing indexes
    const indexes = await sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'products'
    `;
    console.log(
      '📊 Existing indexes:',
      indexes.rows.map(r => r.indexname)
    );
  } catch (err) {
    console.error('❌ Check failed:', err);
  }
}

checkSchema();

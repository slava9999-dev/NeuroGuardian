// ============================================
// NeuroGUARDIAN — Fix Products Schema
// Deduplicates products and adds constraints
// Version: 1.0.0
// ============================================

import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });
config({ path: path.resolve(process.cwd(), '.env.local') });

import { sql } from '../src/api-lib/services/database.js';

async function fixSchema() {
  console.log('🔧 Starting schema repair...');

  try {
    // 1. Deduplicate
    console.log('🧹 Removing duplicate products (keeping latest)...');

    // Delete all rows that have a product_id that appears elsewhere with a higher id
    await sql`
      DELETE FROM products a
      USING products b
      WHERE a.product_id = b.product_id 
      AND a.id < b.id
    `;

    console.log('✅ Duplicates removed');

    // 2. Add Unique Constraint
    console.log('🔒 Adding UNIQUE constraint to product_id...');

    // Check if constraint exists first to avoid error
    try {
      await sql`
        ALTER TABLE products 
        ADD CONSTRAINT products_product_id_key UNIQUE (product_id)
      `;
      console.log('✅ UNIQUE constraint added');
    } catch (e: any) {
      if (e.code === '42710') {
        // duplicate_object
        console.log('ℹ️  UNIQUE constraint already exists');
      } else {
        throw e;
      }
    }

    console.log('\n✨ Database is now ready for Media migration!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Repair failed:', error);
    process.exit(1);
  }
}

fixSchema();

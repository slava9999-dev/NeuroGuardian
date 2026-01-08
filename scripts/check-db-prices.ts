/**
 * DIAGNOSTIC: Check current product prices in database
 *
 * Run: npx tsx scripts/check-db-prices.ts
 */

import 'dotenv/config';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.production' });

async function checkPrices() {
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ No database URL found!');
    process.exit(1);
  }

  const sql = neon(dbUrl);

  console.log('🔍 Checking product prices in database...\n');

  try {
    const products = await sql`
      SELECT product_id, title, current_price, min_price, marketplace, nm_id
      FROM products
      WHERE marketplace = 'WB'
      ORDER BY current_price DESC
      LIMIT 10
    `;

    console.log('═══════════════════════════════════════════════════════');
    console.log('  Top 10 WB Products by current_price');
    console.log('═══════════════════════════════════════════════════════\n');

    for (const p of products) {
      const priceStatus = p.current_price > 100000 ? '🔴 SUSPICIOUS!' : '🟢';
      console.log(`${priceStatus} nmId: ${p.nm_id}`);
      console.log(`   Title: ${p.title?.substring(0, 40)}...`);
      console.log(`   current_price: ${p.current_price?.toLocaleString()}₽`);
      console.log(`   min_price: ${p.min_price?.toLocaleString()}₽`);
      console.log('');
    }

    // Summary
    const suspicious = products.filter((p: any) => p.current_price > 100000);
    if (suspicious.length > 0) {
      console.log('═══════════════════════════════════════════════════════');
      console.log(`⚠️  Found ${suspicious.length} products with price > 100,000₽`);
      console.log('   This suggests prices are stored incorrectly (possibly in kopecks)');
      console.log('═══════════════════════════════════════════════════════');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPrices();

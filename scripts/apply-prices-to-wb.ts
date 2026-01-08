/**
 * EMERGENCY SCRIPT: Apply min_price to WB for all products
 * 
 * This script reads products from DB and sends correct prices to WB
 * Run: npx tsx scripts/apply-prices-to-wb.ts
 */

import 'dotenv/config';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.production' });

async function applyPrices() {
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ No database URL found!');
    process.exit(1);
  }

  const sql = neon(dbUrl);

  console.log('🔧 Applying min_price to WB for all products...\n');

  try {
    // Get all WB products with min_price set
    const products = await sql`
      SELECT 
        product_id, title, nm_id, min_price, current_price
      FROM products
      WHERE marketplace = 'WB'
      AND min_price > 0
      AND nm_id IS NOT NULL
      ORDER BY nm_id
    `;

    if (products.length === 0) {
      console.log('⚠️  No WB products with min_price found');
      return;
    }

    console.log(`📦 Found ${products.length} products to update:\n`);

    // Use WB API key from environment
    const wbApiKey = process.env.WB_API_KEY;
    
    if (!wbApiKey) {
      console.error('❌ WB_API_KEY not set in environment!');
      console.log('Add WB_API_KEY=your_key to .env or .env.production');
      return;
    }

    // Build payload - deduplicate by nm_id (keep last/highest min_price)
    const productMap = new Map<number, { nmId: number; price: number; title: string }>();
    for (const p of products) {
      // Keep the one with higher min_price in case of duplicates
      const existing = productMap.get(p.nm_id);
      if (!existing || p.min_price > existing.price) {
        productMap.set(p.nm_id, {
          nmId: p.nm_id,
          price: p.min_price,
          title: p.title,
        });
      }
    }

    const updates = Array.from(productMap.values());

    console.log(`Products to update (${updates.length} unique):`);
    for (const u of updates) {
      console.log(`  ${u.nmId}: "${u.title?.substring(0, 30)}..." → ${u.price}₽`);
    }

    // Call WB API directly (prices in RUBLES - WB API accepts rubles for upload/task)
    const payload = {
      data: updates.map(u => ({
        nmId: u.nmId,
        price: u.price, // RUBLES
        discount: 0,
      })),
    };

    console.log('\n📡 Sending to WB API...');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(
      'https://discounts-prices-api.wildberries.ru/api/v2/upload/task',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: wbApiKey,
        },
        body: JSON.stringify(payload),
      }
    );

    const responseText = await response.text();
    console.log(`\n📡 Response (${response.status}):`, responseText);

    if (response.ok) {
      console.log('\n✅ Prices submitted to WB!');
      console.log('⚠️  WB processes price changes asynchronously.');
      console.log('   Check WB Partner portal in 1-2 minutes.');

      // Update current_price in DB
      for (const p of products) {
        await sql`
          UPDATE products
          SET current_price = ${p.min_price}, updated_at = NOW()
          WHERE nm_id = ${p.nm_id}
        `;
      }
      console.log(`\n✅ Updated ${products.length} products in DB`);
    } else {
      console.log('\n❌ Failed to update prices!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

applyPrices();

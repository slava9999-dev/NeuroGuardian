/**
 * EMERGENCY: Apply prices one by one to find problematic products
 */

import 'dotenv/config';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.production' });

async function applyPricesOneByOne() {
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const wbApiKey = process.env.WB_API_KEY;
  
  if (!dbUrl || !wbApiKey) {
    console.error('❌ Missing DB URL or WB_API_KEY!');
    process.exit(1);
  }

  const sql = neon(dbUrl);

  console.log('🔧 Applying prices one by one...\n');

  const products = await sql`
    SELECT DISTINCT ON (nm_id) 
      product_id, title, nm_id, min_price
    FROM products
    WHERE marketplace = 'WB'
    AND min_price > 0
    AND nm_id IS NOT NULL
    ORDER BY nm_id, min_price DESC
  `;

  console.log(`Found ${products.length} unique products\n`);

  let success = 0;
  let failed = 0;

  for (const p of products) {
    const payload = {
      data: [{
        nmId: Number(p.nm_id),
        price: Number(p.min_price),
        discount: 0,
      }]
    };

    try {
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

      const text = await response.text();
      const result = JSON.parse(text);

      if (response.ok && !result.error) {
        console.log(`✅ ${p.nm_id}: ${p.min_price}₽ - OK`);
        success++;
        
        // Update DB
        await sql`
          UPDATE products
          SET current_price = ${p.min_price}, updated_at = NOW()
          WHERE nm_id = ${p.nm_id}
        `;
      } else {
        console.log(`❌ ${p.nm_id}: ${p.min_price}₽ - FAILED: ${result.errorText || text}`);
        failed++;
      }
    } catch (e) {
      console.log(`❌ ${p.nm_id}: ERROR - ${e}`);
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n═══════════════════════════════════`);
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`═══════════════════════════════════`);
}

applyPricesOneByOne();

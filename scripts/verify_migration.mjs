import { sql } from '../src/api-lib/services/database.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function verify() {
  console.log('📊 --- DETAILED PRODUCT & ACCOUNT DISTRIBUTION ---');
  try {
    // 1. Check Accounts
    const accs = await sql`
      SELECT id, user_id, name, marketplace, ozon_client_id 
      FROM marketplace_accounts
    `;
    console.log('\nMarketplace Accounts:');
    console.table(accs.rows);

    // 2. Check Product counts per User and Marketplace
    const prods = await sql`
      SELECT 
        u.first_name as user_name, 
        p.marketplace, 
        count(*) as total_count,
        count(p.account_id) as linked_to_account
      FROM products p
      JOIN users u ON p.user_id::text = u.id::text
      GROUP BY u.first_name, p.marketplace
      ORDER BY u.first_name, p.marketplace
    `;
    console.log('\nProduct Distribution:');
    console.table(prods.rows);

    // 3. Check for any products with NULL account_id
    const unlinked = await sql`
      SELECT marketplace, count(*) 
      FROM products 
      WHERE account_id IS NULL
      GROUP BY marketplace
    `;
    if (unlinked.rows.length > 0) {
        console.log('\n⚠️ UNLINKED PRODUCTS FOUND:');
        console.table(unlinked.rows);
    } else {
        console.log('\n✅ All products are linked to marketplace accounts.');
    }

  } catch (e) {
    console.error('Verify failed:', e);
  }
  process.exit(0);
}

verify();

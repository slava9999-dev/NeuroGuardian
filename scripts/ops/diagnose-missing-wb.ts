import { sql } from '../../src/api-lib/services/database.js';

async function diagnoseMissingWB() {
  const userId = '1600992954';

  console.log('--- Checking Marketplace Accounts ---');
  const accounts = await sql`SELECT * FROM marketplace_accounts WHERE user_id = ${userId}`;
  console.table(accounts.rows);

  console.log('--- Checking ALL Products for Alexander ---');
  const products = await sql`
    SELECT id, marketplace, nm_id, product_id, is_monitored, min_price 
    FROM products 
    WHERE user_id = ${userId}
  `;
  console.table(products.rows);

  const wbCount = products.rows.filter(p => p.marketplace === 'WB').length;
  const ozonCount = products.rows.filter(p => p.marketplace === 'Ozon').length;

  console.log(`\nSummary: WB: ${wbCount}, Ozon: ${ozonCount}`);

  process.exit(0);
}

diagnoseMissingWB().catch(console.error);

import { sql } from '../../src/api-lib/services/database.js';

async function mapProductsToAccounts() {
  console.log('--- Account Mapping ---');
  const accounts = await sql`
    SELECT id, user_id, marketplace, name 
    FROM marketplace_accounts 
    WHERE user_id IN ('1600992954', '1634470382', '7548070478')
  `;
  console.table(accounts.rows);

  console.log('\n--- WB Product Distribution ---');
  const wbProducts = await sql`
    SELECT user_id, account_id, COUNT(*) 
    FROM products 
    WHERE marketplace = 'WB' 
    GROUP BY user_id, account_id
  `;
  console.table(wbProducts.rows);

  process.exit(0);
}

mapProductsToAccounts().catch(console.error);

import { sql } from '../../src/api-lib/services/database.js';

async function findWbProducts() {
  console.log('--- Searching for ANY WB Products ---');
  const allWb = await sql`
    SELECT user_id, COUNT(*) 
    FROM products 
    WHERE marketplace = 'WB' 
    GROUP BY user_id
  `;
  console.table(allWb.rows);

  console.log('\n--- Searching for WB products by title or nm_id (if we knew them) ---');
  // Since we don't know the titles, let's just look at the last 50 added products
  const lastProducts = await sql`
    SELECT id, user_id, marketplace, title, nm_id, created_at 
    FROM products 
    ORDER BY created_at DESC 
    LIMIT 50
  `;
  console.table(lastProducts.rows);

  process.exit(0);
}

findWbProducts().catch(console.error);

import { sql } from '../../src/api-lib/services/database.js';

async function checkCounts() {
  const userId = '1600992954';

  const res = await sql`
    SELECT 
      marketplace, 
      is_monitored, 
      (min_price > 0) as has_min_price, 
      COUNT(*) 
    FROM products 
    WHERE user_id = ${userId} 
    GROUP BY marketplace, is_monitored, has_min_price
  `;

  console.log('📊 Product counts for Alexander (1600992954):');
  console.table(res.rows);

  const total = await sql`SELECT COUNT(*) FROM products WHERE user_id = ${userId}`;
  console.log(`Total products in DB: ${total.rows[0].count}`);

  process.exit(0);
}

checkCounts().catch(err => {
  console.error(err);
  process.exit(1);
});

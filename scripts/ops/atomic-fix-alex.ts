import { sql } from '../../src/api-lib/services/database.js';

async function fixAlexanderProducts() {
  const targetUserId = '1600992954';
  const targetAccountId = 8; // Alexander - WB
  const sourceUserId = '1634470382'; // Tatiana (source of 22 WB products)

  console.log('🛠 Atomic Fix: Cloning 22 WB products for Alexander...');

  try {
    const result = await sql`
      INSERT INTO products (
        user_id, account_id, marketplace, product_id, nm_id, 
        title, current_price, min_price, is_monitored, 
        created_at, updated_at
      ) 
      SELECT 
        ${targetUserId}, 
        ${targetAccountId}, 
        marketplace, 
        product_id, 
        nm_id, 
        title, 
        current_price, 
        0, 
        true, 
        NOW(), 
        NOW()
      FROM products 
      WHERE user_id = ${sourceUserId} AND marketplace = 'WB'
      ON CONFLICT (user_id, product_id) DO UPDATE SET
        account_id = EXCLUDED.account_id,
        is_monitored = true,
        updated_at = NOW()
      RETURNING id
    `;

    console.log(`✅ Success! Affected rows: ${result.rows.length}`);

    // Final check
    const counts = await sql`
      SELECT marketplace, COUNT(*) 
      FROM products 
      WHERE user_id = ${targetUserId} 
      GROUP BY marketplace
    `;
    console.table(counts.rows);

    process.exit(0);
  } catch (err) {
    console.error('💥 Atomic fix failed:', err);
    process.exit(1);
  }
}

fixAlexanderProducts();

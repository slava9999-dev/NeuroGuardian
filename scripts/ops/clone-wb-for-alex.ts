import { sql } from '../../src/api-lib/services/database.js';

async function cloneWbProducts() {
  const targetUserId = '1600992954'; // Alexander
  const targetAccountId = 8; // Александр - WB
  const sourceUserId = '1634470382'; // Tatiana (has 22 WB products)

  console.log(`🚀 Cloning 22 WB products from ${sourceUserId} to ${targetUserId}...`);

  try {
    // 1. Get source products
    const sourceProducts = await sql`
      SELECT * FROM products 
      WHERE user_id = ${sourceUserId} AND marketplace = 'WB'
    `;

    console.log(`Found ${sourceProducts.rows.length} source products.`);

    if (sourceProducts.rows.length === 0) {
      console.log('❌ Source products not found.');
      process.exit(1);
    }

    // 2. Insert for Alexander
    let clonedCount = 0;
    for (const p of sourceProducts.rows) {
      await sql`
        INSERT INTO products (
          user_id, account_id, marketplace, product_id, nm_id, 
          title, current_price, min_price, is_monitored, 
          created_at, updated_at
        ) VALUES (
          ${targetUserId}, 
          ${targetAccountId}, 
          ${p.marketplace}, 
          ${p.product_id}, 
          ${p.nm_id}, 
          ${p.title}, 
          ${p.current_price}, 
          ${p.min_price || 0}, 
          true, 
          NOW(), 
          NOW()
        )
        ON CONFLICT (user_id, product_id) DO UPDATE SET
          account_id = EXCLUDED.account_id,
          is_monitored = true,
          updated_at = NOW()
      `;
      clonedCount++;
    }

    console.log(`✅ Successfully cloned/updated ${clonedCount} WB products for Alexander.`);

    // 3. Final Verification
    const finalCount = await sql`SELECT COUNT(*) FROM products WHERE user_id = ${targetUserId}`;
    const wbFinal =
      await sql`SELECT COUNT(*) FROM products WHERE user_id = ${targetUserId} AND marketplace = 'WB'`;
    const ozonFinal =
      await sql`SELECT COUNT(*) FROM products WHERE user_id = ${targetUserId} AND marketplace = 'Ozon'`;

    console.log('\n📊 Alexander Final Stats:');
    console.log(`- Total: ${finalCount.rows[0].count}`);
    console.log(`- WB: ${wbFinal.rows[0].count}`);
    console.log(`- Ozon: ${ozonFinal.rows[0].count}`);

    process.exit(0);
  } catch (err) {
    console.error('💥 Clone failed:', err);
    process.exit(1);
  }
}

cloneWbProducts();

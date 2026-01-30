import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

async function diagnose() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('📡 Connected to Neon DB. Examining schema...\n');

    const tables = ['products', 'marketplace_accounts', 'users'];

    for (const table of tables) {
      console.log(`📊 Table: ${table}`);
      const res = await client.query(
        `
        SELECT column_name, data_type, character_maximum_length, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `,
        [table]
      );

      console.table(res.rows);
    }

    // Check for specific records for Tatiana (userId: 1634470382)
    console.log('\n🔍 Checking records for User: 1634470382 (Tatiana)');
    const userCheck = await client.query('SELECT id, first_name FROM users WHERE id = $1', [
      '1634470382',
    ]);
    console.log('User Exists:', userCheck.rows);

    const productsCount = await client.query('SELECT count(*) FROM products WHERE user_id = $1', [
      '1634470382',
    ]);
    console.log('Products Count:', productsCount.rows[0].count);

    const accountsCount = await client.query(
      'SELECT count(*) FROM marketplace_accounts WHERE user_id = $1',
      ['1634470382']
    );
    console.log('Marketplace Accounts Count:', accountsCount.rows[0].count);

    // Test the failing query manually with raw SQL
    console.log('\n⚒️  Testing failing JOIN query...');
    try {
      const joinTest = await client.query(
        `
        SELECT p.id 
        FROM products p 
        LEFT JOIN marketplace_accounts m ON p.account_id = m.id 
        WHERE p.user_id = $1 AND p.is_monitored = true
        LIMIT 5
      `,
        ['1634470382']
      );
      console.log('✅ JOIN Query Success. Results:', joinTest.rowCount);
    } catch (e) {
      console.error('❌ JOIN Query Failed:', e.message);
    }
  } catch (err) {
    console.error('💥 Error:', err);
  } finally {
    await client.end();
  }
}

diagnose();

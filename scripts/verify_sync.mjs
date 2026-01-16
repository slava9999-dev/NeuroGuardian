import pg from 'pg';
import * as dotenv from 'dotenv';
const { Pool } = pg;

dotenv.config();
dotenv.config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: connectionString && !connectionString.includes('localhost') ? { rejectUnauthorized: false } : false
});

async function run() {
  try {
    const telegramId = '7548070478';
    console.log(`--- DB Sync Verification for ID: ${telegramId} ---`);
    
    // Find user
    let userRes = await pool.query('SELECT * FROM users WHERE telegram_id = $1::bigint', [telegramId]);
    if (userRes.rows.length === 0) {
      userRes = await pool.query('SELECT * FROM users WHERE id::text = $1', [telegramId]);
    }

    if (userRes.rows.length === 0) {
      console.log('User not found.');
      process.exit(0);
    }

    const user = userRes.rows[0];
    const userId = user.id;
    console.log(`User: ${user.first_name} (ID: ${userId})`);

    // Check Accounts
    const accountsRes = await pool.query('SELECT id, marketplace, name, is_active FROM marketplace_accounts WHERE user_id::text = $1::text', [userId]);
    console.log(`\nMarketplace accounts (${accountsRes.rows.length}):`);
    console.table(accountsRes.rows);

    // Check Products
    const productsRes = await pool.query('SELECT product_id, nm_id, title, current_price, min_price, cost_price, current_stock, marketplace FROM products WHERE user_id::text = $1::text order by updated_at DESC LIMIT 15', [userId]);
    console.log(`\nProducts in DB (${productsRes.rows.length} of many):`);
    console.table(productsRes.rows.map(p => ({
      ...p,
      title: p.title?.substring(0, 40)
    })));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

run();

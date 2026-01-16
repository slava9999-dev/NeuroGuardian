import pg from 'pg';
import * as dotenv from 'dotenv';
const { Pool } = pg;

dotenv.config();
dotenv.config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: No database connection string found');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function run() {
  try {
    const telegramId = '7548070478';
    console.log(`--- DB DIAGNOSTIC FOR ID: ${telegramId} ---`);
    
    // 1. Check schemas
    const tables = ['users', 'products', 'marketplace_accounts'];
    for (const table of tables) {
      const colRes = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${table}'
      `);
      console.log(`\n[${table.toUpperCase()}] columns:`);
      console.table(colRes.rows);
    }

    // 2. Find user
    console.log('\nSearching for user...');
    // Try matching telegram_id first if it exists, or casting id
    let userRes = await pool.query('SELECT * FROM users WHERE telegram_id = $1::bigint', [telegramId]);
    
    if (userRes.rows.length === 0) {
      console.log('User not found by telegram_id, trying by casting id to string...');
      userRes = await pool.query('SELECT * FROM users WHERE id::text = $1', [telegramId]);
    }

    if (userRes.rows.length === 0) {
      console.log('User not found at all.');
      process.exit(0);
    }

    const user = userRes.rows[0];
    const userId = user.id;
    console.log(`User found: ${user.first_name} (ID: ${userId}, Type: ${typeof userId})`);
    console.log('User meta:', {
      is_active: user.is_active,
      subscription_plan: user.subscription_plan,
      protection_enabled: user.protection_enabled,
      total_products: user.total_products
    });

    // 3. Check Marketplace Accounts
    console.log('\nChecking Marketplace Accounts...');
    const accountsRes = await pool.query('SELECT * FROM marketplace_accounts WHERE user_id::text = $1::text', [userId]);
    console.log(`Found ${accountsRes.rows.length} accounts.`);
    console.table(accountsRes.rows.map(a => ({
      id: a.id,
      name: a.name,
      marketplace: a.marketplace,
      is_active: a.is_active,
      has_wb_token: !!a.wb_token,
      has_ozon_key: !!a.ozon_api_key
    })));

    // 4. Check Products
    console.log('\nChecking Products...');
    const productsRes = await pool.query('SELECT * FROM products WHERE user_id::text = $1::text', [userId]);
    console.log(`Total products in DB: ${productsRes.rows.length}`);
    
    if (productsRes.rows.length > 0) {
      console.log('\nSample products (first 5):');
      console.table(productsRes.rows.slice(0, 5).map(p => ({
        id: p.id,
        product_id: p.product_id,
        nm_id: p.nm_id,
        title: p.title?.substring(0, 30),
        price: p.current_price,
        min: p.min_price,
        stock: p.current_stock,
        mp: p.marketplace,
        acc_id: p.account_id
      })));
    }

    process.exit(0);
  } catch (error) {
    console.error('\n!!! DB CHECK ERROR !!!');
    console.error(error);
    process.exit(1);
  }
}

run();

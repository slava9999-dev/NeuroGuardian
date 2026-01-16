import pg from 'pg';
import * as dotenv from 'dotenv';
const { Pool } = pg;

dotenv.config();
dotenv.config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('--- SENTINEL MONITORING AUDIT ---');

    // 1. Get active users with their product counts and account counts
    const auditRes = await pool.query(`
      SELECT 
        u.id, 
        u.first_name, 
        u.api_key_wb IS NOT NULL as has_legacy_wb,
        u.api_key_ozon IS NOT NULL as has_legacy_ozon,
        (SELECT count(*) FROM products WHERE user_id = u.id) as product_count,
        (SELECT count(*) FROM marketplace_accounts WHERE user_id = u.id) as account_count
      FROM users u 
      WHERE u.is_active = true 
        AND (u.protection_enabled = true OR u.subscription_active = true)
    `);
    
    console.log('\nActive Monitoring Queue:');
    console.table(auditRes.rows);

    const totalMonitorable = auditRes.rows.reduce((sum, r) => sum + parseInt(r.product_count), 0);
    console.log(`Total Products under Monitoring: ${totalMonitorable}`);

    // 2. Check for accounts that might be floating or linked to inactive users
    const orphans = await pool.query(`
      SELECT ma.id, ma.name, ma.user_id, u.is_active 
      FROM marketplace_accounts ma
      LEFT JOIN users u ON ma.user_id = u.id
      WHERE u.is_active = false OR u.id IS NULL
    `);
    if (orphans.rows.length > 0) {
      console.log('\n--- Floating Accounts (linked to inactive users) ---');
      console.table(orphans.rows);
    }

    // 3. Deep dive into user 7548070478
    const mainUid = '7548070478';
    const mainUser = await pool.query("SELECT id, first_name, api_key_wb, api_key_ozon FROM users WHERE id = $1", [mainUid]);
    if (mainUser.rows.length > 0) {
      console.log(`\nLegacy Keys for ${mainUid}:`);
      console.log('WB:', mainUser.rows[0].api_key_wb ? 'EXISTS' : 'NONE');
      console.log('Ozon:', mainUser.rows[0].api_key_ozon ? 'EXISTS' : 'NONE');
    }

    await pool.end();
  } catch (error) {
    console.error(error);
  }
}

run();

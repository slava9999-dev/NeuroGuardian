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
    console.log('--- DB CLEANUP & DIAGNOSTIC ---');

    // 1. Deactivate test users
    const testIds = ['999888777', '1018895991'];
    console.log(`Deactivating test users: ${testIds.join(', ')}...`);
    const updateRes = await pool.query("UPDATE users SET is_active = false WHERE id IN ('999888777', '1018895991')");
    console.log(`Successfully deactivated ${updateRes.rowCount} users.`);

    // 2. Verify remaining active users
    const activeUsers = await pool.query("SELECT id, first_name, username, protection_enabled, subscription_plan FROM users WHERE is_active = true AND (protection_enabled = true OR subscription_active = true)");
    console.log('\n--- Active Users Monitored by Sentinel ---');
    console.table(activeUsers.rows);

    // 3. Check products for main user
    const mainUserId = '7548070478';
    const prodRes = await pool.query('SELECT count(*) FROM products WHERE user_id::text = $1', [mainUserId]);
    console.log(`\nProducts for main user (${mainUserId}): ${prodRes.rows[0].count}`);

    // 4. Check Sentinel Logs
    console.log('\n--- Recent Sentinel Failures ---');
    const logRes = await pool.query('SELECT created_at, user_id, success, details FROM sentinel_logs WHERE success = false ORDER BY created_at DESC LIMIT 3');
    if (logRes.rows.length > 0) {
      logRes.rows.forEach(log => {
        console.log(`[${log.created_at}] User ${log.user_id}:`);
        console.log(JSON.stringify(log.details, null, 2));
      });
    } else {
      console.log('No failed logs found.');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

run();

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
    console.log('--- SENTINEL RECENT ERRORS AUDIT ---');

    // Check sentinel_logs for today's failures
    const logRes = await pool.query(`
      SELECT created_at, user_id, product_id, success, details 
      FROM sentinel_logs 
      WHERE success = false 
      AND created_at > CURRENT_DATE
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (logRes.rows.length > 0) {
      console.log('\nRecent Sentinel Failures:');
      console.table(logRes.rows.map(r => ({
        time: r.created_at,
        user: r.user_id,
        product: r.product_id,
        error: JSON.stringify(r.details)
      })));
    } else {
      console.log('No failures found in sentinel_logs for today.');
    }

    // Check ops_events for severity ERROR
    const opsRes = await pool.query(`
      SELECT created_at, event_type, user_id, payload 
      FROM ops_events 
      WHERE severity = 'ERROR' 
      AND created_at > CURRENT_DATE
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    if (opsRes.rows.length > 0) {
      console.log('\nRecent Ops Errors:');
      console.table(opsRes.rows.map(r => ({
        time: r.created_at,
        type: r.event_type,
        user: r.user_id,
        details: JSON.stringify(r.payload).substring(0, 100)
      })));
    } else {
      console.log('No ERROR severity events found in ops_events for today.');
    }

    await pool.end();
  } catch (error) {
    console.error('Audit failed:', error);
  }
}

run();

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
    console.log('--- SEARCHING FOR SENTINEL ERRORS (LAST 24H) ---');

    // Query for any log where success is false in the last 24 hours
    const logRes = await pool.query(`
      SELECT created_at, user_id, product_id, product_title, success, details, defense_action, marketplace
      FROM sentinel_logs 
      WHERE success = false 
      AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (logRes.rows.length > 0) {
      console.log(`Found ${logRes.rows.length} errors in sentinel_logs:`);
      logRes.rows.forEach(r => {
        console.log(`\nTime: ${r.created_at}`);
        console.log(`User: ${r.user_id}, Product: ${r.product_title} (${r.product_id})`);
        console.log(`Action: ${r.defense_action}, MP: ${r.marketplace}`);
        console.log(`Details: ${JSON.stringify(r.details, null, 2)}`);
      });
    } else {
      console.log('No failures found in sentinel_logs (last 24h).');
    }

    // Also check for any errors reported in the summary but not logged as a 'defense action'
    // Actually, summary errors might be logged in ops_events
    const opsRes = await pool.query(`
      SELECT created_at, event_type, user_id, payload 
      FROM ops_events 
      WHERE severity = 'ERROR' 
      AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    if (opsRes.rows.length > 0) {
      console.log('\nFound errors in ops_events:');
      opsRes.rows.forEach(r => {
        console.log(`\nTime: ${r.created_at}`);
        console.log(`Type: ${r.event_type}, User: ${r.user_id}`);
        console.log(`Payload: ${JSON.stringify(r.payload, null, 2)}`);
      });
    } else {
      console.log('No recent errors found in ops_events.');
    }

    await pool.end();
  } catch (error) {
    console.error('Audit failed:', error);
  }
}

run();

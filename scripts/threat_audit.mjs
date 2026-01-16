import { sql } from '../src/api-lib/services/database.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function auditThreats() {
  console.log('--- SENTINEL THREAT AUDIT ---');
  try {
    const res = await sql`
      SELECT sl.*, p.title 
      FROM sentinel_logs sl
      LEFT JOIN products p ON sl.product_id = p.product_id
      WHERE sl.created_at > NOW() - INTERVAL '1 hour'
      AND sl.threat_type != 'SYSTEM_ERROR'
      ORDER BY sl.created_at DESC
      LIMIT 10
    `;

    if (res.rows.length === 0) {
      console.log('No threat logs found in the last hour.');
      return;
    }

    res.rows.forEach(row => {
      console.log(`\n[${row.created_at.toISOString()}]`);
      console.log(`User: ${row.user_id} | Product: ${row.title || row.product_id}`);
      console.log(`Threat: ${row.threat_type} | Action: ${row.defense_action}`);
      console.log(`Details: ${JSON.stringify(row.details)}`);
    });
  } catch (e) {
    console.error('Audit failed:', e);
  }
  process.exit(0);
}

auditThreats();

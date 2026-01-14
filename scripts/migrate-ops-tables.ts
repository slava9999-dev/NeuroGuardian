import 'dotenv/config';
import { initializeDatabase, sql } from '../src/api-lib/services/database.js';

async function runMigration() {
  console.log('🏗️ Starting Database Migration: Adding Ops Logs tables...');

  try {
    // Force re-init to run the new CREATE TABLE IF NOT EXISTS statements
    await initializeDatabase();

    // Verify creation
    try {
      const logs = await sql`SELECT count(*) FROM ops_events`;
      console.log(`✅ ops_events table verified (count: ${logs.rows[0].count})`);

      const audit = await sql`SELECT count(*) FROM ops_audit`;
      console.log(`✅ ops_audit table verified (count: ${audit.rows[0].count})`);
    } catch (e) {
      console.error('❌ Table verification failed:', e);
      process.exit(1);
    }

    console.log('🚀 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration FAILED:', error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();

import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';

async function diagnose() {
  console.log('🔍 Starting Database Diagnostic...');

  try {
    const start = Date.now();
    const result = await sql`SELECT version()`;
    const duration = Date.now() - start;

    console.log('✅ Database Connection: SUCCESS');
    console.log(`⏱️ Latency: ${duration}ms`);
    console.log(`📦 Version: ${result.rows[0].version}`);

    // Check users table
    const users = await sql`SELECT count(*) FROM users`;
    console.log(`👥 Users count: ${users.rows[0].count}`);

    // Check system_logs table existence
    try {
      const logs = await sql`SELECT count(*) FROM system_logs`;
      console.log(`📝 Logs count: ${logs.rows[0].count}`);
    } catch (e) {
      console.log('⚠️ System logs table might be missing:', e.message);
    }
  } catch (error) {
    console.error('❌ Database Connection FAILED:', error);
    process.exit(1);
  }

  process.exit(0);
}

diagnose();

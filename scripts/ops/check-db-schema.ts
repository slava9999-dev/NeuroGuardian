import { db } from '../../src/infrastructure/database/db.js';
import { sql } from 'drizzle-orm';

async function checkSchema() {
  console.log('🔍 Checking Database Tables...');
  try {
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(
      'Tables found:',
      tables.rows.map(r => r.table_name)
    );

    try {
      const systemFlags = await db.execute(sql`SELECT * FROM system_flags`);
      console.log('System Flags count:', systemFlags.rows.length);
      console.log('System Flags sample:', systemFlags.rows.slice(0, 2));
    } catch (e) {
      console.log('⚠️ system_flags table does not exist yet.');
    }
  } catch (error) {
    console.error('❌ Failed to check schema:', error);
  }
  process.exit(0);
}

checkSchema();

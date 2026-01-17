import { sql } from '../../src/api-lib/services/database.js';

async function migrate() {
  console.log('🚀 Migrating: Adding voice_enabled column to users table...');
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_enabled BOOLEAN DEFAULT true`;
    console.log('✅ Column voice_enabled added successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrate();

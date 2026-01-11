import dotenv from 'dotenv';
import fs from 'fs';

// Load env vars
if (fs.existsSync('.env.production')) {
  dotenv.config({ path: '.env.production' });
  console.log('Loaded .env.production');
} else {
  dotenv.config();
  console.log('Loaded default .env');
}

const pgUrl = process.env.POSTGRES_URL;
console.log('DEBUG: POSTGRES_URL exists:', !!pgUrl);
if (pgUrl) {
  console.log('DEBUG: POSTGRES_URL length:', pgUrl.length);
  console.log('DEBUG: POSTGRES_URL starts with:', pgUrl.substring(0, 15) + '...');
  // Check for password presence (pseudocheck)
  const parts = pgUrl.split('@');
  if (parts.length > 1) {
    const creds = parts[0].split(':');
    console.log('DEBUG: Password present in URL:', creds.length > 2 && !!creds[2]);
  }
}

async function migrate() {
  // Import database AFTER loading env vars
  const { sql } = await import('../src/api-lib/services/database.js');

  console.log('Migrating user_state table...');
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS user_state (
        user_id BIGINT PRIMARY KEY,
        state_data JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Created user_state table');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();

import { sql } from '../src/api-lib/services/database.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function initFlags() {
  console.log('🔨 Initializing system_flags table...');
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS system_flags (
        key TEXT PRIMARY KEY, 
        value_bool BOOLEAN DEFAULT false, 
        value_text TEXT, 
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    await sql`
      INSERT INTO system_flags (key, value_bool) 
      VALUES ('sentinel_emergency_stop', false) 
      ON CONFLICT DO NOTHING
    `;
    
    console.log('✅ Success: system_flags table is ready.');
  } catch (e) {
    console.error('❌ Failed to init system_flags:', e);
  }
  process.exit(0);
}

initFlags();

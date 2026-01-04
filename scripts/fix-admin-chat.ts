import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function fixAdminChatId() {
  console.log('🚀 Fixing ADMIN_CHAT_ID in database...');
  try {
    // We use common_settings or security_audit_logs to store system configs if needed,
    // but the BEST place is to just rely on process.env IF IT WORKS.
    // However, if we want it in DB for the 'getSecret' to find it,
    // we should use a dedicated settings table.

    // Check if we have a settings table
    await sql`CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`;

    await sql`INSERT INTO system_settings (key, value) 
              VALUES ('admin_chat_id', '7548070478') 
              ON CONFLICT (key) DO UPDATE SET value = '7548070478', updated_at = NOW()`;

    console.log('✅ ADMIN_CHAT_ID saved to system_settings table');
  } catch (err) {
    console.error('❌ Failed to fix ADMIN_CHAT_ID:', err);
  }
}

fixAdminChatId();

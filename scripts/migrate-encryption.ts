import dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly before anything else
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function migrateKeys() {
  console.log('🔐 Starting Key Encryption Migration...');

  // Dynamic imports to ensure env vars are loaded first
  const { sql } = await import('../src/api-lib/services/database.js');
  const { encryptApiKey } = await import('../src/api-lib/lib/crypto.js');

  try {
    const userResult = await sql`SELECT id, api_key_wb, api_key_ozon, ozon_client_id FROM users`;
    const accountsResult =
      await sql`SELECT id, wb_token, ozon_client_id, ozon_api_key FROM marketplace_accounts`;

    let encryptedCount = 0;

    // Users
    for (const user of userResult.rows) {
      if (user.api_key_wb && !user.api_key_wb.includes(':')) {
        const encrypted = encryptApiKey(user.api_key_wb);
        await sql`UPDATE users SET api_key_wb = ${encrypted} WHERE id = ${user.id}`;
        encryptedCount++;
      }
      if (user.api_key_ozon && !user.api_key_ozon.includes(':')) {
        const encrypted = encryptApiKey(user.api_key_ozon);
        await sql`UPDATE users SET api_key_ozon = ${encrypted} WHERE id = ${user.id}`;
        encryptedCount++;
      }
      if (user.ozon_client_id && !user.ozon_client_id.includes(':')) {
        const encrypted = encryptApiKey(user.ozon_client_id);
        await sql`UPDATE users SET ozon_client_id = ${encrypted} WHERE id = ${user.id}`;
        encryptedCount++;
      }
    }

    // Accounts
    for (const acc of accountsResult.rows) {
      if (acc.wb_token && !acc.wb_token.includes(':')) {
        const encrypted = encryptApiKey(acc.wb_token);
        await sql`UPDATE marketplace_accounts SET wb_token = ${encrypted} WHERE id = ${acc.id}`;
        encryptedCount++;
      }
      if (acc.ozon_api_key && !acc.ozon_api_key.includes(':')) {
        const encrypted = encryptApiKey(acc.ozon_api_key);
        await sql`UPDATE marketplace_accounts SET ozon_api_key = ${encrypted} WHERE id = ${acc.id}`;
        encryptedCount++;
      }
      if (acc.ozon_client_id && !acc.ozon_client_id.includes(':')) {
        const encrypted = encryptApiKey(acc.ozon_client_id);
        await sql`UPDATE marketplace_accounts SET ozon_client_id = ${encrypted} WHERE id = ${acc.id}`;
        encryptedCount++;
      }
    }

    console.log(`\n✨ Encryption migration complete. Encrypted ${encryptedCount} secrets.`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrateKeys();

import { sql } from '../src/api-lib/services/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function runAudit() {
  console.log('🛡️  Starting Industrial Security Audit...');

  try {
    const userResult = await sql`SELECT id, api_key_wb, api_key_ozon, ozon_client_id FROM users`;
    const accountsResult =
      await sql`SELECT id, user_id, marketplace, wb_token, ozon_client_id, ozon_api_key FROM marketplace_accounts`;

    let plaintextCount = 0;

    console.log(`\n--- Users Audit (${userResult.rows.length} records) ---`);
    for (const user of userResult.rows) {
      if (user.api_key_wb && !user.api_key_wb.includes(':')) {
        plaintextCount++;
        console.log(`[User ${user.id}] WB Key is plaintext!`);
      }
      if (user.api_key_ozon && !user.api_key_ozon.includes(':')) {
        plaintextCount++;
        console.log(`[User ${user.id}] Ozon Key is plaintext!`);
      }
    }

    console.log(`\n--- Marketplace Accounts Audit (${accountsResult.rows.length} records) ---`);
    for (const acc of accountsResult.rows) {
      if (acc.wb_token && !acc.wb_token.includes(':')) {
        plaintextCount++;
        console.log(`[Account ${acc.id}] WB Token is plaintext!`);
      }
      if (acc.ozon_api_key && !acc.ozon_api_key.includes(':')) {
        plaintextCount++;
        console.log(`[Account ${acc.id}] Ozon API Key is plaintext!`);
      }
      if (acc.ozon_client_id && !acc.ozon_client_id.includes(':')) {
        plaintextCount++;
        console.log(`[Account ${acc.id}] Ozon Client ID is plaintext!`);
      }
    }

    if (plaintextCount === 0) {
      console.log('\n✅ All keys are properly encrypted! No action needed.');
    } else {
      console.log(`\n⚠️ Found ${plaintextCount} plaintext secrets. Industrial hardening required.`);
    }
  } catch (error) {
    console.error('❌ Audit failed:', error);
  } finally {
    process.exit(0);
  }
}

runAudit();

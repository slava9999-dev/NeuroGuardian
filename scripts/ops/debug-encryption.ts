import { sql } from '../../src/api-lib/services/database.js';
import { decryptApiKey, encryptApiKey } from '../../src/api-lib/lib/crypto.js';
import { config } from '../../src/infrastructure/config/env.js';

async function checkEncryption() {
  console.log('🔐 CHECKING ENCRYPTION CONFIGURATION');

  const key = config.API_KEY_ENCRYPTION_KEY;
  console.log(
    `Current Key (masked): ${key ? key.substring(0, 4) + '...' + key.substring(key.length - 4) : 'MISSING'}`
  );
  console.log(`Key Length: ${key ? key.length : 0}`);

  // 1. Test Self-Encryption/Decryption
  try {
    const testSecret = 'test-secret-123';
    const encrypted = encryptApiKey(testSecret);
    const decrypted = decryptApiKey(encrypted);

    if (decrypted !== testSecret) {
      console.error('❌ SELFT-TEST FAILED: Decrypted value does not match original.');
    } else {
      console.log('✅ Self-test passed (Encryption/Decryption works with current key).');
    }
  } catch (e) {
    console.error('❌ SELF-TEST CRASHED:', e);
  }

  // 2. Test DB Data
  try {
    const accounts = await sql`
      SELECT id as user_id, api_key_wb, api_key_ozon 
      FROM users 
      WHERE (api_key_wb IS NOT NULL OR api_key_ozon IS NOT NULL) 
      LIMIT 1
    `;

    if (accounts.rows.length === 0) {
      console.log('⚠️ No accounts with keys found to test.');
      process.exit(0);
    }

    const account = accounts.rows[0];
    console.log(`\nTesting DB account (User ${account.user_id}):`);

    let wbResult = 'N/A';
    if (account.api_key_wb) {
      if (!account.api_key_wb.includes(':')) {
        wbResult = '⚠️ PLAINTEXT (Legacy)';
      } else {
        try {
          decryptApiKey(account.api_key_wb);
          wbResult = '✅ DECRYPTED OK';
        } catch (e) {
          wbResult = '❌ FAILED';
        }
      }
    }
    console.log(`- WB Key: ${wbResult}`);

    let ozonResult = 'N/A';
    if (account.api_key_ozon) {
      if (!account.api_key_ozon.includes(':')) {
        ozonResult = '⚠️ PLAINTEXT (Legacy)';
      } else {
        try {
          decryptApiKey(account.api_key_ozon);
          ozonResult = '✅ DECRYPTED OK';
        } catch (e) {
          ozonResult = '❌ FAILED';
        }
      }
    }
    console.log(`- Ozon Key: ${ozonResult}`);
  } catch (e) {
    console.error('❌ DB TEST FAILED:', e);
  }

  process.exit(0);
}

checkEncryption();

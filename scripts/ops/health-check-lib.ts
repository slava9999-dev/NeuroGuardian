import { sql } from '../../src/api-lib/services/database.js';
import { decryptApiKey, encryptApiKey } from '../../src/api-lib/lib/crypto.js';
import { config } from '../../src/infrastructure/config/env.js';
import { logger } from '../../src/api-lib/lib/logger.js';

export async function runHealthCheck() {
  const status = {
    database: false,
    crypto: false,
    telegram: false,
  };

  // 1. Database
  try {
    await sql`SELECT 1`;
    status.database = true;
  } catch (err) {
    logger.error('Health check: DB failure', err);
  }

  // 2. Crypto
  try {
    const testSecret = 'industrial-test-123';
    const encrypted = encryptApiKey(testSecret);
    const decrypted = decryptApiKey(encrypted);
    status.crypto = decrypted === testSecret;
  } catch (err) {
    logger.error('Health check: Crypto failure', err);
  }

  // 3. Telegram
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/getMe`);
    status.telegram = res.ok;
  } catch (err) {
    logger.error('Health check: Telegram failure', err);
  }

  return {
    status,
    allOk: status.database && status.crypto && status.telegram,
  };
}

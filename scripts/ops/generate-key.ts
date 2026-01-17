import * as crypto from 'crypto';

/**
 * Generates a strong random hex key for API_KEY_ENCRYPTION_KEY
 */
function generateSecureKey() {
  const key = crypto.randomBytes(32).toString('hex');
  console.log('\n🔐 NEURO-GUARDIAN SECURITY UTILITY');
  console.log('====================================');
  console.log('Generated a new secure encryption key.');
  console.log('Add this to your .env file:\n');
  console.log(`API_KEY_ENCRYPTION_KEY="${key}"`);
  console.log('\n⚠️ WARNING: DO NOT lose this key. If you change it, all existing');
  console.log('encrypted API keys in the database will become unreadable!');
  console.log('====================================\n');
}

generateSecureKey();

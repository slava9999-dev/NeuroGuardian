const { Client } = require('pg');
require('dotenv').config();

const connectionString = 
  process.env.POSTGRES_URL_NON_POOLING || 
  process.env.POSTGRES_URL || 
  process.env.DATABASE_URL;

const client = new Client({ 
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function patchTypes() {
  try {
    await client.connect();
    console.log('🔌 Connected to DB');
    
    console.log('🩹 Patching column types to BIGINT for Telegram IDs...');
    
    // Fix subscriptions
    await client.query('ALTER TABLE subscriptions ALTER COLUMN user_id TYPE BIGINT;');
    console.log('✅ subscriptions.user_id -> BIGINT');
    
    // Fix payments
    await client.query('ALTER TABLE payments ALTER COLUMN user_id TYPE BIGINT;');
    console.log('✅ payments.user_id -> BIGINT');
    
    // Fix transactions (if exists with integer)
    // Looking at migrations, transactions uses BIGINT in 003_create_transactions.sql
    
    // Fix any other potential issues
    console.log('✨ All necessary columns patched.');
    
  } catch (err) {
    console.error('❌ Patch failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

patchTypes();

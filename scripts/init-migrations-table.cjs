const { Client } = require('pg');
require('dotenv').config();

const connectionString = 
  process.env.POSTGRES_URL_NON_POOLING || 
  process.env.POSTGRES_URL || 
  process.env.DATABASE_URL;

const client = new Client({ 
  connectionString,
  // Disable SSL for localhost tunnel
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function init() {
  try {
    await client.connect();
    console.log('🔌 Connected to DB');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('✅ Created migrations table');
  } catch (err) {
    console.error('❌ Init failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

init();

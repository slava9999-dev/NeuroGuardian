const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.POSTGRES_URL });

async function init() {
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
  await client.end();
}

init().catch(e => { console.error(e); process.exit(1); });

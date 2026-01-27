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

async function enableExtensions() {
  try {
    await client.connect();
    console.log('🔌 Connected to DB');
    
    // Enable pgvector
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✅ Enabled pgvector extension');
    
    // Enable fuzzystrmatch (for levenshtein distance if needed)
    await client.query('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;');
    console.log('✅ Enabled fuzzystrmatch extension');
    
  } catch (err) {
    console.error('❌ Extension enabling failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

enableExtensions();

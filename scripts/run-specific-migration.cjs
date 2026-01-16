const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectionString = 
  process.env.POSTGRES_URL_NON_POOLING || 
  process.env.POSTGRES_URL || 
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: No DB URL found');
  process.exit(1);
}

const targetFiles = process.argv.slice(2);

if (targetFiles.length === 0) {
  console.log('Usage: node run-specific-migration.cjs <filename1> <filename2> ...');
  process.exit(1);
}

async function run() {
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const client = new Client({
    connectionString,
    ssl: (process.env.DB_NO_SSL === 'true' || isLocal) ? false : { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to DB');

    for (const file of targetFiles) {
        console.log(`▶️  Applying ${file}...`);
        const content = fs.readFileSync(path.join(__dirname, '../migrations', file), 'utf8');
        
        // Split by semicolon to run statements individually if needed, 
        // but typically one Transaction block is better.
        // However, "Connection terminated" might be due to transaction timeout.
        // Let's try explicit transaction.

        await client.query('BEGIN');
        try {
            await client.query(content);
            // Manually insert into migrations table if it exists
            await client.query('INSERT INTO migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
            await client.query('COMMIT');
            console.log(`✅ Applied ${file}`);
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
    }

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await client.end();
  }
}

run();

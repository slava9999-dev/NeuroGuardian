const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Load other envs if needed
// ...

// Use non-pooling URL for migrations to ensure stability and avoid pgbouncer issues
const connectionString = 
  process.env.POSTGRES_URL_NON_POOLING || 
  process.env.POSTGRES_URL || 
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: No database connection string found in environment variables (POSTGRES_URL, DATABASE_URL).');
  process.exit(1);
}

async function runMigrationFile(file) {
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const client = new Client({
    connectionString,
    ssl: (process.env.DB_NO_SSL === 'true' || isLocal) ? false : { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Check if already applied
    const res = await client.query('SELECT name FROM migrations WHERE name = $1', [file]);
    if (res.rows.length > 0) {
      // console.log(`⏭️  Skipping ${file} (already applied)`);
      return;
    }

    console.log(`▶️  Applying ${file}...`);
    const content = fs.readFileSync(path.join(__dirname, '../migrations', file), 'utf8');
    
    await client.query('BEGIN');
    await client.query(content);
    await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`✅ Applied ${file}`);
    
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files.`);

  // Only run starting from 012 if we assume previous are skipped or marked
  // But let's check all to be sure because of the logic above
  
  for (const file of files) {
    try {
      await runMigrationFile(file);
      // Brief pause to prevent rate limits or connection storms
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`❌ Failed to apply ${file}:`, e.message);
      process.exit(1);
    }
  }
  console.log('✨ All migrations checked/applied.');
}

runMigrations().catch(console.error);

const fs = require('fs');
const path = require('path');
const { createClient } = require('@vercel/postgres');

// Simple .env parser to avoid dependencies
function loadEnvFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`Loading env from ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      let count = 0;
      
      lines.forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;

        const match = line.match(/^(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/);
        if (match) {
          const key = match[1];
          let value = match[2].trim();
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          if (!process.env[key]) {
             process.env[key] = value;
             count++;
          }
        }
      });
      return count;
    }
  } catch (e) {
    console.warn(`Could not read ${filePath}`, e);
  }
  return 0;
}

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  const masterPath = path.join(process.cwd(), '.env.master');
  
  let loaded = loadEnvFile(envPath);
  loaded += loadEnvFile(masterPath);
  
  console.log(`Total new keys loaded: ${loaded}`);
}

loadEnv();

const relevantKeys = Object.keys(process.env).filter(k => k.includes('URL') || k.includes('POSTGRES'));
console.log('Relevant environment keys present:', relevantKeys);

async function migrate() {
  console.log('🔌 Connecting to database...');
  // Fallback to DATABASE_URL if POSTGRES_URL is not set
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('No POSTGRES_URL or DATABASE_URL found in environment');
  }

  // Use createPool to handle pooled connection strings correctly
  const { createPool } = require('@vercel/postgres');
  const pool = createPool({ connectionString });
  
  let client;
  
  try {
    console.log('🔌 Connecting to database...');
    // Acquire a client from the pool
    client = await pool.connect();
    
    // Verify connection
    await client.query('SELECT 1');

    const schemaPath = path.join(__dirname, 'migrations', '01_ops_schema.sql');
    if (!fs.existsSync(schemaPath)) {
       throw new Error(`Schema file not found at ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📜 Executing migration...');
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
       await client.query(statement);
    }
    
    console.log('✅ Migration completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

migrate();

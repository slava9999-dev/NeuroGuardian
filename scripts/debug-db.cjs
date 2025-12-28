const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '../.env.master');
const envContent = fs.readFileSync(envPath, 'utf8');
const envConfig = require('dotenv').parse(envContent);

Object.assign(process.env, envConfig);

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

async function checkDb() {
  console.log('Connecting...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected!');
    
    // List tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Tables:', res.rows.map(r => r.table_name));
    
    // Check migrations table
    const migs = await client.query('SELECT * FROM migrations');
    console.log('Applied migrations:', migs.rows.map(r => r.name));
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await client.end();
  }
}

checkDb();

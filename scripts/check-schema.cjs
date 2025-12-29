// Check Neon database schema
const { Pool } = require('pg');

async function checkSchema() {
  const pool = new Pool({ 
    connectionString: process.env.POSTGRES_URL, 
    ssl: { rejectUnauthorized: false } 
  });

  try {
    // Check sentinel_logs columns
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sentinel_logs' 
      ORDER BY ordinal_position
    `);
    
    console.log('📊 sentinel_logs columns:');
    if (result.rows.length === 0) {
      console.log('  ⚠️ Table does not exist!');
    } else {
      result.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));
    }

    // Check users columns
    const usersResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 users columns:');
    usersResult.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));

    // List all tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('\n📋 All tables:');
    tablesResult.rows.forEach(row => console.log(`  - ${row.table_name}`));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();

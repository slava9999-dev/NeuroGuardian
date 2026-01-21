#!/usr/bin/env npx tsx
/**
 * Fix media_jobs table schema
 * Drop and recreate with correct structure
 */

import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

async function fixMediaJobsTable() {
  console.log('\n🔧 FIXING media_jobs TABLE SCHEMA\n');
  console.log('='.repeat(60));

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('❌ No database URL found');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: connectionString.replace(/\r/g, '').trim(),
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    // Step 1: Check if table exists
    const checkTable = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'media_jobs'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Current columns:');
    if (checkTable.rows.length > 0) {
      checkTable.rows.forEach(row => {
        console.log(`  - ${row.column_name}`);
      });
    } else {
      console.log('  Table does not exist yet');
    }

    // Step 2: Drop table (DANGER!)
    console.log('\n⚠️  Dropping media_jobs table...');
    await pool.query(`DROP TABLE IF EXISTS media_jobs CASCADE`);
    console.log('✅ Table dropped');

    // Step 3: Recreate with correct schema
    console.log('\n🏗️  Recreating media_jobs table...');
    await pool.query(`
      CREATE TABLE media_jobs (
        id VARCHAR(100) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        user_id BIGINT NOT NULL,
        product_id VARCHAR(100),
        source_image_url TEXT NOT NULL,
        result_image_url TEXT,
        metadata JSONB,
        error TEXT,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        processing_time_ms INTEGER
      )
    `);

    // Step 4: Create indexes
    console.log('📊 Creating indexes...');
    await pool.query(`CREATE INDEX idx_media_jobs_status ON media_jobs(status)`);
    await pool.query(`CREATE INDEX idx_media_jobs_product ON media_jobs(product_id)`);
    await pool.query(`CREATE INDEX idx_media_jobs_user_id ON media_jobs(user_id)`);
    console.log('✅ Indexes created');

    // Step 5: Verify
    const verifyTable = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'media_jobs'
      ORDER BY ordinal_position
    `);

    console.log('\n✅ Final schema:');
    verifyTable.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ media_jobs table fixed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixMediaJobsTable().catch(console.error);

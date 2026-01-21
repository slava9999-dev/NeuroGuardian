#!/usr/bin/env npx tsx
/**
 * Check Recent Sentinel Errors
 * Показывает последние ошибки Sentinel для диагностики
 */

import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

async function checkErrors() {
  console.log('\n🔍 SENTINEL ERROR DIAGNOSTICS\n');
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
    // 0. First, check actual table structure
    console.log('\n🔍 ACTUAL TABLE SCHEMA:\n');

    const schemaCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sentinel_logs'
      ORDER BY ordinal_position
    `);

    console.log('Columns in sentinel_logs:');
    schemaCheck.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // 1. Check recent Sentinel logs with errors
    console.log('\n📋 RECENT ERRORS (Last 24h):\n');

    const errorLogs = await pool.query(`
      SELECT *
      FROM sentinel_logs 
      WHERE success = false 
        OR details::text LIKE '%error%'
        OR details::text LIKE '%Error%'
        OR details::text LIKE '%timeout%'
        OR details::text LIKE '%fail%'
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    if (errorLogs.rows.length === 0) {
      console.log('✅ No error logs in sentinel_logs table\n');
    } else {
      errorLogs.rows.forEach((row, idx) => {
        console.log(`\n--- Error ${idx + 1} ---`);
        console.log(`Time: ${row.created_at}`);
        console.log(`User ID: ${row.user_id}`);
        console.log(`Product: ${row.product_id || 'N/A'}`);
        console.log(`Full Row: ${JSON.stringify(row, null, 2)}`);
      });
    }

    // 2. Check for SYSTEM_ERROR logs
    console.log('\n\n🚨 SYSTEM ERRORS:\n');

    const systemErrors = await pool.query(`
      SELECT *
      FROM sentinel_logs 
      WHERE product_id = 'SYSTEM'
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    if (systemErrors.rows.length === 0) {
      console.log('✅ No system-level errors\n');
    } else {
      systemErrors.rows.forEach((row, idx) => {
        console.log(`\n--- System Error ${idx + 1} ---`);
        console.log(`Time: ${row.created_at}`);
        console.log(`User ID: ${row.user_id}`);
        console.log(`Error: ${row.new_value}`);
        console.log(`Details: ${row.details}`);
      });
    }

    // 3. Summary of today
    console.log("\n\n📊 TODAY'S SUMMARY:\n");

    const summary = await pool.query(`
      SELECT 
        COUNT(*) as total_runs,
        COUNT(CASE WHEN success = true THEN 1 END) as successful,
        COUNT(CASE WHEN success = false THEN 1 END) as failed,
        COUNT(DISTINCT user_id) as users_affected
      FROM sentinel_logs 
      WHERE created_at >= CURRENT_DATE
    `);

    const stats = summary.rows[0];
    console.log(`Total runs: ${stats.total_runs}`);
    console.log(`Successful: ${stats.successful}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Users affected: ${stats.users_affected}`);

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Diagnostics complete\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  } finally {
    await pool.end();
  }
}

checkErrors().catch(console.error);

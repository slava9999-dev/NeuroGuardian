// NeuroGUARDIAN — Check Subscription Tables
// Quick script to check what was created

import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function checkTables() {
  try {
    console.log('🔍 Checking subscription tables...\n');

    // Check all tables
    const allTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log(`📊 All tables in database (${allTables.rows.length}):`);
    allTables.rows.forEach((row) => {
      console.log(`   - ${row.table_name}`);
    });

    // Check subscription-related tables
    const subTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE '%subscription%'
      ORDER BY table_name
    `;

    console.log(`\n📋 Subscription tables (${subTables.rows.length}):`);
    if (subTables.rows.length > 0) {
      subTables.rows.forEach((row) => {
        console.log(`   ✅ ${row.table_name}`);
      });
    } else {
      console.log('   ❌ No subscription tables found');
    }

    // Check payments table
    const paymentTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'payments'
    `;

    if (paymentTables.rows.length > 0) {
      console.log('\n✅ payments table exists');
    } else {
      console.log('\n❌ payments table NOT found');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

checkTables();

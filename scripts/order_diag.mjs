import { sql } from '../src/api-lib/services/database.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function checkOrders() {
  console.log('--- MARKETPLACE ORDERS DIAGNOSTICS ---');
  try {
    // 1. Check Schema
    const cols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'marketplace_orders'
    `;
    console.log('Table Schema:');
    console.table(cols.rows);

    // 2. Check counts per marketplace
    const counts = await sql`
      SELECT marketplace, count(*) as total, count(account_id) as linked
      FROM marketplace_orders
      GROUP BY marketplace
    `;
    console.log('\nOrder distribution:');
    console.table(counts.rows);

    // 3. Check recent syncs
    const recent = await sql`
      SELECT marketplace, order_date, created_at 
      FROM marketplace_orders 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    console.log('\nLast 5 imported orders:');
    console.table(recent.rows);

  } catch (e) {
    console.error('Check failed:', e);
  }
  process.exit(0);
}

checkOrders();

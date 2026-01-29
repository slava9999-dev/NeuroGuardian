import { db } from '../src/infrastructure/database/db.js';
import { sql } from 'drizzle-orm';

async function check() {
  try {
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'last_vision_sync';
    `);
    console.log('Column check result:', result.rows);
    process.exit(0);
  } catch (e) {
    console.error('Check failed:', e);
    process.exit(1);
  }
}

check();

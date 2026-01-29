import { db } from '../src/infrastructure/database/db.js';
import { sql } from 'drizzle-orm';

async function migrate() {
  try {
    console.log('Adding column last_vision_sync to products table...');
    await db.execute(
      sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS last_vision_sync timestamp;`
    );
    console.log('Success!');
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
}

migrate();

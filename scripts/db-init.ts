import { initializeDatabase } from '../src/api-lib/services/database.ts';

async function run() {
  console.log('🚀 Starting database initialization (Schema Sync)...');
  try {
    await initializeDatabase();
    console.log('✅ Database schema updated successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
  }
}

run();

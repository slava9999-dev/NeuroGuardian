import { initializeDatabase } from '../src/api-lib/services/database.js';
import dotenv from 'dotenv';
dotenv.config();

console.log('🚀 Starting database initialization...');
initializeDatabase()
  .then(() => {
    console.log('✅ Database initialized successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
  });

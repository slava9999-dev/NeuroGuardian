// ============================================
// NeuroGUARDIAN — Media Tables Migration
// Creates tables for VisionCore & RenderFactory
// Version: 1.0.0
// ============================================

import { config } from 'dotenv';
import path from 'path';

// Load env before imports
config({ path: path.resolve(process.cwd(), '.env') });
config({ path: path.resolve(process.cwd(), '.env.local') });

import { sql } from '../src/api-lib/services/database.js';
import { MEDIA_ASSETS_MIGRATION } from '../src/vision/types.js';
import { mediaQueue } from '../src/vision/MediaQueueService.js';
import { logger } from '../src/api-lib/lib/logger.js';

async function runMigration() {
  console.log('🔄 Starting Media Tables Migration...');

  try {
    // 1. Create Media Assets table
    console.log('📦 Creating media_assets table...');
    await sql.unsafe(MEDIA_ASSETS_MIGRATION);
    console.log('✅ media_assets table created');

    // 2. Create Media Jobs table (using init method)
    console.log('📦 Creating known media_jobs table...');
    await mediaQueue.init();
    console.log('✅ media_jobs table created');

    console.log('\n✨ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

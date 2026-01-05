import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function initOpsTables() {
  console.log('🛠️ Initializing Ops Tables...');

  try {
    // 1. ops_events
    console.log('Creating ops_events table...');
    await sql`
      CREATE TABLE IF NOT EXISTS ops_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        event_source VARCHAR(50),
        user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        product_id BIGINT,
        payload JSONB DEFAULT '{}',
        old_price INTEGER,
        new_price INTEGER,
        competitor_price INTEGER,
        action_taken VARCHAR(100),
        marketplace VARCHAR(50),
        external_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        processing_result JSONB
      )
    `;

    // Add columns if table exists but columns are missing (Idempotency)
    console.log('Synchronizing ops_events columns...');
    await sql`ALTER TABLE ops_events ADD COLUMN IF NOT EXISTS user_id BIGINT`;
    await sql`ALTER TABLE ops_events ADD COLUMN IF NOT EXISTS product_id BIGINT`;
    await sql`ALTER TABLE ops_events ADD COLUMN IF NOT EXISTS event_type VARCHAR(50)`;
    await sql`ALTER TABLE ops_events ADD COLUMN IF NOT EXISTS event_source VARCHAR(50)`;
    await sql`ALTER TABLE ops_events ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'`;
    await sql`ALTER TABLE ops_events ADD COLUMN IF NOT EXISTS old_price INTEGER`;
    await sql`ALTER TABLE ops_events ADD COLUMN IF NOT EXISTS new_price INTEGER`;
    await sql`ALTER TABLE ops_events ADD COLUMN IF NOT EXISTS competitor_price INTEGER`;
    await sql`ALTER TABLE ops_events ADD COLUMN IF NOT EXISTS action_taken VARCHAR(100)`;
    await sql`ALTER TABLE ops_events ADD COLUMN IF NOT EXISTS marketplace VARCHAR(50)`;
    await sql`ALTER TABLE ops_events ADD COLUMN IF NOT EXISTS external_id VARCHAR(255)`;
    await sql`ALTER TABLE ops_events ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'INFO'`;
    await sql`ALTER TABLE ops_events ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false`;
    await sql`ALTER TABLE ops_events ALTER COLUMN entity_type DROP NOT NULL`;
    await sql`ALTER TABLE ops_events ALTER COLUMN entity_id DROP NOT NULL`;
    await sql`ALTER TABLE ops_events ALTER COLUMN event_type DROP NOT NULL`;

    // 2. ops_audit
    console.log('Creating/Syncing ops_audit table...');
    await sql`
      CREATE TABLE IF NOT EXISTS ops_audit (
        id SERIAL PRIMARY KEY,
        actor_type VARCHAR(50) NOT NULL,
        actor_id VARCHAR(255),
        action VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id VARCHAR(255),
        old_value JSONB,
        new_value JSONB,
        metadata JSONB,
        ip_address VARCHAR(50),
        user_agent TEXT,
        request_id VARCHAR(255),
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('Checking ops_audit columns...');
    await sql`ALTER TABLE ops_audit ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true`;
    await sql`ALTER TABLE ops_audit ADD COLUMN IF NOT EXISTS error_message TEXT`;

    console.log('✅ Ops Tables Initialized successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error initializing ops tables:', err);
    process.exit(1);
  }
}

initOpsTables();

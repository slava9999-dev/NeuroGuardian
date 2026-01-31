import { sql } from '../src/api-lib/services/database.js';
import { logger } from '../src/api-lib/lib/logger.js';

async function migrate() {
  logger.info('🚀 Starting Comprehensive Database Migration (V2)...');

  try {
    // 1. Fix user_id types across ALL tables
    const tablesWithUserId = [
      'marketplace_accounts',
      'products',
      'sentinel_logs',
      'validation_logs',
      'threat_history',
      'ops_events',
      'marketplace_orders',
      'agent_messages',
      'memory_facts',
      'memory_summaries',
    ];

    for (const table of tablesWithUserId) {
      try {
        logger.info(`Migrating ${table}.user_id to VARCHAR(255)...`);
        await sql.unsafe(
          `ALTER TABLE ${table} ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::text`
        );
      } catch (e) {
        logger.error(`Failed to migrate ${table}.user_id:`, e);
      }
    }

    // Special case: users.id
    try {
      logger.info(`Migrating users.id to VARCHAR(255)...`);
      await sql.unsafe(`ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(255) USING id::text`);
    } catch (e) {
      logger.error(`Failed to migrate users.id:`, e);
    }

    // 2. Fix products table columns
    logger.info('Fixing products table (group_id, nm_id)...');
    try {
      await sql.unsafe(`ALTER TABLE products ADD COLUMN IF NOT EXISTS group_id VARCHAR(255)`);
      await sql.unsafe(`ALTER TABLE products ADD COLUMN IF NOT EXISTS nm_id BIGINT`);
      await sql.unsafe(
        `ALTER TABLE products ALTER COLUMN nm_id TYPE VARCHAR(255) USING nm_id::text`
      );
    } catch (e) {
      logger.error('Failed to update products columns:', e);
    }

    // 3. Fix user_state table
    logger.info('Fixing user_state table (User State Manager V5 sync)...');
    try {
      await sql.unsafe(`
                CREATE TABLE IF NOT EXISTS user_state (
                    user_id VARCHAR(255) PRIMARY KEY,
                    marketplace TEXT,
                    has_api_keys BOOLEAN NOT NULL DEFAULT false,
                    products_count INTEGER NOT NULL DEFAULT 0,
                    subscription_tier TEXT NOT NULL DEFAULT 'free',
                    gender TEXT,
                    user_name TEXT,
                    current_intent TEXT,
                    pending_action JSONB,
                    awaiting_input JSONB,
                    last_mentioned_products JSONB NOT NULL DEFAULT '[]'::jsonb,
                    last_query TEXT,
                    last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    session_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    total_queries INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                )
            `);

      const userStateCols = [
        ['marketplace', 'TEXT'],
        ['has_api_keys', 'BOOLEAN DEFAULT false'],
        ['products_count', 'INTEGER DEFAULT 0'],
        ['subscription_tier', "TEXT DEFAULT 'free'"],
        ['gender', 'TEXT'],
        ['user_name', 'TEXT'],
        ['current_intent', 'TEXT'],
        ['pending_action', 'JSONB'],
        ['awaiting_input', 'JSONB'],
        ['last_mentioned_products', "JSONB DEFAULT '[]'::jsonb"],
        ['last_query', 'TEXT'],
        ['last_active_at', 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()'],
        ['session_started_at', 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()'],
        ['total_queries', 'INTEGER DEFAULT 0'],
      ];

      for (const [col, type] of userStateCols) {
        try {
          await sql.unsafe(`ALTER TABLE user_state ADD COLUMN IF NOT EXISTS ${col} ${type}`);
        } catch (e) {
          // Ignore if already exists
        }
      }
    } catch (e) {
      logger.error('Failed to sync user_state table:', e);
    }

    // 4. Memory tables verification
    logger.info('Verifying memory tables user_id types...');
    try {
      await sql.unsafe(
        `ALTER TABLE agent_messages ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::text`
      );
      await sql.unsafe(
        `ALTER TABLE memory_facts ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::text`
      );
      await sql.unsafe(
        `ALTER TABLE memory_summaries ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::text`
      );
    } catch (e) {
      logger.error('Memory table migration error:', e);
    }

    logger.info('✅ Migration completed successfully!');
  } catch (error) {
    logger.error('❌ Critical Migration Failure:', error);
  }
}

migrate();

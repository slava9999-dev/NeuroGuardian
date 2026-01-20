#!/usr/bin/env npx tsx
/**
 * Fix Kernel Tables — Create missing tables for core modules
 * Run: npx tsx scripts/fix-kernel-tables.ts
 */

import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

async function fix() {
  console.log('\n🔧 NEUROGUARDIAN KERNEL REPAIR\n');
  console.log('='.repeat(50));

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('❌ No database URL found');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: connectionString.replace(/\r/g, '').trim(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  // Handle pool errors to prevent crash
  pool.on('error', err => {
    console.log('⚠️  Pool error (ignored):', err.message);
  });

  const executeWithRetry = async (query: string, logLabel: string) => {
    let attempts = 0;
    while (attempts < 3) {
      let client;
      try {
        attempts++;
        client = await pool.connect();
        await client.query(query);
        console.log(`   ✅ ${logLabel}`);
        return;
      } catch (err: any) {
        const isRetryable = err.code === 'ECONNRESET' || err.message.includes('closed');
        if (isRetryable && attempts < 3) {
          console.log(`   ⏳ Check failed (${logLabel}), retrying...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        console.log(`   ❌ Error (${logLabel}):`, err.message);
        throw err;
      } finally {
        if (client) client.release();
      }
    }
  };

  try {
    console.log('📦 Creating missing tables...');

    // 1. Sentinel Events (Critical for monitoring)
    console.log('👉 sentinel_events...');
    await executeWithRetry(
      `
      CREATE TABLE IF NOT EXISTS sentinel_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        product_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sentinel_events_user ON sentinel_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_sentinel_events_type ON sentinel_events(event_type);
    `,
      'Created/Verified sentinel_events'
    );

    // 2. User Memory (For MemoryManager)
    console.log('👉 user_memory...');
    await executeWithRetry(
      `
      CREATE TABLE IF NOT EXISTS user_memory (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        fact_type TEXT NOT NULL,
        fact_value TEXT,
        source TEXT,
        confidence DECIMAL(3,2) DEFAULT 1.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_user_memory_user ON user_memory(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_memory_type ON user_memory(fact_type);
    `,
      'Created/Verified user_memory'
    );

    // 3. Agent Experiences (For ExperienceLearning)
    console.log('👉 agent_experiences...');
    await executeWithRetry(
      `
      CREATE TABLE IF NOT EXISTS agent_experiences (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        response TEXT NOT NULL,
        feedback INTEGER,
        context JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `,
      'Created agent_experiences table'
    );

    // Ensure user_id column exists
    await executeWithRetry(
      `
      ALTER TABLE agent_experiences 
      ADD COLUMN IF NOT EXISTS user_id INTEGER;
    `,
      'Added user_id column'
    );

    // Now safe to create index
    await executeWithRetry(
      `
      CREATE INDEX IF NOT EXISTS idx_experiences_user ON agent_experiences(user_id);
    `,
      'Created index on agent_experiences'
    );

    // 4. Knowledge Embeddings (For RAG)
    console.log('👉 knowledge_embeddings...');
    // Create vector extension if possible, catch error if not allowed
    try {
      await executeWithRetry('CREATE EXTENSION IF NOT EXISTS vector', 'Vector Extension');
    } catch (e) {
      console.log('   ⚠️  Vector extension check failed (might be managed):', (e as Error).message);
    }

    await executeWithRetry(
      `
        CREATE TABLE IF NOT EXISTS knowledge_embeddings (
          id SERIAL PRIMARY KEY,
          content TEXT NOT NULL,
          embedding vector(1024),
          metadata JSONB DEFAULT '{}',
          namespace TEXT DEFAULT 'default',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_ke_namespace ON knowledge_embeddings(namespace);
    `,
      'Created/Verified knowledge_embeddings'
    );

    console.log('\n✨ All tables repaired successfully!');
  } catch (error) {
    console.error('\n❌ Repair failed completely:', error);
  } finally {
    await pool.end();
  }
}

fix();

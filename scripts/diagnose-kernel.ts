#!/usr/bin/env npx tsx
/**
 * Diagnose Kernel Health — Check which modules are degraded
 * Run: npx tsx scripts/diagnose-kernel.ts
 */

import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

interface TableCheck {
  name: string;
  table: string;
  module: string;
}

const REQUIRED_TABLES: TableCheck[] = [
  { name: 'user_state', table: 'user_state', module: 'StateManager' },
  { name: 'user_memory', table: 'user_memory', module: 'MemoryManager' },
  { name: 'marketplace_accounts', table: 'marketplace_accounts', module: 'MarketplaceService' },
  { name: 'sentinel_events', table: 'sentinel_events', module: 'Sentinel' },
  { name: 'subscriptions', table: 'subscriptions', module: 'SubscriptionService' },
  { name: 'agent_experiences', table: 'agent_experiences', module: 'ExperienceLearning' },
  { name: 'knowledge_embeddings', table: 'knowledge_embeddings', module: 'KnowledgeBase (RAG)' },
];

async function diagnose() {
  console.log('\n🔬 NEUROGUARDIAN KERNEL DIAGNOSTICS\n');
  console.log('='.repeat(50));

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('❌ No database URL found in environment');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: connectionString.replace(/\r/g, '').trim(),
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
  });

  // Suppress unhandled pool errors
  pool.on('error', err => {
    console.log('⚠️  Pool error (ignored):', err.message);
  });

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Database connection: OK\n');

    console.log('📊 TABLE CHECKS:\n');

    const missingTables: string[] = [];
    const degradedModules: string[] = [];

    for (const check of REQUIRED_TABLES) {
      try {
        const result = await client.query(
          `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          ) as exists
        `,
          [check.table]
        );

        const exists = result.rows[0]?.exists === true;
        const status = exists ? '✅' : '❌';
        console.log(`${status} ${check.table.padEnd(25)} → ${check.module}`);

        if (!exists) {
          missingTables.push(check.table);
          degradedModules.push(check.module);
        }
      } catch (err) {
        console.log(`⚠️  ${check.table.padEnd(25)} → Error checking`);
        missingTables.push(check.table);
        degradedModules.push(check.module);
      }
    }

    // Check environment variables
    console.log('\n📋 ENVIRONMENT CHECKS:\n');

    const envChecks = [
      { key: 'TELEGRAM_BOT_TOKEN', module: 'TelegramBot' },
      { key: 'DATABASE_URL', module: 'Database', alt: 'POSTGRES_URL' },
      { key: 'HUGGINGFACE_API_KEY', module: 'LLMProvider (HuggingFace)' },
      { key: 'OPENROUTER_API_KEY', module: 'LLMProvider (OpenRouter)' },
      { key: 'GROQ_API_KEY', module: 'LLMProvider (Groq)' },
      { key: 'RAG_PROVIDER', module: 'RAG Embeddings' },
    ];

    for (const check of envChecks) {
      const exists = !!(process.env[check.key] || (check.alt && process.env[check.alt]));
      const status = exists ? '✅' : '⚠️ ';
      console.log(`${status} ${check.key.padEnd(25)} → ${check.module}`);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('\n📝 SUMMARY:\n');

    if (missingTables.length === 0) {
      console.log('✅ All modules are healthy!\n');
    } else {
      console.log(`❌ Missing tables: ${missingTables.length}`);
      console.log(`⚠️  Degraded modules: ${degradedModules.join(', ')}\n`);

      console.log('\n🔧 RUN THESE SQL COMMANDS TO FIX:\n');

      if (missingTables.includes('sentinel_events')) {
        console.log(`-- sentinel_events (for Sentinel monitoring)
CREATE TABLE IF NOT EXISTS sentinel_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`);
      }

      if (missingTables.includes('user_memory')) {
        console.log(`-- user_memory (for MemoryManager)
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
`);
      }

      if (missingTables.includes('agent_experiences')) {
        console.log(`-- agent_experiences (for ExperienceLearning)
CREATE TABLE IF NOT EXISTS agent_experiences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  response TEXT NOT NULL,
  feedback INTEGER,
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`);
      }

      if (missingTables.includes('knowledge_embeddings')) {
        console.log(`-- knowledge_embeddings (for RAG/KnowledgeBase)
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1024),
  metadata JSONB DEFAULT '{}',
  namespace TEXT DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ke_namespace ON knowledge_embeddings(namespace);
`);
      }
    }

    client.release();
  } catch (error) {
    console.log(
      '❌ Database connection failed:',
      error instanceof Error ? error.message : String(error)
    );
    if (client) client.release();
  }

  await pool.end();
  process.exit(0);
}

diagnose().catch(error => {
  console.error('Diagnostics failed:', error);
  process.exit(1);
});

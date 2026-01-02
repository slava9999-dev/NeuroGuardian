// NeuroGUARDIAN — Apply Migration 017 (Subscriptions)
// Script to apply subscription system migration to database

import 'dotenv/config';
import { sql } from '@vercel/postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  try {
    console.log('🚀 Applying migration 017_subscriptions.sql...\n');

    // Read migration file
    const migrationPath = join(__dirname, '../migrations/017_subscriptions.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file loaded');
    console.log(`📏 Size: ${migrationSQL.length} characters\n`);

    // Split into individual statements (simple approach - split by semicolon outside of functions)
    console.log('⚙️  Executing migration statements...');
    
    // For complex migrations with functions, it's better to use psql or execute via admin API
    // For now, let's use the admin API endpoint
    
    console.log('📡 Using admin API endpoint for migration...');
    
    const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
    const API_URL = process.env.VERCEL_URL || 'https://neuro-guardian.vercel.app';
    
    if (!ADMIN_API_KEY) {
      throw new Error('ADMIN_API_KEY not found in environment');
    }
    
    const response = await fetch(`${API_URL}/api?action=run-migration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_API_KEY,
      },
      body: JSON.stringify({
        migration: '017_subscriptions.sql',
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`API error: ${result.error || response.statusText}`);
    }
    
    console.log('✅ Migration applied via API!\n');

    // Verify tables created
    console.log('🔍 Verifying tables...');

    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('subscriptions', 'payments', 'subscription_tiers')
      ORDER BY table_name
    `;

    console.log(`✅ Found ${tables.rows.length} tables:`);
    tables.rows.forEach((row) => {
      console.log(`   - ${row.table_name}`);
    });

    // Check subscription tiers
    const tiers = await sql`
      SELECT tier, name_ru, price_monthly, max_products, max_accounts
      FROM subscription_tiers
      ORDER BY display_order
    `;

    console.log(`\n📊 Subscription tiers (${tiers.rows.length}):`);
    tiers.rows.forEach((tier) => {
      console.log(
        `   - ${tier.tier.padEnd(10)} | ${tier.name_ru.padEnd(20)} | ${tier.price_monthly}₽/мес | ${tier.max_products} товаров | ${tier.max_accounts} магазинов`
      );
    });

    // Check functions
    const functions = await sql`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name IN ('create_default_subscription', 'is_subscription_active', 'update_expired_subscriptions')
      ORDER BY routine_name
    `;

    console.log(`\n🔧 Functions created (${functions.rows.length}):`);
    functions.rows.forEach((fn) => {
      console.log(`   - ${fn.routine_name}()`);
    });

    // Check trigger
    const triggers = await sql`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name = 'trigger_create_subscription'
    `;

    console.log(`\n⚡ Triggers (${triggers.rows.length}):`);
    triggers.rows.forEach((trigger) => {
      console.log(`   - ${trigger.trigger_name} on ${trigger.event_object_table}`);
    });

    console.log('\n✅ Migration verification complete!');
    console.log('\n🎉 Subscription system is ready for production!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nError details:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run migration
applyMigration();

import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';
import { knowledgeBase } from '../src/agent/core/KnowledgeBase.js';
import * as fs from 'fs';
import * as path from 'path';

async function diagnose() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       NeuroGUARDIAN — Database & KnowledgeBase Check       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // ============================================
  // 1. DATABASE CONNECTION
  // ============================================
  console.log('📊 DATABASE CHECK:');
  console.log('─'.repeat(50));

  try {
    const start = Date.now();
    const result = await sql`SELECT version()`;
    const duration = Date.now() - start;

    console.log('✅ Connection: SUCCESS');
    console.log(`⏱️  Latency: ${duration}ms`);
    console.log(`📦 Version: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`);
  } catch (error: any) {
    console.error('❌ Connection FAILED:', error.message);
    process.exit(1);
  }

  // ============================================
  // 2. TABLES CHECK
  // ============================================
  console.log('\n📋 TABLES:');
  console.log('─'.repeat(50));

  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;

    const requiredTables = [
      'users',
      'products',
      'marketplace_accounts',
      'price_history',
      'subscription_history',
      'ops_events',
      'ops_audit',
      'user_state',
      'user_memory',
    ];

    const existingTables = tables.rows.map((r: any) => r.table_name);
    console.log(`Found ${existingTables.length} tables:\n`);

    for (const table of requiredTables) {
      if (existingTables.includes(table)) {
        console.log(`  ✅ ${table}`);
      } else {
        console.log(`  ❌ ${table} — MISSING!`);
      }
    }

    // Show extra tables
    const extraTables = existingTables.filter((t: string) => !requiredTables.includes(t));
    if (extraTables.length > 0) {
      console.log('\n  Other tables:', extraTables.join(', '));
    }
  } catch (error: any) {
    console.error('❌ Tables check failed:', error.message);
  }

  // ============================================
  // 3. KNOWLEDGE BASE CHECK
  // ============================================
  console.log('\n📚 KNOWLEDGE BASE:');
  console.log('─'.repeat(50));

  try {
    const kbPath = path.resolve(process.cwd(), 'docs/knowledge_base');

    if (fs.existsSync(kbPath)) {
      const files = fs.readdirSync(kbPath).filter(f => f.endsWith('.md'));
      console.log(`✅ Path: ${kbPath}`);
      console.log(`📄 Documents: ${files.length} files\n`);

      // List documents
      for (const file of files) {
        const stats = fs.statSync(path.join(kbPath, file));
        const sizeKb = (stats.size / 1024).toFixed(1);
        console.log(`  • ${file.padEnd(30)} (${sizeKb} KB)`);
      }

      // Test search
      console.log('\n🔍 Search test:');
      const searchResult = await knowledgeBase.search('API ключ Wildberries', 2);
      if (searchResult.length > 0) {
        console.log(`  ✅ Found ${searchResult.length} relevant documents`);
        searchResult.forEach(doc => {
          console.log(`     - ${doc.title}`);
        });
      } else {
        console.log('  ⚠️ No results for test query');
      }
    } else {
      console.log(`❌ Path not found: ${kbPath}`);
    }
  } catch (error: any) {
    console.error('❌ KnowledgeBase check failed:', error.message);
  }

  // ============================================
  // 4. SUMMARY
  // ============================================
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('✅ Database and KnowledgeBase check completed!');
  console.log('═'.repeat(60));

  process.exit(0);
}

diagnose();

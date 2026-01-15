#!/usr/bin/env npx tsx
// ============================================
// NeuroGUARDIAN — Database Health Check
// Comprehensive database diagnostics
// Version: 1.0.0 | Date: January 2026
// ============================================

import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';

interface TableInfo {
  name: string;
  rowCount: number;
  sizeBytes?: number;
}

interface HealthReport {
  status: 'healthy' | 'warning' | 'error';
  timestamp: Date;
  connection: {
    success: boolean;
    latencyMs: number;
    error?: string;
  };
  extensions: {
    vector: boolean;
  };
  tables: TableInfo[];
  summary: {
    totalTables: number;
    totalRows: number;
    issues: string[];
    recommendations: string[];
  };
}

async function checkConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await sql`SELECT 1 as test`;
    return { success: true, latencyMs: Date.now() - start };
  } catch (error) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkExtensions(): Promise<{ vector: boolean }> {
  try {
    const result = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as has_vector
    `;
    return { vector: result.rows[0]?.has_vector === true };
  } catch {
    return { vector: false };
  }
}

async function getTables(): Promise<TableInfo[]> {
  const tables: TableInfo[] = [];

  try {
    // Get all user tables with their row counts from pg_stat_user_tables
    const result = await sql`
      SELECT 
        schemaname,
        relname as table_name,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY relname
    `;

    for (const row of result.rows) {
      tables.push({
        name: row.table_name as string,
        rowCount: parseInt(String(row.row_count)) || 0,
      });
    }
  } catch (error) {
    console.log(`   ⚠️  Could not get table stats: ${error}`);
  }

  return tables;
}

async function runHealthCheck(): Promise<HealthReport> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       NeuroGUARDIAN — Database Health Check                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const issues: string[] = [];
  const recommendations: string[] = [];

  // 1. Connection check
  console.log('📡 Checking connection...');
  const connection = await checkConnection();
  if (connection.success) {
    console.log(`   ✅ Connected (${connection.latencyMs}ms latency)`);
    if (connection.latencyMs > 1000) {
      issues.push('High database latency (>1s)');
      recommendations.push('Consider using connection pooling or closer region');
    }
  } else {
    console.log(`   ❌ Connection failed: ${connection.error}`);
    issues.push(`Connection failed: ${connection.error}`);
    recommendations.push('Check POSTGRES_URL in .env, network connectivity, or VPN');

    return {
      status: 'error',
      timestamp: new Date(),
      connection,
      extensions: { vector: false },
      tables: [],
      summary: {
        totalTables: 0,
        totalRows: 0,
        issues,
        recommendations,
      },
    };
  }

  // 2. Extensions check
  console.log('');
  console.log('🔌 Checking extensions...');
  const extensions = await checkExtensions();
  if (extensions.vector) {
    console.log('   ✅ pgvector extension enabled');
  } else {
    console.log('   ⚠️  pgvector extension NOT found');
    issues.push('pgvector extension not enabled');
    recommendations.push('Run: CREATE EXTENSION IF NOT EXISTS vector;');
  }

  // 3. Tables check
  console.log('');
  console.log('📋 Checking tables...');
  const tables = await getTables();

  let totalRows = 0;
  for (const table of tables) {
    console.log(`   • ${table.name}: ${table.rowCount.toLocaleString()} rows`);
    totalRows += table.rowCount;
  }

  // Check for critical tables
  const criticalTables = ['users', 'products', 'sentinel_logs'];
  for (const critical of criticalTables) {
    if (!tables.find(t => t.name === critical)) {
      issues.push(`Critical table '${critical}' is missing`);
      recommendations.push(`Run database initialization: npm run db:init`);
    }
  }

  // Check for RAG table
  const ragTable = tables.find(t => t.name === 'knowledge_embeddings');
  if (!ragTable) {
    console.log('   ⚠️  knowledge_embeddings table NOT found (RAG not initialized)');
    recommendations.push('Run: npx tsx scripts/setup-vector-store.ts');
  } else if (ragTable.rowCount === 0) {
    console.log('   ⚠️  knowledge_embeddings is empty (no documents indexed)');
    recommendations.push('Run ingestion: npx tsx scripts/setup-vector-store.ts');
  }

  // 4. Data quality checks
  console.log('');
  console.log('🔍 Checking data quality...');

  try {
    // Check for users without products
    const usersResult = await sql`SELECT COUNT(*) as count FROM users`;
    const usersWithProducts = await sql`
      SELECT COUNT(DISTINCT user_id) as count FROM products
    `;
    const userCount = parseInt(usersResult.rows[0].count);
    const activeUsers = parseInt(usersWithProducts.rows[0].count);

    console.log(`   • Users: ${userCount} total, ${activeUsers} with products`);

    if (userCount > 0 && activeUsers === 0) {
      issues.push('No users have synced products');
      recommendations.push('Users need to connect API keys and sync products');
    }
  } catch (error) {
    console.log(`   ⚠️  Could not check users: ${error}`);
  }

  try {
    // Check sentinel activity
    const sentinelResult = await sql`
      SELECT COUNT(*) as count FROM sentinel_logs 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;
    const recentLogs = parseInt(sentinelResult.rows[0].count);
    console.log(`   • Sentinel logs (24h): ${recentLogs}`);
  } catch {
    console.log('   • Sentinel logs: table not found');
  }

  // 5. Determine overall status
  let status: 'healthy' | 'warning' | 'error' = 'healthy';
  if (issues.length > 0) {
    status = issues.some(i => i.includes('Critical') || i.includes('Connection failed'))
      ? 'error'
      : 'warning';
  }

  // 6. Print summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  if (status === 'healthy') {
    console.log('✅ STATUS: HEALTHY');
  } else if (status === 'warning') {
    console.log('⚠️  STATUS: WARNING');
  } else {
    console.log('❌ STATUS: ERROR');
  }

  console.log('');
  console.log(`📊 Summary:`);
  console.log(`   • Tables: ${tables.length}`);
  console.log(`   • Total rows: ${totalRows.toLocaleString()}`);
  console.log(`   • pgvector: ${extensions.vector ? 'enabled' : 'disabled'}`);

  if (issues.length > 0) {
    console.log('');
    console.log('🚨 Issues:');
    issues.forEach(i => console.log(`   • ${i}`));
  }

  if (recommendations.length > 0) {
    console.log('');
    console.log('💡 Recommendations:');
    recommendations.forEach(r => console.log(`   • ${r}`));
  }

  console.log('');

  return {
    status,
    timestamp: new Date(),
    connection,
    extensions,
    tables,
    summary: {
      totalTables: tables.length,
      totalRows,
      issues,
      recommendations,
    },
  };
}

// Run the health check
runHealthCheck()
  .then(report => {
    process.exit(report.status === 'error' ? 1 : 0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

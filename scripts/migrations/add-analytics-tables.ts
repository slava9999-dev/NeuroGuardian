// ============================================
// Migration: Add Validation Logs and Threat History Tables
// Version: 1.0.0 | Date: January 2026
// ============================================

import { sql } from '@vercel/postgres';

export async function migrate() {
  console.log('🔄 Creating validation_logs table...');

  await sql`
    CREATE TABLE IF NOT EXISTS validation_logs (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES users(id),
      score INTEGER NOT NULL,
      passed BOOLEAN NOT NULL,
      issue_types TEXT,
      issue_count INTEGER DEFAULT 0,
      has_critical BOOLEAN DEFAULT false,
      query_preview VARCHAR(100),
      response_length INTEGER,
      processing_time_ms INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_validation_logs_user_id ON validation_logs(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_validation_logs_created_at ON validation_logs(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_validation_logs_passed ON validation_logs(passed)`;

  console.log('✅ validation_logs table created');

  console.log('🔄 Creating threat_history table...');

  await sql`
    CREATE TABLE IF NOT EXISTS threat_history (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL REFERENCES users(id),
      product_id VARCHAR(255) NOT NULL,
      nm_id VARCHAR(255),
      marketplace VARCHAR(50) NOT NULL,
      threat_type VARCHAR(100) NOT NULL,
      severity VARCHAR(20) NOT NULL,
      message TEXT,
      threat_data TEXT,
      action_taken VARCHAR(50),
      price_before_fix INTEGER,
      price_after_fix INTEGER,
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_threat_history_user_id ON threat_history(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_threat_history_product_id ON threat_history(product_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_threat_history_threat_type ON threat_history(threat_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_threat_history_created_at ON threat_history(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_threat_history_severity ON threat_history(severity)`;

  console.log('✅ threat_history table created');

  return { success: true };
}

// Run migration if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(result => {
      console.log('🎉 Migration completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { config } from '../config/env.js';
import { logger } from '../../api-lib/lib/logger.js';

const { Pool } = pg;

// Use non-pooling logic for migrations/heavy seeds, pooling for API
const pool = new Pool({
  connectionString: config.POSTGRES_URL,
  ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool, { schema });

// Performance Monitoring Wrapper
export async function dbMeasured<T>(name: string, query: Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await query;
    const duration = Date.now() - start;
    if (duration > 200) {
      logger.warn(`🐢 Slow Query Detected: ${name}`, { durationMs: duration });
    }
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`❌ Query Failed: ${name}`, {
      durationMs: duration,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Export types for use in services

export type DB = typeof db;
export * from './schema.js';

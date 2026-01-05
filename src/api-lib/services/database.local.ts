// ============================================
// NeuroGUARDIAN — Local Database Service
// Uses pg driver for local development
// ============================================

import pkg from 'pg';
const { Pool } = pkg;

// Use POSTGRES_URL from .env
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Support more concurrent requests
  idleTimeoutMillis: 30000, // Close idle clients after 30s
  connectionTimeoutMillis: 5000, // Fail fast if pool is full
});

/**
 * Standard query function for local pg
 */
export async function query(text: string, params?: unknown[]): Promise<pkg.QueryResult> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Vercel-like sql tagged template literal mock
 */
export const sql = async (
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<pkg.QueryResult> => {
  const text = strings.reduce(
    (acc: string, str: string, i: number) => acc + str + (i < values.length ? `$${i + 1}` : ''),
    ''
  );

  let retries = 3;
  while (retries > 0) {
    let client;
    try {
      client = await pool.connect();
      return await client.query(text, values);
    } catch (error: any) {
      retries--;
      if (retries === 0) throw error;

      const isTransient = error.code === 'ECONNRESET' || error.message?.includes('fetch failed');
      if (isTransient) {
        console.warn(`⚠️ DB Transient error, retrying... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        throw error;
      }
    } finally {
      if (client) client.release();
    }
  }
  throw new Error('Retries exceeded');
};

export { pool };

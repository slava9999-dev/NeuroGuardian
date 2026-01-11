// ============================================
// NeuroGUARDIAN — Local Database Service
// Uses pg driver for local development
// ============================================

import pkg from 'pg';
const { Pool } = pkg;

// Use POSTGRES_URL from .env
const connectionString = process.env.POSTGRES_URL?.replace(/\r/g, '').trim();
const isLocal =
  !connectionString ||
  connectionString.includes('localhost') ||
  connectionString.includes('127.0.0.1');

let poolConfig: pkg.PoolConfig;

if (connectionString && !isLocal) {
  try {
    const url = new URL(connectionString);
    const password = decodeURIComponent(url.password); // Decode password in case of special chars
    console.log(
      `[Database] Connecting to ${url.hostname} as ${url.username} (pwd detected: ${!!password}, len: ${password?.length || 0})`
    );

    poolConfig = {
      user: url.username,
      password: password,
      host: url.hostname,
      port: parseInt(url.port || '5432'),
      database: url.pathname.slice(1),
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  } catch (e) {
    console.warn('[Database] Manual parse failed, using connectionString directly');
    poolConfig = {
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }
} else {
  poolConfig = {
    connectionString,
    ssl: false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

// Neon DB requires SSL
const pool = new Pool(poolConfig);

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
    } catch (error: unknown) {
      retries--;
      if (retries === 0) throw error;

      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTransient =
        errorMessage.includes('ECONNRESET') || errorMessage.includes('fetch failed');
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

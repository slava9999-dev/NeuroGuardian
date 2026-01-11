// ============================================
// NeuroGUARDIAN — Local Database Service
// Uses pg driver for local development
// ============================================

import type { PoolConfig, QueryResult, PoolClient } from 'pg';
import pkg from 'pg';
const { Pool } = pkg;

let _pool: pkg.Pool | null = null;

function getPool(): pkg.Pool {
  if (_pool) return _pool;

  const connectionString = process.env.POSTGRES_URL?.replace(/\r/g, '').trim();

  if (connectionString && connectionString.length > 0) {
    const isLocalhost =
      connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    const hasSslMode = connectionString.includes('sslmode=');

    const poolConfig: PoolConfig = {
      connectionString,
      ssl: isLocalhost || hasSslMode ? undefined : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
    };

    _pool = new Pool(poolConfig);
  } else {
    _pool = new Pool({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: '',
      database: 'neuroguardian',
      ssl: false,
    });
  }

  _pool.on('error', (err: Error) => {
    if (!err.message.includes('terminated') && !err.message.includes('ECONNRESET')) {
      console.error('[Database] Pool Error:', err.message);
    }
  });

  return _pool;
}

export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

class Raw {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

async function executeWithRetry(text: string, values: unknown[]): Promise<QueryResult> {
  let retries = 3;
  while (retries > 0) {
    let client: PoolClient | null = null;
    try {
      const pool = getPool();

      const clientPromise = pool.connect();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB_CONNECT_TIMEOUT')), 15000)
      );

      client = await (Promise.race([clientPromise, timeoutPromise]) as Promise<PoolClient>);

      const queryPromise = client.query(text, values);
      const queryTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB_QUERY_TIMEOUT')), 30000)
      );

      const res = await (Promise.race([queryPromise, queryTimeout]) as Promise<QueryResult>);
      return res;
    } catch (error: unknown) {
      retries--;
      const msg = error instanceof Error ? error.message : String(error);

      const isTransient =
        msg.includes('timeout') ||
        msg.includes('terminated') ||
        msg.includes('RESET') ||
        msg.includes('SSL');

      if (isTransient && retries > 0) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw error;
    } finally {
      if (client) client.release();
    }
  }
  throw new Error('Database retries exhausted');
}

export const sql = (stringsOrRaw: TemplateStringsArray | string, ...values: unknown[]): unknown => {
  if (typeof stringsOrRaw === 'string') return new Raw(stringsOrRaw);

  const strings = stringsOrRaw as TemplateStringsArray;
  let text = strings[0];
  const queryValues: unknown[] = [];

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (val instanceof Raw) {
      text += val.text;
    } else {
      queryValues.push(val);
      text += `$${queryValues.length}`;
    }
    text += strings[i + 1];
  }

  return executeWithRetry(text, queryValues);
};

export { getPool as pool };

import pkg from 'pg';
const { Pool } = pkg;

// Use POSTGRES_URL from .env
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

/**
 * Standard query function for local pg
 */
export async function query(text, params) {
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
export const sql = async (strings, ...values) => {
  const text = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''),
    ''
  );
  const client = await pool.connect();
  try {
    return await client.query(text, values);
  } finally {
    client.release();
  }
};

export { pool };

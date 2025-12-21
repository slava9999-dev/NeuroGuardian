import { createClient } from '@vercel/kv';
import { sql } from '@vercel/postgres';

// KV Client Singleton
let kvClient: ReturnType<typeof createClient> | null = null;

export const getKVClient = () => {
  if (kvClient) return kvClient;

  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    kvClient = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    return kvClient;
  }

  console.warn('⚠️ KV_REST_API_URL or KV_REST_API_TOKEN not set, KV features disabled');
  return null;
};

// Re-export sql for consistent usage
export { sql };

// Helper to check standard user fields or transform from DB result
export const mapDbUser = (row: any): any => {
  // Type as generic or specific user type
  if (!row) return null;
  return {
    ...row,
    // Add any specific transformations here (e.g. converting string dates to Date objects if needed)
  };
};

// ============================================
// NeuroGUARDIAN — Rate Limiting
// KV-backed rate limiting with in-memory fallback
// Refactored: Uses Security Agent for KV credentials
// ============================================

import { createClient, type VercelKV } from '@vercel/kv';
import type { RateLimitResult } from './types.js';
import { RATE_LIMIT, RATE_LIMIT_STRICT, RATE_WINDOW } from './constants.js';
import { getSecret, getSecretSync } from './secrets-helper.js';

// In-memory fallback store
const inMemoryRateLimit = new Map<string, { count: number; resetAt: number }>();

// Lazy-load KV client (only if configured)
let kvClient: VercelKV | null = null;

/**
 * Get KV client (async version with Security Agent)
 * Exported for future async rate-limiting implementations
 */
export async function getKVClientAsync(): Promise<VercelKV | null> {
  if (kvClient) return kvClient;

  const [kvUrl, kvToken] = await Promise.all([
    getSecret('kv_rest_api_url', 'rate_limit'),
    getSecret('kv_rest_api_token', 'rate_limit'),
  ]);

  if (kvUrl && kvToken) {
    try {
      kvClient = createClient({
        url: kvUrl,
        token: kvToken,
      });
      console.log('✅ KV client initialized via Security Agent');
      return kvClient;
    } catch {
      console.warn('⚠️ Failed to create KV client, using in-memory fallback');
      return null;
    }
  }

  return null;
}

/**
 * Get KV client (sync version with fallback to env)
 * @deprecated Use getKVClientAsync for new code
 */
function getKVClient(): VercelKV | null {
  if (kvClient) return kvClient;

  const kvUrl = getSecretSync('kv_rest_api_url') || process.env.KV_REST_API_URL;
  const kvToken = getSecretSync('kv_rest_api_token') || process.env.KV_REST_API_TOKEN;

  if (kvUrl && kvToken) {
    try {
      kvClient = createClient({
        url: kvUrl,
        token: kvToken,
      });
      console.log('✅ KV client initialized');
      return kvClient;
    } catch {
      console.warn('⚠️ Failed to create KV client, using in-memory fallback');
      return null;
    }
  }

  return null;
}

/**
 * Check rate limit with async KV support
 * Falls back to in-memory if KV not configured
 */
export async function checkRateLimit(
  identifier: string,
  strict: boolean = false,
  limitOverride?: number
): Promise<RateLimitResult> {
  const limit =
    limitOverride !== undefined ? limitOverride : strict ? RATE_LIMIT_STRICT : RATE_LIMIT;
  const key = `rate:${identifier}`;

  const client = getKVClient();

  if (client) {
    // Use KV-backed rate limiting
    try {
      const current = await client.incr(key);

      // Set expiry on first request
      if (current === 1) {
        await client.expire(key, Math.floor(RATE_WINDOW / 1000));
      }

      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
      };
    } catch (error) {
      console.error('KV rate limit error:', error instanceof Error ? error.message : error);
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const now = Date.now();
  const entry = inMemoryRateLimit.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    inMemoryRateLimit.set(key, { count: 1, resetAt: now + RATE_WINDOW });
    return { allowed: true, remaining: limit - 1 };
  }

  entry.count++;

  if (entry.count > limit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: limit - entry.count };
}

/**
 * Clean up expired entries from in-memory store
 * Call periodically to prevent memory leaks
 */
export function cleanupExpiredEntries(): number {
  const now = Date.now();
  let cleaned = 0;

  const entries = Array.from(inMemoryRateLimit.entries());
  for (const [key, entry] of entries) {
    if (now > entry.resetAt) {
      inMemoryRateLimit.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Reset rate limit for an identifier (admin use)
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  const key = `rate:${identifier}`;

  const client = getKVClient();
  if (client) {
    try {
      await client.del(key);
    } catch (error) {
      console.error('Failed to reset KV rate limit:', error);
    }
  }

  inMemoryRateLimit.delete(key);
}

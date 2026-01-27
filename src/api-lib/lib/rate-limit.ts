// ============================================
// NeuroGUARDIAN — Rate Limiting
// KV-backed rate limiting with in-memory fallback
// Refactored: Uses Security Agent for KV credentials
// ============================================

import { Redis } from 'ioredis';
import type { RateLimitResult } from './types.js';
import { RATE_LIMIT, RATE_LIMIT_STRICT, RATE_WINDOW } from './constants.js';

// In-memory fallback store
const inMemoryRateLimit = new Map<string, { count: number; resetAt: number }>();

// Local Redis client
let redisClient: Redis | null = null;

/**
 * Get Redis client for rate limiting
 */
function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy: () => null, // Don't hang if redis is down
    });
    console.log('🚀 Redis Rate Limiter initialized');
    return redisClient;
  } catch (_e) {
    console.warn('⚠️ Redis connection failed for rate limiting, using memory fallback');
    return null;
  }
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

  const client = getRedisClient();

  if (client) {
    // Use Redis-backed rate limiting
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
      console.error('Redis rate limit error:', error instanceof Error ? error.message : error);
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

  const client = getRedisClient();
  if (client) {
    try {
      await client.del(key);
    } catch (error) {
      console.error('Failed to reset Redis rate limit:', error);
    }
  }

  inMemoryRateLimit.delete(key);
}

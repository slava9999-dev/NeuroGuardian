// ============================================
// NeuroGUARDIAN — Rate Limiting Middleware
// Distributed rate limiting using Vercel KV
// Version: 1.0.0 | Date: December 2024
// ============================================

import { kv } from '@vercel/kv';
import { logger } from './logger.js';

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  limit: number;

  /**
   * Time window in seconds
   */
  windowSeconds: number;

  /**
   * Identifier for the rate limit (e.g., user ID, IP address)
   */
  identifier: string;

  /**
   * Namespace for the rate limit key (e.g., 'agent', 'admin', 'api')
   */
  namespace: string;
}

export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;

  /**
   * Maximum requests allowed
   */
  limit: number;

  /**
   * Remaining requests in current window
   */
  remaining: number;

  /**
   * Unix timestamp when the rate limit resets
   */
  reset: number;

  /**
   * Number of requests made in current window
   */
  current: number;
}

/**
 * Check rate limit using sliding window algorithm
 *
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const { limit, windowSeconds, identifier, namespace } = config;

  // Validate inputs
  if (!identifier || !namespace) {
    logger.error('Rate limit: missing identifier or namespace', { config });
    // Fail open - allow request if configuration is invalid
    return {
      allowed: true,
      limit,
      remaining: limit,
      reset: Date.now() + windowSeconds * 1000,
      current: 0,
    };
  }

  const key = `ratelimit:${namespace}:${identifier}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const resetTime = now + windowMs;

  try {
    // Get current count
    const currentCount = (await kv.get<number>(key)) || 0;

    if (currentCount >= limit) {
      // Rate limit exceeded
      const ttl = await kv.ttl(key);
      const reset = ttl > 0 ? now + ttl * 1000 : resetTime;

      logger.warn('Rate limit exceeded', {
        namespace,
        identifier,
        current: currentCount,
        limit,
      });

      return {
        allowed: false,
        limit,
        remaining: 0,
        reset,
        current: currentCount,
      };
    }

    // Increment counter
    const newCount = await kv.incr(key);

    // Set expiry on first request in window
    if (newCount === 1) {
      await kv.expire(key, windowSeconds);
    }

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - newCount),
      reset: resetTime,
      current: newCount,
    };
  } catch (error) {
    logger.error('Rate limit check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      namespace,
      identifier,
    });

    // Fail open - allow request if KV is unavailable
    // This prevents rate limiting from breaking the entire service
    return {
      allowed: true,
      limit,
      remaining: limit,
      reset: resetTime,
      current: 0,
    };
  }
}

/**
 * Rate limit presets for different endpoint types
 */
export const RateLimitPresets = {
  /**
   * Admin endpoints - very strict (10 requests per minute)
   */
  ADMIN: {
    limit: 10,
    windowSeconds: 60,
  },

  /**
   * AI Agent endpoints - moderate (30 requests per minute)
   * Prevents Gemini API quota exhaustion
   */
  AGENT: {
    limit: 30,
    windowSeconds: 60,
  },

  /**
   * Sentinel checks - strict (5 requests per minute)
   */
  SENTINEL: {
    limit: 5,
    windowSeconds: 60,
  },

  /**
   * General API endpoints - lenient (100 requests per minute)
   */
  API: {
    limit: 100,
    windowSeconds: 60,
  },

  /**
   * Authentication endpoints - very strict (5 requests per 5 minutes)
   */
  AUTH: {
    limit: 5,
    windowSeconds: 300,
  },
} as const;

/**
 * Helper function to get identifier from request
 * Uses user ID if available, falls back to IP address
 */
export function getRequestIdentifier(userId?: number | string, ipAddress?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  if (ipAddress) {
    return `ip:${ipAddress}`;
  }

  return 'anonymous';
}

/**
 * Format rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(result.reset / 1000).toString(),
  };
}

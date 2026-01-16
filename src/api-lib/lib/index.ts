// ============================================
// NeuroGUARDIAN — Library Index
// Re-export all utilities
// ============================================
import { logger } from './logger.js';

// Types

// Types
export * from './types.js';

// Constants
export * from './constants.js';

// Subscriptions
export * from './subscription.js';

// Utilities
export { encryptApiKey, decryptApiKey } from './crypto.js';
export {
  sanitizeInput,
  sanitizeApiKey,
  isValidTelegramId,
  isValidPrice,
  isValidPercentage,
  isValidEmail,
  parsePeriod,
  parseOzonApiKey,
} from './validation.js';

/**
 * Fetch with retry for marketplace APIs (Industrial Grade)
 * Handles: 429 (Rate Limit) with exponential backoff, Network timeouts, Transient errors
 * @param url Request URL
 * @param options Request options
 * @param retries Number of retries (default: 3)
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  const initialDelay = 1000;

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // Increased to 30s for professional stability

      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);

        // Professional Status Handling
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : initialDelay * Math.pow(2, i);

          logger.warn(
            `[Resilience] 🚦 Rate limited (429) for ${url}. Waiting ${delay}ms before retry ${i + 1}/${retries}`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Handle other transient server errors (502, 503, 504)
        if (response.status >= 502 && response.status <= 504) {
          const delay = initialDelay * Math.pow(2, i);
          logger.warn(
            `[Resilience] ⚠️ Server error (${response.status}) for ${url}. Retrying in ${delay}ms...`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        return response;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    } catch (error) {
      lastError = error as Error;

      const isAbort = lastError.name === 'AbortError';
      const delay = initialDelay * Math.pow(2, i);

      logger.warn(
        `[Resilience] ❌ Fetch attempt ${i + 1} failed: ${isAbort ? 'Timeout' : lastError.message}. Retrying in ${delay}ms...`
      );

      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Fetch failed after ${retries} attempts`);
}

/**
 * Get ISO date string from period string (today, week, month, etc)
 */
export function getDateFromPeriod(period: string): string {
  const now = new Date();
  switch (period) {
    case 'today':
      return now.toISOString().split('T')[0];
    case 'yesterday':
      now.setDate(now.getDate() - 1);
      return now.toISOString().split('T')[0];
    case 'week':
      now.setDate(now.getDate() - 7);
      return now.toISOString().split('T')[0];
    case 'month':
      now.setMonth(now.getMonth() - 1);
      return now.toISOString().split('T')[0];
    case '3months':
      now.setMonth(now.getMonth() - 3);
      return now.toISOString().split('T')[0];
    default:
      now.setDate(now.getDate() - 7);
      return now.toISOString().split('T')[0];
  }
}
export { validateTelegramInitData, extractTelegramUser } from './telegram.js';
export { checkRateLimit, cleanupExpiredEntries, resetRateLimit } from './rate-limit.js';
export {
  checkRateLimit as checkRateLimitV2,
  RateLimitPresets,
  getRequestIdentifier,
  getRateLimitHeaders,
  type RateLimitConfig,
  type RateLimitResult as RateLimitResultV2,
} from './rateLimit.js';
export { logger, createLogger } from './logger.js';
export {
  getSecret,
  getSecretSync,
  warmupSecretsCache,
  clearSecretsCache,
} from './secrets-helper.js';

// Circuit Breaker
export {
  CircuitBreaker,
  CircuitBreakerPresets,
  CircuitOpenError,
  circuitBreakers,
  withCircuitBreaker,
} from './circuit-breaker.js';

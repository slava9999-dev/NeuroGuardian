// ============================================
// NeuroGUARDIAN — Library Index
// Re-export all utilities
// ============================================

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
 * Fetch with retry for marketplace APIs
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

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error as Error;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  throw lastError || new Error('Fetch failed');
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

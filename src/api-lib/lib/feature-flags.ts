import { sql } from '../services/database.js';
import { logger } from './logger.js';

const FLAG_CACHE_TTL = 60 * 1000; // 1 minute
const flagCache = new Map<string, { value: boolean; expires: number }>();

/**
 * Check if a system-wide feature flag is enabled
 */
export async function isFeatureEnabled(feature: string, defaultValue = false): Promise<boolean> {
  const cacheKey = `feature_${feature}`;
  const now = Date.now();

  // 1. Check Cache
  const cached = flagCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.value;
  }

  // 2. Check Environment Variable (Override)
  const envVar =
    process.env[`FEATURE_${feature.toUpperCase()}`] || process.env[feature.toUpperCase()];
  if (envVar !== undefined) {
    const value = envVar === 'true';
    flagCache.set(cacheKey, { value, expires: now + FLAG_CACHE_TTL });
    return value;
  }

  // 3. Check Database
  try {
    const result = await sql`SELECT value_bool FROM system_flags WHERE key = ${cacheKey}`;
    if (result.rows && result.rows.length > 0) {
      const value = !!result.rows[0].value_bool;
      flagCache.set(cacheKey, { value, expires: now + FLAG_CACHE_TTL });
      return value;
    }
  } catch (error) {
    logger.warn(`[FeatureFlags] Failed to read flag ${feature} from DB:`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // 4. Default
  return defaultValue;
}

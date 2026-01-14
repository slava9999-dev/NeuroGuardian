// ============================================
// NeuroGUARDIAN — Secrets Helper
// Centralized async secret fetching with caching
// ============================================

import { getSecurityAgent } from '@neuroguardian/security-agent';
import { sql } from '../services/database.js';

// In-memory cache for performance
const secretsCache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Get a secret from Security Agent with local caching
 * Falls back to DB and then process.env
 */
export async function getSecret(
  key: string,
  purpose: string = 'system_operation'
): Promise<string | undefined> {
  // Check local cache first
  const cached = secretsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // 1. Try Security Agent (Vault)
  const agent = getSecurityAgent();
  if (agent.isInitialized()) {
    try {
      const response = await agent.secrets.get({
        userId: 'system',
        key: key,
        purpose: purpose,
        ttl: 60,
      });

      if (response && response.value) {
        secretsCache.set(key, {
          value: response.value,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return response.value;
      }
    } catch (agentError) {
      console.warn(`[SecretsHelper] Vault retrieval failed for ${key}:`, agentError);
    }
  }

  // 2. Try Database (system_settings)
  try {
    const dbResult = await sql`SELECT value FROM system_settings WHERE key = ${key}`;
    if (dbResult.rows && dbResult.rows.length > 0) {
      const value = dbResult.rows[0].value;
      secretsCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      return value;
    }
  } catch (dbError) {
    // console.warn failed to read from system_settings
  }

  // 3. Last fallback: Environment Variables
  return getEnvFallback(key);
}

/**
 * Get secret synchronously from cache or env (for legacy compatibility)
 * NOTE: Prefer getSecret() for new code
 */
export function getSecretSync(key: string): string | undefined {
  const cached = secretsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  return getEnvFallback(key);
}

/**
 * Map secret key to environment variable name
 */
function getEnvFallback(key: string): string | undefined {
  const envMap: Record<string, string> = {
    admin_api_key: 'ADMIN_API_KEY',
    cron_secret: 'CRON_SECRET',
    telegram_bot_token: 'TELEGRAM_BOT_TOKEN',
    openai_api_key: 'OPENAI_API_KEY',
    groq_api_key: 'GROQ_API_KEY',
    serper_api_key: 'SERPER_API_KEY',
    api_key_encryption_key: 'API_KEY_ENCRYPTION_KEY',
    kv_rest_api_url: 'KV_REST_API_URL',
    kv_rest_api_token: 'KV_REST_API_TOKEN',
    yookassa_shop_id: 'YOOKASSA_SHOP_ID',
    yookassa_secret_key: 'YOOKASSA_SECRET_KEY',
    admin_chat_id: 'ADMIN_CHAT_ID',
  };

  const envVar = envMap[key] || key.toUpperCase();
  return process.env[envVar]?.trim();
}

/**
 * Pre-warm secrets cache (call at application startup)
 */
export async function warmupSecretsCache(): Promise<void> {
  const criticalSecrets = ['admin_api_key', 'cron_secret', 'telegram_bot_token', 'openai_api_key'];

  console.log('[SecretsHelper] Warming up secrets cache...');

  await Promise.allSettled(criticalSecrets.map(key => getSecret(key, 'cache_warmup')));

  console.log('[SecretsHelper] Cache warmed up');
}

/**
 * Clear secrets cache (for testing or security)
 */
export function clearSecretsCache(): void {
  secretsCache.clear();
}

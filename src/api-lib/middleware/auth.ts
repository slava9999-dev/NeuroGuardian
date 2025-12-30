// ============================================
// NeuroGUARDIAN — Authentication Middleware
// Reusable auth patterns for API handlers
// Refactored: Uses Security Agent via secrets-helper
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateTelegramInitData, sanitizeInput } from '../lib/index.js';
import { getSecret, getSecretSync } from '../lib/secrets-helper.js';
import { logOpsEvent } from '../services/ops-logger.js';

// ============================================
// TYPES
// ============================================

export interface AuthContext {
  userId: number;
  authMethod: 'telegram' | 'admin' | 'cron';
}

export type AuthResult =
  | { success: true; context: AuthContext }
  | { success: false; error: string; statusCode: number };

// ============================================
// AUTH EXTRACTORS
// ============================================

/**
 * Extract Telegram user ID from initData
 */
export function extractTelegramAuth(req: VercelRequest): AuthResult {
  const initData = sanitizeInput(
    (req.headers['x-init-data'] as string) || req.body?.initData || ''
  );

  const validation = validateTelegramInitData(initData);

  if (!validation.valid || !validation.user) {
    return {
      success: false,
      error: 'Unauthorized',
      statusCode: 401,
    };
  }

  return {
    success: true,
    context: {
      userId: validation.user.id,
      authMethod: 'telegram',
    },
  };
}

/**
 * Extract user ID from Admin API key (async version)
 */
export async function extractAdminAuthAsync(req: VercelRequest): Promise<AuthResult> {
  const adminKey = (req.headers['x-admin-key'] as string) || '';
  const adminUserId =
    req.body?.userId || req.body?.telegramId || req.query?.telegramId || req.query?.userId;

  const expectedAdminKey = await getSecret('admin_api_key', 'admin_auth');

  if (adminKey && expectedAdminKey && adminKey === expectedAdminKey) {
    return {
      success: true,
      context: {
        userId: adminUserId ? parseInt(adminUserId) : 0, // 0 = System Admin
        authMethod: 'admin',
      },
    };
  }

  return {
    success: false,
    error: 'Invalid admin credentials',
    statusCode: 401,
  };
}

/**
 * Extract user ID from Admin API key (sync fallback for legacy)
 * @deprecated Use extractAdminAuthAsync instead
 */
export function extractAdminAuth(req: VercelRequest): AuthResult {
  const adminKey = (req.headers['x-admin-key'] as string) || '';
  const adminUserId =
    req.body?.userId || req.body?.telegramId || req.query?.telegramId || req.query?.userId;

  const expectedAdminKey = getSecretSync('admin_api_key');

  if (adminKey && expectedAdminKey && adminKey === expectedAdminKey) {
    return {
      success: true,
      context: {
        userId: adminUserId ? parseInt(adminUserId) : 0, // 0 = System Admin
        authMethod: 'admin',
      },
    };
  }

  return {
    success: false,
    error: 'Invalid admin credentials',
    statusCode: 401,
  };
}

/**
 * Extract user ID from Cron/n8n Bearer token (async version)
 */
export async function extractCronAuthAsync(req: VercelRequest): Promise<AuthResult> {
  const authHeader = req.headers.authorization || '';

  // SUPPORT X-Telegram-Id HEADER detailed in Sentinel workflow
  const telegramId = req.headers['x-telegram-id'] || req.body?.telegramId || req.query?.telegramId;

  const cronSecret = await getSecret('cron_secret', 'cron_auth');

  // Ensure telegramId is a string
  const tgIdStr = Array.isArray(telegramId) ? telegramId[0] : (telegramId as undefined | string);

  console.log('[DEBUG] Cron Auth Check:', {
    hasAuthHeader: !!authHeader,
    authHeaderPrefix: authHeader.substring(0, 10) + '...',
    hasCronSecret: !!cronSecret,
    cronSecretMatch: cronSecret && authHeader === `Bearer ${cronSecret}`,
    tgIdStr,
    telegramIdRaw: telegramId,
  });

  if (cronSecret && authHeader === `Bearer ${cronSecret}` && tgIdStr) {
    return {
      success: true,
      context: {
        userId: parseInt(tgIdStr),
        authMethod: 'cron',
      },
    };
  }

  return {
    success: false,
    error: 'Invalid cron credentials',
    statusCode: 401,
  };
}

/**
 * Extract user ID from Cron/n8n Bearer token (sync fallback for legacy)
 * @deprecated Use extractCronAuthAsync instead
 */
export function extractCronAuth(req: VercelRequest): AuthResult {
  const authHeader = req.headers.authorization || '';
  const telegramId = req.body?.telegramId;

  const cronSecret = getSecretSync('cron_secret') || process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}` && telegramId) {
    return {
      success: true,
      context: {
        userId: parseInt(telegramId),
        authMethod: 'cron',
      },
    };
  }

  return {
    success: false,
    error: 'Invalid cron credentials',
    statusCode: 401,
  };
}

/**
 * Try all auth methods in order: Telegram → Admin → Cron (async version)
 */
export async function extractAnyAuthAsync(req: VercelRequest): Promise<AuthResult> {
  try {
    // Admin Key Bypass: Allow testing/admin access with valid admin key
    // This is safe because ADMIN_API_KEY itself is secret
    const adminKey = (
      (req.headers['x-admin-key'] as string) ||
      (req.query.key as string) ||
      ''
    ).trim();
    const telegramId = req.query?.telegramId || req.body?.telegramId;

    if (adminKey && telegramId) {
      // Get expected key with multiple fallbacks
      let expectedAdminKey: string | undefined;

      // Try Security Agent first
      try {
        expectedAdminKey = await getSecret('admin_api_key', 'admin_auth');
      } catch (secretError) {
        console.warn('[AUTH] getSecret failed:', secretError);
      }

      // Always check process.env as final fallback (most reliable on Vercel)
      const envKey = process.env.ADMIN_API_KEY;
      if (!expectedAdminKey && envKey) {
        expectedAdminKey = envKey;
        console.log('[AUTH] Using process.env.ADMIN_API_KEY fallback');
      }

      // Clean the expected key (remove quotes and whitespace)
      const cleanExpectedKey = expectedAdminKey?.replace(/['"]/g, '').trim();

      // Debug logging (safe - only shows first 8 chars)
      console.log('[AUTH] Key check:', {
        receivedKeyPrefix: adminKey.substring(0, 8) + '...',
        expectedKeyPrefix: cleanExpectedKey?.substring(0, 8) + '...',
        match: adminKey === cleanExpectedKey,
        telegramId,
      });

      if (cleanExpectedKey && adminKey === cleanExpectedKey) {
        console.log(`🔧 [AUTH] Admin-key bypass for user ${telegramId}`);
        return {
          success: true,
          context: {
            userId: parseInt(telegramId as string),
            authMethod: 'admin',
          },
        };
      }
    }
  } catch (err) {
    console.error('⚠️ Auth bypass error:', err);
  }

  // Try Telegram first (most common, sync)
  const telegramAuth = extractTelegramAuth(req);
  if (telegramAuth.success) return telegramAuth;

  // Try Admin key (async)
  const adminAuthRes = await extractAdminAuthAsync(req);
  if (adminAuthRes.success) return adminAuthRes;

  // Try Cron token (async)
  const cronAuth = await extractCronAuthAsync(req);
  if (cronAuth.success) return cronAuth;

  return {
    success: false,
    error: 'Unauthorized',
    statusCode: 401,
  };
}

/**
 * Try all auth methods in order: Telegram → Admin → Cron (sync fallback)
 * @deprecated Use extractAnyAuthAsync instead
 */
export function extractAnyAuth(req: VercelRequest): AuthResult {
  // Try Telegram first (most common)
  const telegramAuth = extractTelegramAuth(req);
  if (telegramAuth.success) return telegramAuth;

  // Try Admin key
  const adminAuth = extractAdminAuth(req);
  if (adminAuth.success) return adminAuth;

  // Try Cron token
  const cronAuth = extractCronAuth(req);
  if (cronAuth.success) return cronAuth;

  return {
    success: false,
    error: 'Unauthorized',
    statusCode: 401,
  };
}

/**
 * Verify admin-only access (ADMIN_API_KEY or CRON_SECRET) - async version
 */
export async function verifyAdminAccessAsync(req: VercelRequest): Promise<boolean> {
  const authHeader = req.headers.authorization || '';
  const adminKey = (req.headers['x-admin-key'] as string) || (req.query.key as string) || '';

  const [cronSecret, expectedAdminKey] = await Promise.all([
    getSecret('cron_secret', 'admin_access_verify'),
    getSecret('admin_api_key', 'admin_access_verify'),
  ]);

  const cronMatch = !!(cronSecret && authHeader === `Bearer ${cronSecret}`);
  const keyHeaderMatch = !!(expectedAdminKey && authHeader === `Bearer ${expectedAdminKey}`);
  const keyParamMatch = !!(expectedAdminKey && adminKey === expectedAdminKey);

  console.log('[DEBUG] Admin Access Check:', {
    hasAuthHeader: !!authHeader,
    authHeaderPrefix: authHeader.substring(0, 15) + '...',
    hasCronSecret: !!cronSecret,
    cronSecretPrefix: cronSecret ? cronSecret.substring(0, 5) + '...' : 'N/A',
    cronMatch,
    keyHeaderMatch,
    keyParamMatch,
  });

  return cronMatch || keyHeaderMatch || keyParamMatch;
}

/**
 * Verify admin-only access (ADMIN_API_KEY or CRON_SECRET) - sync fallback
 * @deprecated Use verifyAdminAccessAsync instead
 */
export function verifyAdminAccess(req: VercelRequest): boolean {
  const authHeader = req.headers.authorization || '';
  const adminKey = (req.headers['x-admin-key'] as string) || (req.query.key as string) || '';

  const cronSecret = getSecretSync('cron_secret');
  const expectedAdminKey = getSecretSync('admin_api_key');

  return !!(
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (expectedAdminKey && authHeader === `Bearer ${expectedAdminKey}`) ||
    (expectedAdminKey && adminKey === expectedAdminKey)
  );
}

// ============================================
// RESPONSE HELPERS
// ============================================

export function sendAuthError(
  res: VercelResponse,
  error: string,
  statusCode = 401,
  req?: VercelRequest
) {
  if (req) {
    logOpsEvent({
      eventType: 'auth_failed',
      eventSource: 'system',
      payload: {
        error,
        path: req.url,
        method: req.method,
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0],
        severity: 'warning',
        entityType: 'user',
      },
    });
  }
  return res.status(statusCode).json({ error, code: 'AUTH_FAILED' });
}

export function sendMethodNotAllowed(res: VercelResponse) {
  return res.status(405).json({ error: 'Method not allowed' });
}

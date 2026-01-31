// ============================================
// NeuroGUARDIAN — Authentication Middleware
// Reusable auth patterns for API handlers
// Refactored: Uses Security Agent via secrets-helper
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateTelegramInitData, sanitizeInput } from '../lib/index.js';
import { getSecret, getSecretSync } from '../lib/secrets-helper.js';
import { logOpsEvent } from '../services/ops-logger.js';
import type { TelegramUser } from '../services/database.js';
import { sql } from '../services/database.js';

// ============================================
// TYPES
// ============================================

export interface AuthContext {
  userId: string | number;
  authMethod: 'telegram' | 'admin' | 'cron';
  user?: TelegramUser; // Full user record including plan
}

export type AuthResult =
  | { success: true; context: AuthContext }
  | { success: false; error: string; statusCode: number };

/**
 * SaaS Handler Type
 */
export type SaaSHandler = (
  req: VercelRequest,
  res: VercelResponse,
  context: AuthContext
) => Promise<VercelResponse | void>;

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
        userId: adminUserId ? (adminUserId as string | number) : 0, // 0 = System Admin
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
        userId: adminUserId ? (adminUserId as string | number) : 0, // 0 = System Admin
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
        userId: tgIdStr,
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
        userId: String(telegramId),
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
  let userId: string | number | undefined;
  let authMethod: 'telegram' | 'admin' | 'cron' = 'telegram';

  // Try Telegram
  const telegramAuth = extractTelegramAuth(req);
  if (telegramAuth.success) {
    userId = telegramAuth.context.userId;
    authMethod = 'telegram';
  } else {
    // Try Admin
    const adminAuthRes = await extractAdminAuthAsync(req);
    if (adminAuthRes.success) {
      userId = adminAuthRes.context.userId;
      authMethod = 'admin';
    } else {
      // Try Cron
      const cronAuth = await extractCronAuthAsync(req);
      if (cronAuth.success) {
        userId = cronAuth.context.userId;
        authMethod = 'cron';
      }
    }
  }

  if (userId === undefined) {
    return { success: false, error: 'Unauthorized', statusCode: 401 };
  }

  // SYSTEM ADMIN BYPASS: userId 0 is reserved for global system control
  if (userId === 0 || userId === '0') {
    return {
      success: true,
      context: {
        userId,
        authMethod,
        user: {
          id: 0,
          first_name: 'System',
          last_name: 'Admin',
          is_active: true,
          subscription_active: true,
          subscription_plan: 'premium',
          protection_enabled: true,
          defense_mode: 'price_correction',
          total_products: 0,
        } as TelegramUser,
      },
    };
  }

  // ENRICH WITH USER DATA (SaaS Isolation Layer)
  const userRes = await sql`SELECT * FROM users WHERE id = ${userId}`;
  if (userRes.rows.length === 0) {
    return { success: false, error: 'User registration required', statusCode: 403 };
  }

  return {
    success: true,
    context: {
      userId,
      authMethod,
      user: userRes.rows[0],
    },
  };
}

/**
 * withAuth HOF: Strictly enforces multi-tenancy rules
 */
// ...
export function withAuth(handler: SaaSHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const auth = await extractAnyAuthAsync(req);

    if (auth.success === false) {
      return sendAuthError(res, auth.error, auth.statusCode, req);
    }

    // SaaS Isolation: User must be active
    if (!auth.context.user?.is_active) {
      return res.status(403).json({ error: 'Account frozen. Please update subscription.' });
    }

    try {
      return await handler(req, res, auth.context);
    } catch (error) {
      console.error(`[withAuth] Error in handler ${req.url}:`, error);
      return res.status(500).json({
        error: 'Internal Server Error',
        requestId: req.headers['x-vercel-id'],
      });
    }
  };
}
// ...

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
  const adminKey = (req.headers['x-admin-key'] as string) || '';

  const [cronSecret, expectedAdminKey] = await Promise.all([
    getSecret('cron_secret', 'admin_access_verify'),
    getSecret('admin_api_key', 'admin_access_verify'),
  ]);

  const cleanCronSecret = cronSecret?.replace(/['"]/g, '').trim();
  const cleanAdminKey = expectedAdminKey?.replace(/['"]/g, '').trim();
  const cleanReceivedKey = adminKey?.replace(/['"]/g, '').trim();

  const cronMatch = !!(cleanCronSecret && authHeader === `Bearer ${cleanCronSecret}`);
  const keyHeaderMatch = !!(cleanAdminKey && authHeader === `Bearer ${cleanAdminKey}`);
  const keyParamMatch = !!(cleanAdminKey && cleanReceivedKey === cleanAdminKey);

  console.log('[DEBUG] Admin Access Check:', {
    hasAuthHeader: !!authHeader,
    authHeaderPrefix: authHeader.substring(0, 15) + '...',
    hasCronSecret: !!cronSecret,
    cronSecretPrefix: cronSecret ? cronSecret.substring(0, 5) + '...' : 'N/A',
    cronMatch,
    keyHeaderMatch,
    keyParamMatch,
    debugComparison: {
      received: adminKey
        ? `${adminKey.substring(0, 5)}...${adminKey.slice(-5)} (len=${adminKey.length})`
        : 'missing',
      expected: expectedAdminKey
        ? `${expectedAdminKey.substring(0, 5)}...${expectedAdminKey.slice(-5)} (len=${expectedAdminKey.length})`
        : 'missing',
      isMatch: adminKey === expectedAdminKey,
    },
  });

  return cronMatch || keyHeaderMatch || keyParamMatch;
}

/**
 * Verify admin-only access (ADMIN_API_KEY or CRON_SECRET) - sync fallback
 * @deprecated Use verifyAdminAccessAsync instead
 */
export function verifyAdminAccess(req: VercelRequest): boolean {
  const authHeader = req.headers.authorization || '';
  const adminKey = (req.headers['x-admin-key'] as string) || '';

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

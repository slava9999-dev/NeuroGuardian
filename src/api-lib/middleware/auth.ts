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
  const adminUserId = req.body?.userId || req.body?.telegramId;

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
  const adminUserId = req.body?.userId || req.body?.telegramId;

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
  const telegramId = req.body?.telegramId;

  const cronSecret = await getSecret('cron_secret', 'cron_auth');

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
  // Try Telegram first (most common, sync)
  const telegramAuth = extractTelegramAuth(req);
  if (telegramAuth.success) return telegramAuth;

  // Try Admin key (async)
  const adminAuth = await extractAdminAuthAsync(req);
  if (adminAuth.success) return adminAuth;

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

  return !!(
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (expectedAdminKey && authHeader === `Bearer ${expectedAdminKey}`) ||
    (expectedAdminKey && adminKey === expectedAdminKey)
  );
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

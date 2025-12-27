// ============================================
// NeuroGUARDIAN — Authentication Middleware
// Reusable auth patterns for API handlers
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateTelegramInitData, sanitizeInput } from '../lib/index.js';

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
 * Extract user ID from Admin API key
 */
export function extractAdminAuth(req: VercelRequest): AuthResult {
  const adminKey = (req.headers['x-admin-key'] as string) || '';
  const adminUserId = req.body?.userId || req.body?.telegramId;

  if (adminKey === process.env.ADMIN_API_KEY && adminUserId) {
    return {
      success: true,
      context: {
        userId: parseInt(adminUserId),
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
 * Extract user ID from Cron/n8n Bearer token
 */
export function extractCronAuth(req: VercelRequest): AuthResult {
  const authHeader = req.headers.authorization || '';
  const telegramId = req.body?.telegramId;

  if (authHeader === `Bearer ${process.env.CRON_SECRET}` && telegramId) {
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
 * Try all auth methods in order: Telegram → Admin → Cron
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
 * Verify admin-only access (ADMIN_API_KEY or CRON_SECRET)
 */
export function verifyAdminAccess(req: VercelRequest): boolean {
  const authHeader = req.headers.authorization || '';
  const adminKey = (req.headers['x-admin-key'] as string) || (req.query.key as string) || '';

  return (
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    authHeader === `Bearer ${process.env.ADMIN_API_KEY}` ||
    adminKey === process.env.ADMIN_API_KEY
  );
}

// ============================================
// RESPONSE HELPERS
// ============================================

export function sendAuthError(res: VercelResponse, error: string, statusCode = 401) {
  return res.status(statusCode).json({ error, code: 'AUTH_FAILED' });
}

export function sendMethodNotAllowed(res: VercelResponse) {
  return res.status(405).json({ error: 'Method not allowed' });
}

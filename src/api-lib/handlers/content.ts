// ============================================
// NeuroGUARDIAN — Content Generation Handler (DISABLED)
// Version: 1.0.1 | Date: January 2026
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Handle content generation request (DISABLED)
 */
export async function handleGenerateContent(
  _req: VercelRequest,
  res: VercelResponse,
  _userId: string | number
): Promise<VercelResponse> {
  return res.status(410).json({
    success: false,
    error: 'FEATURE_DISABLED',
    message: 'Модуль генерации контента временно отключен в рамках оптимизации системы.',
  });
}

/**
 * Get content quota status (DISABLED)
 */
export async function handleContentQuota(
  _req: VercelRequest,
  res: VercelResponse,
  _userId: string | number
): Promise<VercelResponse> {
  return res.json({
    success: true,
    tier: 'none',
    limit: 0,
    used: 0,
    remaining: 0,
    message: 'Модуль отключен.',
  });
}

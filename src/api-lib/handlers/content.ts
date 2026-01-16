// ============================================
// NeuroGUARDIAN — Content Generation Handler
// API endpoint for SMM content generation
// Version: 1.0.0 | Date: January 2026
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  contentSpecialist,
  type ContentPlatform,
} from '../../agent/specialists/ContentSpecialist.js';
import { logger } from '../lib/logger.js';

const VALID_PLATFORMS: ContentPlatform[] = ['instagram', 'telegram', 'wb_desc', 'ozon_desc'];
const VALID_STYLES = ['professional', 'friendly', 'luxury', 'casual'];

/**
 * Handle content generation request
 * POST /api?action=generate-content
 */
export async function handleGenerateContent(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { productId, platform, style, includeImage } = req.body || {};

    // Validate productId
    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({
        error: 'Invalid productId',
        message: 'productId is required and must be a string',
      });
    }

    // Validate platform
    if (!platform || !VALID_PLATFORMS.includes(platform as ContentPlatform)) {
      return res.status(400).json({
        error: 'Invalid platform',
        message: `platform must be one of: ${VALID_PLATFORMS.join(', ')}`,
      });
    }

    // Validate style (optional)
    if (style && !VALID_STYLES.includes(style)) {
      return res.status(400).json({
        error: 'Invalid style',
        message: `style must be one of: ${VALID_STYLES.join(', ')}`,
      });
    }

    // Check cache first
    const cached = await contentSpecialist.getCachedContent(
      userId,
      productId,
      platform as ContentPlatform
    );
    if (cached && !includeImage) {
      logger.info('[ContentHandler] Returning cached content', { userId, productId, platform });
      return res.json({
        success: true,
        fromCache: true,
        ...cached,
        platform,
        quotaRemaining: -1, // Unknown from cache
      });
    }

    // Generate new content
    const result = await contentSpecialist.generateContent(userId, {
      productId,
      platform: platform as ContentPlatform,
      style: style || 'professional',
      includeImage: Boolean(includeImage),
    });

    if (!result.success) {
      return res.status(result.error?.includes('Лимит') ? 402 : 400).json(result);
    }

    return res.json(result);
  } catch (error) {
    logger.error('[ContentHandler] Error', { error, userId });
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get content quota status
 * GET /api?action=content-quota
 */
export async function handleContentQuota(
  _req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  try {
    const { sql } = await import('../services/database.js');

    const result = await sql`
      SELECT 
        subscription_plan,
        COALESCE(generated_content_count, 0) as used_count
      FROM users
      WHERE id = ${userId}
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { subscription_plan, used_count } = result.rows[0];
    const tier = subscription_plan || 'free';

    const limits: Record<string, number> = {
      free: 0,
      basic: 20,
      pro: 100,
      business: 500,
    };

    const limit = limits[tier] || 0;
    const used = Number(used_count);
    const remaining = Math.max(0, limit - used);

    return res.json({
      success: true,
      tier,
      limit,
      used,
      remaining,
      resetDay: 1, // First day of month
    });
  } catch (error) {
    logger.error('[ContentQuota] Error', { error, userId });
    return res.status(500).json({ error: 'Failed to get quota' });
  }
}

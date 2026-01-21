// ============================================
// NeuroGUARDIAN — Validator Metrics Handler
// API endpoint for validation and threat analytics
// Version: 1.0.0 | Date: January 2026
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { responseValidator } from '../../agent/core/ResponseValidator.js';
import { validationLogService, threatHistoryService } from '../services/validation-log.service.js';
import { browserEyes } from '../../sentinel/BrowserEyes.js';
import { extractAnyAuthAsync, sendAuthError } from '../middleware/auth.js';
import { verifyAdminAccessAsync } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

/**
 * Handle /api?action=validator-metrics
 * Returns validation and threat statistics
 */
export async function handleValidatorMetrics(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  try {
    // Support both admin and user-specific requests
    const isAdmin = await verifyAdminAccessAsync(req);

    let userId: string | undefined;

    if (!isAdmin) {
      // User auth required for non-admin
      const auth = await extractAnyAuthAsync(req);
      if (!auth.success) {
        return sendAuthError(res, auth.error, auth.statusCode);
      }
      userId = String(auth.context.userId);
    }

    // Parse query parameters
    const hours = parseInt((req.query.hours as string) || '24', 10);
    const includeThreats = req.query.includeThreats !== 'false';
    const includeLogs = req.query.includeLogs !== 'false';

    const response: {
      success: boolean;
      timestamp: string;
      inMemoryMetrics?: ReturnType<typeof responseValidator.getMetrics>;
      browserEyes?: ReturnType<typeof browserEyes.getMetrics>;
      validation?: Awaited<ReturnType<typeof validationLogService.getStats>>;
      threats?: Awaited<ReturnType<typeof threatHistoryService.getStats>>;
    } = {
      success: true,
      timestamp: new Date().toISOString(),
    };

    // Always include in-memory metrics
    response.inMemoryMetrics = responseValidator.getMetrics();
    response.browserEyes = browserEyes.getMetrics();

    // Include validation DB stats
    if (includeLogs) {
      response.validation = await validationLogService.getStats(userId, hours);
    }

    // Include threat history stats
    if (includeThreats) {
      response.threats = await threatHistoryService.getStats(userId, hours);
    }

    logger.info('[ValidatorMetrics] Stats retrieved', {
      isAdmin,
      userId: (userId || 'all') as any,
      hours,
    });

    return res.status(200).json(response);
  } catch (error) {
    logger.error('[ValidatorMetrics] Error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve metrics',
    });
  }
}

/**
 * Handle /api?action=threat-history
 * Returns threat history for a specific product or user
 */
export async function handleThreatHistory(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  try {
    // Auth required
    const auth = await extractAnyAuthAsync(req);
    if (!auth.success) {
      return sendAuthError(res, auth.error, auth.statusCode);
    }

    const productId = req.query.productId as string | undefined;
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const hours = parseInt((req.query.hours as string) || '168', 10); // 7 days default

    if (productId) {
      // Get history for specific product
      const history = await threatHistoryService.getProductHistory(productId, limit);
      return res.status(200).json({
        success: true,
        productId,
        history,
      });
    } else {
      // Get overall stats for user
      const stats = await threatHistoryService.getStats(String(auth.context.userId), hours);
      return res.status(200).json({
        success: true,
        stats,
      });
    }
  } catch (error) {
    logger.error('[ThreatHistory] Error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve threat history',
    });
  }
}

/**
 * Handle /api?action=reset-validator-metrics
 * Admin-only: Reset in-memory validation metrics
 */
export async function handleResetValidatorMetrics(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  try {
    const isAdmin = await verifyAdminAccessAsync(req);
    if (!isAdmin) {
      return sendAuthError(res, 'Admin access required', 403);
    }

    responseValidator.resetMetrics();

    logger.info('[ValidatorMetrics] Metrics reset by admin');

    return res.status(200).json({
      success: true,
      message: 'Validation metrics reset successfully',
      newMetrics: responseValidator.getMetrics(),
    });
  } catch (error) {
    logger.error('[ValidatorMetrics] Reset error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset metrics',
    });
  }
}

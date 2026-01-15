// ============================================
// NeuroGUARDIAN — Quota Service
// Manages AI usage limits and quotas
// ============================================

import { sql } from './database.js';
import { logger } from '../lib/logger.js';

export interface UsageQuota {
  planId: string;
  limit: number;
  current: number;
}

export class QuotaService {
  /**
   * Check if user has enough quota for an operation
   */
  async checkQuota(
    userId: number,
    _serviceType: string
  ): Promise<{ allowed: boolean; remaining: number }> {
    // 1. Get user's plan and base limit

    const userRes = await sql`
      SELECT u.subscription_plan, p.ai_tokens_limit 
      FROM users u
      JOIN subscription_plans p ON u.subscription_plan = p.id
      WHERE u.id = ${userId}
    `;

    if (userRes.rows.length === 0) return { allowed: false, remaining: 0 };

    const { ai_tokens_limit: limit } = userRes.rows[0];

    // 2. Get current usage for this month

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usageRes = await sql`
      SELECT SUM(amount) as total 
      FROM usage_logs 
      WHERE user_id = ${userId} 
      AND created_at >= ${startOfMonth.toISOString()}
    `;

    const currentUsage = parseInt(usageRes.rows[0]?.total || '0');

    return {
      allowed: currentUsage < limit,
      remaining: Math.max(0, limit - currentUsage),
    };
  }

  /**
   * Log service usage
   */
  async logUsage(
    userId: number,
    serviceType: string,
    amount: number = 1,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      await sql`
        INSERT INTO usage_logs (user_id, service_type, amount, metadata)
        VALUES (${userId}, ${serviceType}, ${amount}, ${JSON.stringify(metadata)})
      `;
    } catch (error) {
      logger.error('[QuotaService] Failed to log usage', { userId, serviceType, error });
    }
  }
}

export const quotaService = new QuotaService();

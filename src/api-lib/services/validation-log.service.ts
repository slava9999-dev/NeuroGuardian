// ============================================
// NeuroGUARDIAN — Validation Log Service
// Persists validation failures to DB for analytics
// Version: 1.0.0 | Date: January 2026
// ============================================

import { db, validationLogs, threatHistory } from '../../infrastructure/database/db.js';
import { logger } from '../lib/logger.js';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import type { ValidationIssue, ValidationMetrics } from '../../agent/core/ResponseValidator.js';
import type { Threat } from '../../sentinel/ThreatDetector.js';

// ============================================
// TYPES
// ============================================

interface ValidationLogEntry {
  userId?: string;
  score: number;
  passed: boolean;
  issues: ValidationIssue[];
  queryPreview: string;
  responseLength: number;
  processingTimeMs?: number;
}

interface ThreatLogEntry {
  userId: string;
  productId: string;
  nmId?: string | null;
  marketplace: 'WB' | 'Ozon';
  threat: Threat;
  actionTaken?: 'auto_fixed' | 'user_confirmed' | 'ignored' | 'pending';
  priceBeforeFix?: number;
  priceAfterFix?: number;
}

export interface ValidationStats {
  total: number;
  passed: number;
  failed: number;
  criticalCount: number;
  passRate: number;
  avgScore: number;
  issueBreakdown: Record<string, number>;
  recentFailures: Array<{
    id: number;
    score: number;
    issueTypes: string[];
    queryPreview: string;
    createdAt: Date;
  }>;
}

export interface ThreatStats {
  total: number;
  resolved: number;
  pending: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  recentThreats: Array<{
    id: number;
    productId: string;
    threatType: string;
    severity: string;
    message: string;
    actionTaken: string | null;
    createdAt: Date;
  }>;
}

// ============================================
// VALIDATION LOG SERVICE
// ============================================

class ValidationLogService {
  /**
   * Log a validation result to the database
   */
  async logValidation(entry: ValidationLogEntry): Promise<void> {
    try {
      const issueTypes = entry.issues.map(i => i.type);
      const hasCritical = entry.issues.some(i => i.severity === 'critical');

      await db.insert(validationLogs).values({
        userId: entry.userId || null,
        score: entry.score,
        passed: entry.passed,
        issueTypes: JSON.stringify(issueTypes),
        issueCount: entry.issues.length,
        hasCritical,
        queryPreview: entry.queryPreview.substring(0, 100),
        responseLength: entry.responseLength,
        processingTimeMs: entry.processingTimeMs || 0,
      });

      // Log warning for critical failures
      if (hasCritical) {
        logger.warn('[ValidationLogService] Critical validation failure logged', {
          score: entry.score,
          issueTypes,
        });
      }
    } catch (error) {
      // Non-blocking - don't fail the request if logging fails
      logger.error('[ValidationLogService] Failed to log validation', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get validation statistics for analytics
   */
  async getStats(userId?: string, hours: number = 24): Promise<ValidationStats> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const whereClause = userId
      ? and(eq(validationLogs.userId, userId), gte(validationLogs.createdAt, since))
      : gte(validationLogs.createdAt, since);

    // Get aggregated stats
    const statsResult = await db
      .select({
        total: sql<number>`count(*)`,
        passed: sql<number>`sum(case when ${validationLogs.passed} then 1 else 0 end)`,
        failed: sql<number>`sum(case when not ${validationLogs.passed} then 1 else 0 end)`,
        criticalCount: sql<number>`sum(case when ${validationLogs.hasCritical} then 1 else 0 end)`,
        avgScore: sql<number>`avg(${validationLogs.score})`,
      })
      .from(validationLogs)
      .where(whereClause);

    const stats = statsResult[0] || {
      total: 0,
      passed: 0,
      failed: 0,
      criticalCount: 0,
      avgScore: 100,
    };

    // Get recent failures
    const recentFailures = await db
      .select({
        id: validationLogs.id,
        score: validationLogs.score,
        issueTypes: validationLogs.issueTypes,
        queryPreview: validationLogs.queryPreview,
        createdAt: validationLogs.createdAt,
      })
      .from(validationLogs)
      .where(and(whereClause, eq(validationLogs.passed, false)))
      .orderBy(desc(validationLogs.createdAt))
      .limit(10);

    // Calculate issue breakdown from recent failures
    const issueBreakdown: Record<string, number> = {};
    for (const failure of recentFailures) {
      try {
        const types = JSON.parse(failure.issueTypes || '[]') as string[];
        for (const type of types) {
          issueBreakdown[type] = (issueBreakdown[type] || 0) + 1;
        }
      } catch {
        // Skip malformed JSON
      }
    }

    return {
      total: Number(stats.total) || 0,
      passed: Number(stats.passed) || 0,
      failed: Number(stats.failed) || 0,
      criticalCount: Number(stats.criticalCount) || 0,
      passRate:
        stats.total > 0 ? Math.round((Number(stats.passed) / Number(stats.total)) * 100) : 100,
      avgScore: Math.round(Number(stats.avgScore) || 100),
      issueBreakdown,
      recentFailures: recentFailures.map(f => ({
        id: f.id,
        score: f.score,
        issueTypes: JSON.parse(f.issueTypes || '[]'),
        queryPreview: f.queryPreview || '',
        createdAt: f.createdAt || new Date(),
      })),
    };
  }

  /**
   * Get current in-memory metrics from ResponseValidator
   * Combined with DB stats for a complete picture
   */
  async getCombinedMetrics(
    inMemoryMetrics: ValidationMetrics,
    userId?: string
  ): Promise<ValidationStats & { inMemory: ValidationMetrics }> {
    const dbStats = await this.getStats(userId, 24);
    return {
      ...dbStats,
      inMemory: inMemoryMetrics,
    };
  }
}

// ============================================
// THREAT HISTORY SERVICE
// ============================================

class ThreatHistoryService {
  /**
   * Log a threat detection to history
   */
  async logThreat(entry: ThreatLogEntry): Promise<number> {
    try {
      const result = await db
        .insert(threatHistory)
        .values({
          userId: entry.userId,
          productId: entry.productId,
          nmId: entry.nmId || null,
          marketplace: entry.marketplace,
          threatType: entry.threat.type,
          severity: entry.threat.severity,
          message: entry.threat.message,
          threatData: JSON.stringify(entry.threat.data),
          actionTaken: entry.actionTaken || 'pending',
          priceBeforeFix: entry.priceBeforeFix || null,
          priceAfterFix: entry.priceAfterFix || null,
        })
        .returning({ id: threatHistory.id });

      logger.info('[ThreatHistoryService] Threat logged', {
        threatType: entry.threat.type,
        severity: entry.threat.severity,
        productId: entry.productId,
      });

      return result[0]?.id || 0;
    } catch (error) {
      logger.error('[ThreatHistoryService] Failed to log threat', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Mark a threat as resolved
   */
  async resolveThreat(
    threatId: number,
    actionTaken: 'auto_fixed' | 'user_confirmed' | 'ignored',
    priceAfterFix?: number
  ): Promise<void> {
    await db
      .update(threatHistory)
      .set({
        actionTaken,
        priceAfterFix: priceAfterFix || undefined,
        resolvedAt: new Date(),
      })
      .where(eq(threatHistory.id, threatId));
  }

  /**
   * Get threat statistics for analytics
   */
  async getStats(userId?: string, hours: number = 168): Promise<ThreatStats> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const whereClause = userId
      ? and(eq(threatHistory.userId, userId), gte(threatHistory.createdAt, since))
      : gte(threatHistory.createdAt, since);

    // Get aggregated stats
    const statsResult = await db
      .select({
        total: sql<number>`count(*)`,
        resolved: sql<number>`sum(case when ${threatHistory.resolvedAt} is not null then 1 else 0 end)`,
        pending: sql<number>`sum(case when ${threatHistory.resolvedAt} is null then 1 else 0 end)`,
      })
      .from(threatHistory)
      .where(whereClause);

    const stats = statsResult[0] || { total: 0, resolved: 0, pending: 0 };

    // Get severity breakdown
    const severityResult = await db
      .select({
        severity: threatHistory.severity,
        count: sql<number>`count(*)`,
      })
      .from(threatHistory)
      .where(whereClause)
      .groupBy(threatHistory.severity);

    const bySeverity: Record<string, number> = {};
    for (const row of severityResult) {
      bySeverity[row.severity] = Number(row.count);
    }

    // Get type breakdown
    const typeResult = await db
      .select({
        threatType: threatHistory.threatType,
        count: sql<number>`count(*)`,
      })
      .from(threatHistory)
      .where(whereClause)
      .groupBy(threatHistory.threatType);

    const byType: Record<string, number> = {};
    for (const row of typeResult) {
      byType[row.threatType] = Number(row.count);
    }

    // Get recent threats
    const recentThreats = await db
      .select({
        id: threatHistory.id,
        productId: threatHistory.productId,
        threatType: threatHistory.threatType,
        severity: threatHistory.severity,
        message: threatHistory.message,
        actionTaken: threatHistory.actionTaken,
        createdAt: threatHistory.createdAt,
      })
      .from(threatHistory)
      .where(whereClause)
      .orderBy(desc(threatHistory.createdAt))
      .limit(20);

    return {
      total: Number(stats.total) || 0,
      resolved: Number(stats.resolved) || 0,
      pending: Number(stats.pending) || 0,
      bySeverity,
      byType,
      recentThreats: recentThreats.map(t => ({
        id: t.id,
        productId: t.productId,
        threatType: t.threatType,
        severity: t.severity,
        message: t.message || '',
        actionTaken: t.actionTaken,
        createdAt: t.createdAt || new Date(),
      })),
    };
  }

  /**
   * Get threat history for a specific product
   */
  async getProductHistory(
    productId: string,
    limit: number = 50
  ): Promise<
    Array<{
      id: number;
      threatType: string;
      severity: string;
      message: string;
      actionTaken: string | null;
      priceBeforeFix: number | null;
      priceAfterFix: number | null;
      createdAt: Date;
      resolvedAt: Date | null;
    }>
  > {
    const history = await db
      .select({
        id: threatHistory.id,
        threatType: threatHistory.threatType,
        severity: threatHistory.severity,
        message: threatHistory.message,
        actionTaken: threatHistory.actionTaken,
        priceBeforeFix: threatHistory.priceBeforeFix,
        priceAfterFix: threatHistory.priceAfterFix,
        createdAt: threatHistory.createdAt,
        resolvedAt: threatHistory.resolvedAt,
      })
      .from(threatHistory)
      .where(eq(threatHistory.productId, productId))
      .orderBy(desc(threatHistory.createdAt))
      .limit(limit);

    return history.map(entry => ({
      ...entry,
      message: entry.message || '',
      createdAt: entry.createdAt || new Date(),
    }));
  }
}

// Export singleton instances
export const validationLogService = new ValidationLogService();
export const threatHistoryService = new ThreatHistoryService();

// ============================================
// NeuroGUARDIAN — Media Queue Service
// Async job processing with Upstash QStash
// Version: 1.0.0 | Date: January 2026
// ============================================

import { sql } from '../api-lib/services/database.js';

// Simple logger for this module
const logger = {
  info: (msg: string, data?: object) => console.log(`[INFO] ${msg}`, JSON.stringify(data || {})),
  warn: (msg: string, data?: object) => console.warn(`[WARN] ${msg}`, JSON.stringify(data || {})),
  error: (msg: string, data?: object) =>
    console.error(`[ERROR] ${msg}`, JSON.stringify(data || {})),
};

// ============================================
// Types
// ============================================

export type JobType =
  | 'vision_analyze'
  | 'render_white_bg'
  | 'render_lifestyle'
  | 'render_watermark'
  | 'ingest_marketplace_image'
  | 'onboarding_analysis';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface MediaJob {
  id: string;
  type: JobType;
  status: JobStatus;
  user_id: number;
  productId?: string;

  sourceImageUrl: string;
  resultImageUrl?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  processingTimeMs?: number;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  avgProcessingTimeMs: number;
}

// ============================================
// Media Queue Service
// ============================================

export class MediaQueueService {
  private qstashToken: string;
  private webhookUrl: string;

  constructor() {
    this.qstashToken = process.env.QSTASH_TOKEN || '';
    this.webhookUrl = process.env.MEDIA_WEBHOOK_URL || '';

    if (!this.qstashToken) {
      logger.warn('[MediaQueue] QSTASH_TOKEN not configured, using in-memory queue');
    }
  }

  /**
   * Initialize database table for job tracking
   */
  async init(): Promise<void> {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS media_jobs (
          id VARCHAR(100) PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          user_id BIGINT NOT NULL,
          product_id VARCHAR(100),
          source_image_url TEXT NOT NULL,
          result_image_url TEXT,
          metadata JSONB,

          error TEXT,
          attempts INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 3,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          started_at TIMESTAMP,
          completed_at TIMESTAMP,
          processing_time_ms INTEGER
        )
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_media_jobs_status ON media_jobs(status)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_media_jobs_product ON media_jobs(product_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_media_jobs_user_id ON media_jobs(user_id)`;

      // Migration: Add user_id if missing from existing table
      await sql`ALTER TABLE media_jobs ADD COLUMN IF NOT EXISTS user_id BIGINT DEFAULT 0`;

      logger.info('[MediaQueue] Database initialized');
    } catch (error) {
      logger.error('[MediaQueue] Failed to init database', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Enqueue a new job
   */
  async enqueue(
    type: JobType,
    sourceImageUrl: string,
    options: {
      userId: number;
      productId?: string;
      metadata?: Record<string, unknown>;
      priority?: 'high' | 'normal' | 'low';
    }
  ): Promise<string> {
    const jobId = `job_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Save to database
    await sql`
      INSERT INTO media_jobs (id, type, status, user_id, product_id, source_image_url, metadata)
      VALUES (
        ${jobId},
        ${type},
        'pending',
        ${options.userId},
        ${options.productId || null},
        ${sourceImageUrl},
        ${JSON.stringify(options.metadata || {})}
      )
    `;

    // Send to QStash for async processing
    if (this.qstashToken && this.webhookUrl) {
      await this.sendToQStash(jobId, type, sourceImageUrl, options?.metadata);
    } else {
      // Fallback: Process synchronously (for development)
      logger.warn('[MediaQueue] No QStash configured, job will be processed on next poll');
    }

    logger.info('[MediaQueue] Job enqueued', {
      jobId,
      type,
      productId: options?.productId,
    });

    return jobId;
  }

  /**
   * Get job status
   */
  async getJob(jobId: string): Promise<MediaJob | null> {
    const result = await sql`
      SELECT * FROM media_jobs WHERE id = ${jobId}
    `;

    if (result.rows.length === 0) return null;

    return this.rowToJob(result.rows[0]);
  }

  /**
   * Get jobs by product
   */
  async getJobsByProduct(productId: string): Promise<MediaJob[]> {
    const result = await sql`
      SELECT * FROM media_jobs 
      WHERE product_id = ${productId}
      ORDER BY created_at DESC
    `;

    return result.rows.map((row: Record<string, unknown>) => this.rowToJob(row));
  }

  /**
   * Update job status
   */
  async updateJob(
    jobId: string,
    update: Partial<{
      status: JobStatus;
      resultImageUrl: string;
      error: string;
      metadata: Record<string, unknown>;
    }>
  ): Promise<void> {
    const now = new Date();

    if (update.status === 'processing') {
      await sql`
        UPDATE media_jobs 
        SET status = ${update.status}, 
            started_at = ${now},
            attempts = attempts + 1
        WHERE id = ${jobId}
      `;
    } else if (update.status === 'completed' || update.status === 'failed') {
      // Calculate processing time
      const job = await this.getJob(jobId);
      const processingTime = job?.startedAt
        ? now.getTime() - new Date(job.startedAt).getTime()
        : null;

      await sql`
        UPDATE media_jobs 
        SET status = ${update.status},
            result_image_url = COALESCE(${update.resultImageUrl || null}, result_image_url),
            error = ${update.error || null},
            completed_at = ${now},
            processing_time_ms = ${processingTime}
        WHERE id = ${jobId}
      `;
    } else {
      await sql`
        UPDATE media_jobs 
        SET status = COALESCE(${update.status || null}, status),
            metadata = COALESCE(${update.metadata ? JSON.stringify(update.metadata) : null}::jsonb, metadata)
        WHERE id = ${jobId}
      `;
    }

    logger.info('[MediaQueue] Job updated', {
      jobId,
      status: update.status,
    });
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const result = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        AVG(processing_time_ms) FILTER (WHERE status = 'completed') as avg_time
      FROM media_jobs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    const row = result.rows[0] as Record<string, string | null>;
    return {
      pending: parseInt(row.pending || '0') || 0,
      processing: parseInt(row.processing || '0') || 0,
      completed: parseInt(row.completed || '0') || 0,
      failed: parseInt(row.failed || '0') || 0,
      avgProcessingTimeMs: parseFloat(row.avg_time || '0') || 0,
    };
  }

  /**
   * Retry failed jobs
   */
  async retryFailed(): Promise<number> {
    const result = await sql`
      UPDATE media_jobs 
      SET status = 'pending', error = NULL
      WHERE status = 'failed' AND attempts < max_attempts
      RETURNING id
    `;

    const count = result.rows.length;
    if (count > 0) {
      logger.info('[MediaQueue] Retrying failed jobs', { count });
    }

    return count;
  }

  /**
   * Get next pending jobs for processing
   */
  async getNextJobs(limit = 5): Promise<MediaJob[]> {
    const result = await sql`
      UPDATE media_jobs
      SET status = 'processing', started_at = NOW(), attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM media_jobs
        WHERE status = 'pending' AND attempts < max_attempts
        ORDER BY created_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;

    return result.rows.map((row: Record<string, unknown>) => this.rowToJob(row));
  }

  // ============================================
  // Private Methods
  // ============================================

  private async sendToQStash(
    jobId: string,
    type: JobType,
    sourceImageUrl: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const response = await fetch(
      'https://qstash.upstash.io/v2/publish/' + encodeURIComponent(this.webhookUrl),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.qstashToken}`,
          'Content-Type': 'application/json',
          'Upstash-Retries': '3',
          'Upstash-Delay': '0s',
        },
        body: JSON.stringify({
          jobId,
          type,
          sourceImageUrl,
          metadata,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`QStash error: ${response.status}`);
    }

    const result = await response.json();
    logger.info('[MediaQueue] Job sent to QStash', {
      jobId,
      messageId: result.messageId,
    });
  }

  private rowToJob(row: Record<string, unknown>): MediaJob {
    return {
      id: row.id as string,
      type: row.type as JobType,
      status: row.status as JobStatus,
      user_id: parseInt(row.user_id as string),
      productId: row.product_id as string | undefined,

      sourceImageUrl: row.source_image_url as string,
      resultImageUrl: row.result_image_url as string | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      error: row.error as string | undefined,
      attempts: row.attempts as number,
      maxAttempts: row.max_attempts as number,
      createdAt: row.created_at as Date,
      startedAt: row.started_at as Date | undefined,
      completedAt: row.completed_at as Date | undefined,
      processingTimeMs: row.processing_time_ms as number | undefined,
    };
  }
}

// Singleton
export const mediaQueue = new MediaQueueService();

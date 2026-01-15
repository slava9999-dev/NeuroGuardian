// ============================================
// NeuroGUARDIAN — Media Processor Webhook
// Worker for processing Async Media Jobs (QStash)
// Version: 1.0.0 | Date: January 2026
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../lib/logger.js';
import { visionService, renderFactory, mediaQueue, storageService } from '../../vision/index.js';
import { sql } from '../services/database.js';
import { toProductId, toUserId } from '../../vision/types.js';

// QStash verification (optional for logic, required for prod security)
// import { Receiver } from "@upstash/qstash";

export default async function handleMediaWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // TODO: Verify QStash signature
  // const receiver = new Receiver({ currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY! });
  // const isValid = await receiver.verify({ signature: req.headers["upstash-signature"]!, body: JSON.stringify(req.body) });

  const { jobId, type, sourceImageUrl, metadata } = req.body;

  if (!jobId || !type) {
    logger.warn('[MediaWebhook] Invalid payload', req.body);
    return res.status(400).json({ error: 'Invalid job payload' });
  }

  logger.info(`[MediaWebhook] Processing job ${jobId} (${type})`);

  try {
    // 1. Mark as processing
    await mediaQueue.updateJob(jobId, { status: 'processing' });

    let resultUrl: string | undefined;

    // 2. Route to Worker
    switch (type) {
      case 'vision_analyze': {
        await processVisionAnalysis(sourceImageUrl, metadata?.assetId as string);
        break;
      }

      case 'render_white_bg': {
        const wbResult = await renderFactory.workflowWhiteBackground(sourceImageUrl, metadata);
        if (!wbResult.success) throw new Error(wbResult.error);
        resultUrl = wbResult.resultUrl;
        break;
      }

      case 'render_lifestyle': {
        const lifeResult = await renderFactory.workflowLifestyle(sourceImageUrl, metadata);
        if (!lifeResult.success) throw new Error(lifeResult.error);
        resultUrl = lifeResult.resultUrl;
        break;
      }

      case 'render_watermark': {
        // Need to fetch, process, and re-upload (simplified here)
        // For now, assume RenderFactory handles it or implemented here
        const wmResult = await renderFactory.addWatermark(sourceImageUrl, metadata);
        if (!wmResult.success) throw new Error(wmResult.error);
        resultUrl = wmResult.resultUrl;
        break;
      }

      case 'ingest_marketplace_image': {
        await processIngestion(sourceImageUrl, metadata);
        break;
      }

      default:
        throw new Error(`Unknown job type: ${type}`);
    }

    // 3. Complete
    await mediaQueue.updateJob(jobId, {
      status: 'completed',
      resultImageUrl: resultUrl,
    });

    return res.status(200).json({ success: true, jobId });
  } catch (error) {
    logger.error(`[MediaWebhook] Job ${jobId} failed`, {
      error: error instanceof Error ? error.message : String(error),
    });

    await mediaQueue.updateJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(200).json({ success: false, error: 'Job failed, logged' }); // Return 200 to acknowledge receipt? Or 500 to retry?
    // Returning 200 prevents infinite QStash retries for logic errors.
    // Use 500 only for transient errors.
  }
}

// ----------------------------------------------------------------------------
// Worker Logic
// ----------------------------------------------------------------------------

async function processVisionAnalysis(imageUrl: string, assetId?: string) {
  if (!assetId) {
    logger.warn('[MediaWebhook] No assetId provided for vision analysis');
    return; // Just run analysis without saving?
  }

  const result = await visionService.analyzeImage({
    imageUrl,
    checkType: 'full',
  });

  // Save result to DB
  await sql`
    UPDATE media_assets 
    SET vision_metadata = ${result}::jsonb,
        status = 'ready',
        analyzed_at = NOW()
    WHERE id = ${assetId}
  `;

  logger.info(`[MediaWebhook] Analysis saved for asset ${assetId}`);
}

async function processIngestion(imageUrl: string, metadata: any) {
  const { productId, userId } = metadata || {};
  if (!productId || !userId) {
    logger.warn('[MediaWebhook] Missing metadata for ingestion', metadata);
    return;
  }

  // Check existence
  const existing = await sql`
     SELECT id FROM media_assets 
     WHERE product_id = ${productId} AND type = 'original' 
     LIMIT 1
  `;

  if (existing.rows.length > 0) {
    logger.info(`[MediaWebhook] Asset already exists for ${productId}, skipping ingestion`);
    return;
  }

  // Upload
  const assetId = `asset_ingest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const storageUrl = await storageService.uploadFromUrl(imageUrl, 'originals');

  // Create Record
  await sql`
      INSERT INTO media_assets (
        id, product_id, user_id, type, status, original_url
      ) VALUES (
        ${assetId}, 
        ${toProductId(productId)}, 
        ${toUserId(userId)}, 
        'original', 
        'uploading', -- Will be ready after analysis? or just ready now?
        ${storageUrl}
      )
  `;

  // Trigger Analysis immediately
  await mediaQueue.enqueue('vision_analyze', storageUrl, {
    productId,
    metadata: { assetId },
  });

  // Mark ready
  await sql`UPDATE media_assets SET status = 'ready' WHERE id = ${assetId}`;
  logger.info(`[MediaWebhook] Ingested asset ${assetId} for product ${productId}`);
}

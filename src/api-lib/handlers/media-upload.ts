// ============================================
// NeuroGUARDIAN — Media Upload Handler
// Handles image upload/import and triggers analysis
// Version: 1.0.0 | Date: January 2026
// ============================================

import { logger } from '../lib/logger.js';
import { storageService, mediaQueue } from '../../vision/index.js';
import { sql } from '../services/database.js';
import { toProductId, toUserId } from '../../vision/types.js';
import { withAuth } from '../middleware/auth.js';
import { quotaService } from '../services/QuotaService.js';

export default withAuth(async function handleMediaUpload(req, res, { userId }) {
  const {
    productId, // Optional: Link to product
    imageUrl, // Source: URL
    imageBase64, // Source: Base64
    autoAnalyze, // Run VisionCore?
    autoProcess, // Run RenderFactory (WB)?
  } = req.body;

  if (!imageUrl && !imageBase64) {
    return res.status(400).json({ error: 'imageUrl or imageBase64 is required' });
  }

  try {
    const assetId = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info(`[MediaUpload] Starting upload for ${assetId}`);

    // 1. Upload Original to Storage
    let storageUrl: string;

    if (imageUrl) {
      storageUrl = await storageService.uploadFromUrl(imageUrl, 'originals');
    } else {
      const buffer = Buffer.from(imageBase64, 'base64');
      const filename = `${assetId}_original.jpg`; // Assume JPG for base64 simplicity
      storageUrl = await storageService.upload(buffer, filename, 'image/jpeg', 'originals');
    }

    // 2. Create DB Record
    await sql`
      INSERT INTO media_assets (
        id, product_id, user_id, type, status, original_url
      ) VALUES (
        ${assetId}, 
        ${productId ? toProductId(productId) : 'pending_link'}, 
        ${toUserId(userId)}, 
        'original', 
        'uploading',
        ${storageUrl}
      )
    `;

    // 3. Trigger Async Jobs
    let analysisJobId: string | undefined;
    let processingJobId: string | undefined;

    if (autoAnalyze !== false) {
      // 3.1 Check Quota for AI Vision
      const quota = await quotaService.checkQuota(userId, 'vision_analyze');

      if (!quota.allowed) {
        logger.warn(`[MediaUpload] Quota exceeded for user ${userId}`);
        await sql`UPDATE media_assets SET status = 'failed', vision_metadata = '{"error": "Quota exceeded"}' WHERE id = ${assetId}`;
      } else {
        // Default: Always analyze
        analysisJobId = await mediaQueue.enqueue('vision_analyze', storageUrl, {
          userId,
          productId,
          metadata: { assetId },
        });

        // Log usage
        await quotaService.logUsage(userId, 'vision_analyze', 1, { assetId, productId });

        // Update asset status
        await sql`UPDATE media_assets SET status = 'analyzing' WHERE id = ${assetId}`;
      }
    }

    if (autoProcess) {
      // Render WB
      processingJobId = await mediaQueue.enqueue('render_white_bg', storageUrl, {
        userId,
        productId,
        metadata: { assetId, source: 'upload' },
      });
    }

    logger.info(`[MediaUpload] Success ${assetId}`, { analysisJobId, processingJobId });

    const newAsset = {
      id: assetId,
      productId: productId || '',
      userId: userId.toString(),
      type: 'original',
      status: 'uploading',
      originalUrl: storageUrl,
      // Default/Empty values for new asset
      processedUrl: undefined,
      thumbnailUrl: undefined,
      visionMetadata: undefined,
      width: 0,
      height: 0,
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return res.status(202).json({
      success: true,
      asset: newAsset,
      jobs: {
        analysis: analysisJobId,
        processing: processingJobId,
      },
    });
  } catch (error) {
    logger.error('[MediaUpload] Failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Upload failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

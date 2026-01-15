// ============================================
// NeuroGUARDIAN — Media Upload Handler
// Handles image upload/import and triggers analysis
// Version: 1.0.0 | Date: January 2026
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../lib/logger.js';
import { storageService, mediaQueue } from '../../vision/index.js';
import { sql } from '../services/database.js';
import { toProductId, toUserId } from '../../vision/types.js';

export default async function handleMediaUpload(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    userId, // Required: Owner ID
    productId, // Optional: Link to product
    imageUrl, // Source: URL
    imageBase64, // Source: Base64
    autoAnalyze, // Run VisionCore?
    autoProcess, // Run RenderFactory (WB)?
  } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

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
      // Default: Always analyze
      analysisJobId = await mediaQueue.enqueue('vision_analyze', storageUrl, {
        productId,
        metadata: { assetId },
      });
      // Update asset status
      await sql`UPDATE media_assets SET status = 'analyzing' WHERE id = ${assetId}`;
    }

    if (autoProcess) {
      // Render WB
      processingJobId = await mediaQueue.enqueue('render_white_bg', storageUrl, {
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
}

// ============================================
// NeuroGUARDIAN — Vision Module Index
// Version: 1.0.0 | Date: January 2026
// ============================================

// Core Services
export { VisionService, visionService } from './VisionService.js';
export { RenderFactory, renderFactory } from './RenderFactory.js';
export { MediaQueueService, mediaQueue } from './MediaQueueService.js';
export { StorageService, storageService } from './StorageService.js';
export { WatermarkService, watermarkService } from './WatermarkService.js';

// Types
export type { VisionAnalysisResult, VisionCheckRequest, MaterialType } from './VisionService.js';

export type { RenderWorkflow, RenderJobConfig, RenderJob, RenderResult } from './RenderFactory.js';

export type { JobType, JobStatus, MediaJob, QueueStats } from './MediaQueueService.js';

export type {
  MediaAsset,
  MediaAssetStatus,
  MediaAssetType,
  ProductMediaCollection,
  MediaUploadRequest,
  MediaUploadResponse,
  MediaProcessRequest,
  MediaProcessResponse,
  // Strict ID types
  ProductId,
  NmId,
  OfferId,
  UserId,
  OrderId,
} from './types.js';

export {
  toProductId,
  toNmId,
  toOfferId,
  toUserId,
  toOrderId,
  MEDIA_ASSETS_MIGRATION,
} from './types.js';

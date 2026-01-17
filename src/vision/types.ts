// ============================================
// NeuroGUARDIAN — Media Assets Types
// Database types for image versioning
// Version: 1.0.0 | Date: January 2026
// ============================================

import type { VisionAnalysisResult } from './VisionService.js';

// ============================================
// Media Asset Types
// ============================================

export type MediaAssetStatus = 'uploading' | 'analyzing' | 'processing' | 'ready' | 'failed';
export type MediaAssetType = 'original' | 'white_bg' | 'lifestyle' | 'thumbnail' | 'watermarked';

/**
 * Media Asset — represents a single image version
 */
export interface MediaAsset {
  id: string; // UUID
  productId: string; // Reference to product
  userId: string; // Owner (string for BIGINT compatibility)

  // Asset type and status
  type: MediaAssetType;
  status: MediaAssetStatus;

  // URLs
  originalUrl: string; // Original upload (from цех)
  processedUrl?: string; // Processed version
  thumbnailUrl?: string; // 200x200 thumbnail

  // Metadata from Vision analysis
  visionMetadata?: VisionAnalysisResult;

  // Dimensions
  width?: number;
  height?: number;
  fileSizeBytes?: number;
  mimeType?: string;

  // Processing info
  sourceAssetId?: string; // Parent asset (for derivatives)
  processingJobId?: string; // Active job ID
  processingError?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  analyzedAt?: Date;
  processedAt?: Date;
}

/**
 * Product Media Collection — all images for a product
 */
export interface ProductMediaCollection {
  productId: string;
  original: MediaAsset | null; // RAW from workshop
  whiteBackground: MediaAsset | null; // For WB/Ozon main card
  lifestyle: MediaAsset[]; // Marketing shots (can be multiple)
  thumbnails: MediaAsset[]; // Various sizes
  watermarked: MediaAsset | null; // With security logo
}

// ============================================
// Database Schema (SQL Migration)
// ============================================

export const MEDIA_ASSETS_MIGRATION = `
-- Media Assets Table
CREATE TABLE IF NOT EXISTS media_assets (
  id VARCHAR(100) PRIMARY KEY,
  product_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(50) NOT NULL,  -- String for BIGINT Telegram IDs
  
  type VARCHAR(20) NOT NULL DEFAULT 'original',
  status VARCHAR(20) NOT NULL DEFAULT 'uploading',
  
  original_url TEXT NOT NULL,
  processed_url TEXT,
  thumbnail_url TEXT,
  
  vision_metadata JSONB,
  
  width INTEGER,
  height INTEGER,
  file_size_bytes BIGINT,
  mime_type VARCHAR(50),
  
  source_asset_id VARCHAR(100) REFERENCES media_assets(id) ON DELETE SET NULL,
  processing_job_id VARCHAR(100),
  processing_error TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  analyzed_at TIMESTAMP,
  processed_at TIMESTAMP,
  
  -- Foreign keys
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_product ON media_assets(product_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_user ON media_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_type ON media_assets(type);
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON media_assets(status);

-- GIN index for JSONB vision metadata queries
CREATE INDEX IF NOT EXISTS idx_media_assets_vision ON media_assets USING GIN (vision_metadata);
`;

// ============================================
// Strict ID Types
// ============================================

/**
 * Branded types for strict ID handling
 * All marketplace IDs should be strings at application level
 */
export type ProductId = string & { readonly brand: unique symbol };
export type NmId = string & { readonly brand: unique symbol }; // WB nmID as string
export type OfferId = string & { readonly brand: unique symbol }; // Ozon offer_id
export type UserId = string & { readonly brand: unique symbol }; // Telegram user_id as string
export type OrderId = string & { readonly brand: unique symbol }; // Order ID as string

// Helper functions to create branded IDs
export function toProductId(id: string | number): ProductId {
  return String(id) as ProductId;
}

export function toNmId(id: number): NmId {
  return String(id) as NmId;
}

export function toOfferId(id: string): OfferId {
  return id as OfferId;
}

export function toUserId(id: number | string): UserId {
  return String(id) as UserId;
}

export function toOrderId(id: string | number): OrderId {
  return String(id) as OrderId;
}

// ============================================
// Vision + Render Request Types
// ============================================

export interface MediaUploadRequest {
  productId?: string;
  file?: File;
  fileUrl?: string;
  fileBase64?: string;
  autoAnalyze?: boolean; // Run Vision analysis after upload
  autoProcess?: boolean; // Auto-generate white_bg version
}

export interface MediaUploadResponse {
  success: boolean;
  assetId: string;
  uploadUrl?: string; // For direct upload to storage
  status: MediaAssetStatus;
  analysisJobId?: string; // If autoAnalyze enabled
  processingJobId?: string; // If autoProcess enabled
}

export interface MediaProcessRequest {
  assetId: string;
  workflow: 'white_background' | 'lifestyle' | 'watermark';
  options?: {
    // For lifestyle
    scenePrompt?: string;
    lightingStyle?: 'warm' | 'cool' | 'natural';

    // For white_background
    shadowIntensity?: number;
    upscale?: boolean;

    // For watermark
    opacity?: number;
    position?: 'corner' | 'center' | 'tile';
  };
}

export interface MediaProcessResponse {
  success: boolean;
  jobId: string;
  estimatedTimeSeconds: number;
  pollingUrl: string;
}

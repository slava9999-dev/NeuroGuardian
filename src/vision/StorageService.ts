// ============================================
// NeuroGUARDIAN — Storage Service
// Handles file uploads to Cloud Storage (R2/S3)
// Version: 1.0.0 | Date: January 2026
// ============================================

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../api-lib/lib/logger.js';

export class StorageService {
  private s3Client: S3Client | null = null;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.bucket = process.env.STORAGE_BUCKET || 'neuroguardian-media';
    this.publicUrl = process.env.STORAGE_PUBLIC_URL || '';

    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
    const endpoint = process.env.STORAGE_ENDPOINT;
    const region = process.env.STORAGE_REGION || 'auto';

    if (accessKeyId && secretAccessKey && endpoint) {
      this.s3Client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        // For Cloudflare R2 and some S3 providers
        forcePathStyle: true,
      });
      if (process.env.NODE_ENV !== 'test') {
        logger.info(`[Storage] Initialized with real S3 client. Bucket: ${this.bucket}`);
      }
    } else {
      if (process.env.NODE_ENV !== 'test') {
        logger.warn('[Storage] Missing credentials, using mock mode');
      }
    }
  }

  /**
   * Upload file to storage
   */
  async upload(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folder = 'uploads'
  ): Promise<string> {
    const key = `${folder}/${fileName}`;

    if (!this.s3Client) {
      if (process.env.NODE_ENV !== 'test') {
        logger.info(`[Storage] Mock uploading ${key} (${fileBuffer.length} bytes, ${mimeType})`);
      }
      return `https://cdn.example.com/${key}`;
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      });

      await this.s3Client.send(command);

      const resultUrl = this.publicUrl
        ? `${this.publicUrl}/${key}`
        : `${process.env.STORAGE_ENDPOINT}/${this.bucket}/${key}`;

      logger.info(`[Storage] Uploaded ${key} to S3`, { url: resultUrl });
      return resultUrl;
    } catch (error) {
      logger.error('[Storage] Upload failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Upload from URL (download then upload)
   */
  async uploadFromUrl(url: string, folder = 'uploads'): Promise<string> {
    logger.info(`[Storage] Fetching from ${url}`);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      const ext = contentType.split('/')[1]?.split('+')[0] || 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

      return this.upload(buffer, fileName, contentType, folder);
    } catch (error) {
      logger.error('[Storage] Upload from URL failed', { url, error });
      throw error;
    }
  }
}

export const storageService = new StorageService();

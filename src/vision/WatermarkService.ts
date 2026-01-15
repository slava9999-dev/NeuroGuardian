// ============================================
// NeuroGUARDIAN — Watermark Service
// Applies Arbarea security watermark using Sharp
// Version: 1.0.0 | Date: January 2026
// ============================================

import sharp from 'sharp';
import { logger } from '../api-lib/lib/logger.js';

export class WatermarkService {
  private watermarkSvg: string;

  constructor() {
    // Standard Arbarea watermark SVG
    this.watermarkSvg = `
      <svg width="300" height="80">
        <text x="50%" y="50%" 
              font-family="Arial, sans-serif" 
              font-size="32" 
              font-weight="bold"
              fill="rgba(255,255,255,0.4)"
              text-anchor="middle" 
              dominant-baseline="middle">
          ARBAREA
        </text>
      </svg>
    `;
  }

  /**
   * Apply watermark to image buffer
   */
  async applyWatermark(
    imageBuffer: Buffer,
    options: {
      opacity?: number;
      position?: 'corner' | 'center' | 'tile';
    } = {}
  ): Promise<Buffer> {
    const opacity = options.opacity ?? 0.4;
    const position = options.position ?? 'corner';

    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error('Could not read image metadata');
      }

      // Generate watermark with specific opacity
      const svgbuffer = Buffer.from(this.watermarkSvg.replace('0.4', opacity.toString()));

      let compositeOptions: sharp.OverlayOptions;

      if (position === 'center') {
        compositeOptions = {
          input: svgbuffer,
          gravity: 'center',
        };
      } else if (position === 'tile') {
        compositeOptions = {
          input: svgbuffer,
          tile: true,
        };
      } else {
        // Default: Bottom-right corner
        compositeOptions = {
          input: svgbuffer,
          gravity: 'southeast',
          top: metadata.height - 100,
          left: metadata.width - 320,
        };
      }

      // Apply composite
      const outputBuffer = await image
        .composite([compositeOptions])
        .jpeg({ quality: 90 })
        .toBuffer();

      logger.info(`[Watermark] Applied (${position}, op:${opacity})`);
      return outputBuffer;
    } catch (error) {
      logger.error('[Watermark] Failed to apply', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const watermarkService = new WatermarkService();

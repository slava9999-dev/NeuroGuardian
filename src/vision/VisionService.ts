// ============================================
// NeuroGUARDIAN — Vision Core Service
// AI-powered image analysis with Gemini Vision
// Version: 1.0.0 | Date: January 2026
// ============================================

import { logger } from '../api-lib/lib/logger.js';

// ============================================
// Types
// ============================================

export type MaterialType = 'oak' | 'ash' | 'walnut' | 'beech' | 'resin' | 'epoxy' | 'unknown';

export interface VisionAnalysisResult {
  // Quality Scores (0-10)
  lighting_score: number;
  composition_score: number;
  sharpness_score: number;
  overall_quality: number;

  // Defect Detection
  blur_detected: boolean;
  overexposed: boolean;
  underexposed: boolean;
  noise_level: 'low' | 'medium' | 'high';

  // Material Analysis
  material_detected: MaterialType;
  material_confidence: number;
  texture_tags: string[]; // "живой край", "сучки", "эпоксидная река"

  // Marketplace Compliance
  wb_compliant: boolean;
  wb_issues: string[]; // ["Нужен белый фон", "Низкое разрешение"]
  ozon_compliant: boolean;
  ozon_issues: string[];

  // Product Details
  product_category: string | null;
  detected_colors: string[];
  dimensions_visible: boolean;

  // SEO Tags
  seo_tags_ru: string[];
  seo_tags_en: string[];

  // Processing Metadata
  analyzed_at: string;
  model_version: string;
  processing_time_ms: number;
}

export interface VisionCheckRequest {
  imageUrl?: string;
  imageBase64?: string;
  checkType: 'full' | 'quality_only' | 'compliance_only';
  targetMarketplace?: 'WB' | 'Ozon' | 'both';
}

// ============================================
// Gemini Vision Provider
// ============================================

const GEMINI_VISION_MODEL = 'gemini-flash-latest'; // Vendor alias for latest stable Flash model

const VISION_ANALYSIS_PROMPT = `Ты — экспертная система контроля качества для товаров из дерева и эпоксидной смолы.

Проанализируй изображение и верни ТОЛЬКО валидный JSON (без markdown, без комментариев):

{
  "lighting_score": <0-10, оценка освещения>,
  "composition_score": <0-10, композиция кадра>,
  "sharpness_score": <0-10, резкость>,
  "blur_detected": <true/false>,
  "overexposed": <true/false>,
  "underexposed": <true/false>,
  "noise_level": <"low"|"medium"|"high">,
  "material_detected": <"oak"|"ash"|"walnut"|"beech"|"resin"|"epoxy"|"unknown">,
  "material_confidence": <0-1>,
  "texture_tags": [<массив тегов на русском: "живой край", "сучки", "годовые кольца", "эпоксидная река">],
  "wb_compliant": <true/false - подходит для Wildberries?>,
  "wb_issues": [<проблемы для WB: "Нужен белый фон", "Низкое разрешение">],
  "ozon_compliant": <true/false>,
  "ozon_issues": [<проблемы для Ozon>],
  "product_category": <"столешница"|"стол"|"разделочная доска"|"часы"|"декор"|null>,
  "detected_colors": [<основные цвета>],
  "dimensions_visible": <true/false - видны ли размеры/масштаб>,
  "seo_tags_ru": [<SEO теги на русском, 5-10 штук>],
  "seo_tags_en": [<SEO теги на английском, 5-10 штук>]
}

ПРАВИЛА ОЦЕНКИ WB COMPLIANCE:
- Фон должен быть белым или светлым (не тёмный)
- Разрешение минимум 900x1200
- Товар должен занимать 60-80% кадра
- Не должно быть посторонних предметов
- Не должно быть водяных знаков

ПРАВИЛА ОЦЕНКИ OZON:
- Аналогично WB, но менее строгие требования к фону
- Допускаются lifestyle-фото`;

export class VisionService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('[VisionService] GEMINI_API_KEY not configured');
    }
  }

  /**
   * Analyze image using Gemini Vision
   */
  async analyzeImage(request: VisionCheckRequest): Promise<VisionAnalysisResult> {
    const startTime = Date.now();

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    try {
      // Prepare image data
      const imagePart = request.imageBase64
        ? {
            inlineData: {
              mimeType: 'image/jpeg',
              data: request.imageBase64,
            },
          }
        : {
            fileData: {
              mimeType: 'image/jpeg',
              fileUri: request.imageUrl!,
            },
          };

      // For URL-based images, we need to fetch and convert to base64
      let imageData = imagePart;
      if (request.imageUrl && !request.imageBase64) {
        logger.info(`[VisionService] Fetching image: ${request.imageUrl}`);
        const imageResponse = await fetch(request.imageUrl);

        if (!imageResponse.ok) {
          throw new Error(
            `Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`
          );
        }

        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64 = Buffer.from(imageBuffer).toString('base64');

        logger.info(
          `[VisionService] Image fetched. Type: ${contentType}, Size: ${imageBuffer.byteLength} bytes`
        );

        imageData = {
          inlineData: {
            mimeType: contentType,
            data: base64,
          },
        };
      }

      logger.info(`[VisionService] Sending request to model: ${GEMINI_VISION_MODEL}`);

      // Call Gemini Vision API
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: VISION_ANALYSIS_PROMPT }, imageData],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2048,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini Vision API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse Vision response as JSON');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      const processingTime = Date.now() - startTime;

      // Calculate overall quality
      const overallQuality = Math.round(
        (analysis.lighting_score + analysis.composition_score + analysis.sharpness_score) / 3
      );

      const result: VisionAnalysisResult = {
        lighting_score: analysis.lighting_score || 0,
        composition_score: analysis.composition_score || 0,
        sharpness_score: analysis.sharpness_score || 0,
        overall_quality: overallQuality,
        blur_detected: analysis.blur_detected || false,
        overexposed: analysis.overexposed || false,
        underexposed: analysis.underexposed || false,
        noise_level: analysis.noise_level || 'low',
        material_detected: analysis.material_detected || 'unknown',
        material_confidence: analysis.material_confidence || 0,
        texture_tags: analysis.texture_tags || [],
        wb_compliant: analysis.wb_compliant || false,
        wb_issues: analysis.wb_issues || [],
        ozon_compliant: analysis.ozon_compliant || false,
        ozon_issues: analysis.ozon_issues || [],
        product_category: analysis.product_category || null,
        detected_colors: analysis.detected_colors || [],
        dimensions_visible: analysis.dimensions_visible || false,
        seo_tags_ru: analysis.seo_tags_ru || [],
        seo_tags_en: analysis.seo_tags_en || [],
        analyzed_at: new Date().toISOString(),
        model_version: GEMINI_VISION_MODEL,
        processing_time_ms: processingTime,
      };

      logger.info('[VisionService] Analysis completed', {
        quality: overallQuality,
        material: result.material_detected,
        wb_compliant: result.wb_compliant,
        processingTimeMs: processingTime,
      });

      return result;
    } catch (error) {
      logger.error('[VisionService] Analysis failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Quick quality check (faster, less detailed)
   */
  async quickQualityCheck(imageUrl: string): Promise<{
    pass: boolean;
    score: number;
    issues: string[];
  }> {
    const result = await this.analyzeImage({
      imageUrl,
      checkType: 'quality_only',
    });

    const issues: string[] = [];
    if (result.blur_detected) issues.push('Обнаружена размытость');
    if (result.overexposed) issues.push('Пересвечено');
    if (result.underexposed) issues.push('Недосвечено');
    if (result.lighting_score < 6) issues.push('Плохое освещение');
    if (result.sharpness_score < 6) issues.push('Низкая резкость');

    return {
      pass: result.overall_quality >= 7 && issues.length === 0,
      score: result.overall_quality,
      issues,
    };
  }

  /**
   * Check marketplace compliance
   */
  async checkCompliance(
    imageUrl: string,
    marketplace: 'WB' | 'Ozon' | 'both' = 'both'
  ): Promise<{
    wb: { compliant: boolean; issues: string[] } | null;
    ozon: { compliant: boolean; issues: string[] } | null;
  }> {
    const result = await this.analyzeImage({
      imageUrl,
      checkType: 'compliance_only',
      targetMarketplace: marketplace,
    });

    return {
      wb:
        marketplace === 'both' || marketplace === 'WB'
          ? { compliant: result.wb_compliant, issues: result.wb_issues }
          : null,
      ozon:
        marketplace === 'both' || marketplace === 'Ozon'
          ? { compliant: result.ozon_compliant, issues: result.ozon_issues }
          : null,
    };
  }

  /**
   * Generate SEO description from image
   */
  async generateSEODescription(imageUrl: string): Promise<{
    title_ru: string;
    description_ru: string;
    tags: string[];
  }> {
    const result = await this.analyzeImage({
      imageUrl,
      checkType: 'full',
    });

    // Build SEO-optimized title
    const material =
      result.material_detected !== 'unknown'
        ? this.translateMaterial(result.material_detected)
        : '';
    const category = result.product_category || 'изделие';
    const texture = result.texture_tags[0] || '';

    const title = [material, category, texture].filter(Boolean).join(' ').trim();

    // Build description
    const description = `${title} из натурального дерева. ${
      result.texture_tags.length > 0 ? `Особенности: ${result.texture_tags.join(', ')}.` : ''
    } Ручная работа.`;

    return {
      title_ru: title || 'Изделие из дерева',
      description_ru: description,
      tags: [...result.seo_tags_ru, ...result.texture_tags],
    };
  }

  private translateMaterial(material: MaterialType): string {
    const translations: Record<MaterialType, string> = {
      oak: 'Дуб',
      ash: 'Ясень',
      walnut: 'Орех',
      beech: 'Бук',
      resin: 'Смола',
      epoxy: 'Эпоксидная смола',
      unknown: '',
    };
    return translations[material];
  }
}

// Singleton
export const visionService = new VisionService();

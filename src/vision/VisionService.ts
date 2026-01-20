// ============================================
// NeuroGUARDIAN — Vision Core Service
// AI-powered image analysis with Gemini Vision and Qwen 2 Vision
// Version: 1.1.0 | Date: January 2026
// ============================================

import { logger } from '../api-lib/lib/logger.js';
import { HuggingFaceProvider } from '../infrastructure/llm/HuggingFaceProvider.js';

// ============================================
// Types
// ============================================

export type ProductStatus = 'active' | 'out_of_stock' | 'discontinued';

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
  material_detected: string;
  material_confidence: number;
  texture_tags: string[];

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
  mode?: 'fast' | 'deep_scan'; // Added mode
}

// ============================================
// Vision Providers
// ============================================

const GEMINI_VISION_MODEL_PRO = 'gemini-1.5-pro';
const GEMINI_VISION_MODEL_FAST = 'gemini-1.5-flash';
const HF_VISION_MODEL = 'Qwen/Qwen2-VL-72B-Instruct';

// ============================================
// 🌍 UNIVERSAL MARKETPLACE QUALITY PROMPT
// Works for ANY product: clothing, electronics, toys, etc.
// ============================================
const VISION_ANALYSIS_PROMPT = `Ты — строгий контролёр качества фотографий для маркетплейсов (Wildberries, Ozon).

ЗАДАЧА: Проанализируй изображение товара и верни ТОЛЬКО валидный JSON:

{
  "lighting_score": <0-10, освещение>,
  "composition_score": <0-10, композиция>,
  "sharpness_score": <0-10, резкость>,
  "blur_detected": <true/false>,
  "overexposed": <true/false>,
  "underexposed": <true/false>,
  "noise_level": <"low"|"medium"|"high">,
  "product_category": <определённая категория: "одежда"|"обувь"|"электроника"|"игрушки"|"мебель"|"декор"|"косметика"|"продукты"|"другое">,
  "material_detected": <определённый материал или "unknown">,
  "material_confidence": <0-1>,
  "quality_issues": [<список проблем на русском>],
  "selling_points": [<5 продающих преимуществ для описания товара>],
  "wb_compliant": <true/false>,
  "wb_issues": [<проблемы для WB>],
  "ozon_compliant": <true/false>,
  "ozon_issues": [<проблемы для Ozon>],
  "detected_colors": [<основные цвета>],
  "dimensions_visible": <true/false>,
  "seo_tags_ru": [<5-10 SEO тегов на русском>],
  "seo_tags_en": [<5-10 SEO тегов на английском>],
  "quality_verdict": <"excellent"|"good"|"needs_work"|"reject">,
  "improvement_tips": [<конкретные советы по улучшению фото>]
}

ПРАВИЛА ОЦЕНКИ WB COMPLIANCE:
- Фон белый или светлый (не тёмный, не пёстрый)
- Разрешение минимум 900x1200
- Товар занимает 60-80% кадра
- Нет посторонних предметов
- Нет водяных знаков, логотипов, надписей
- Товар в фокусе, без размытия

ПРАВИЛА ОЦЕНКИ OZON:
- Аналогично WB, но допускается серый фон (#f2f2f2)
- Lifestyle-фото допускаются
- Товар целиком в кадре

ВАЖНО: Если фото плохого качества, напиши в quality_verdict "needs_work" или "reject" и укажи конкретные improvement_tips.
Если фото хорошее — сгенерируй 5 продающих selling_points для описания товара.`;

export class VisionService {
  private apiKey: string;
  private hfProvider: HuggingFaceProvider;
  private provider: 'gemini' | 'huggingface';

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (!this.apiKey && process.env.VISION_PROVIDER === 'gemini') {
      logger.warn('[VisionService] GEMINI_API_KEY not configured');
    }

    this.provider = (process.env.VISION_PROVIDER as 'gemini' | 'huggingface') || 'gemini';

    this.hfProvider = new HuggingFaceProvider({
      model: HF_VISION_MODEL,
      maxTokens: 2048,
      temperature: 0.1,
    });
  }

  /**
   * Analyze image using Gemini Vision or Qwen 2.5 VL (HF)
   */
  async analyzeImage(request: VisionCheckRequest): Promise<VisionAnalysisResult> {
    const startTime = Date.now();
    const useDeepScan = request.mode === 'deep_scan';

    try {
      const crypto = await import('crypto');
      const createHash = crypto.createHash;
      const { sql } = await import('../api-lib/services/database.js');

      // 1. Check CACHE
      let imageHash = '';
      if (request.imageUrl) {
        imageHash = createHash('md5').update(request.imageUrl).digest('hex');
      } else if (request.imageBase64) {
        imageHash = createHash('md5').update(request.imageBase64).digest('hex');
      }

      // Determine model version for cache key
      const modelVersion =
        this.provider === 'huggingface'
          ? HF_VISION_MODEL
          : useDeepScan
            ? GEMINI_VISION_MODEL_PRO
            : GEMINI_VISION_MODEL_FAST;

      // Try to find in cache
      if (imageHash) {
        try {
          const cached =
            await sql`SELECT * FROM vision_cache WHERE image_hash = ${imageHash} AND model_version = ${modelVersion} LIMIT 1`;

          if (cached.rows.length > 0) {
            const cachedResult = cached.rows[0].analysis_result as VisionAnalysisResult;
            logger.info('[VisionService] Cache HIT', { imageHash, provider: this.provider });

            // Update last accessed
            await sql`UPDATE vision_cache SET last_accessed_at = NOW() WHERE id = ${cached.rows[0].id}`;

            return {
              ...cachedResult,
              processing_time_ms: 0,
              analyzed_at: new Date().toISOString(),
            };
          }
        } catch {
          /* ignore */
        }
      }

      let content = '';

      // 2. Perform Analysis
      if (this.provider === 'huggingface') {
        // HUGGING FACE LOGIC
        logger.info(`[VisionService] Using HuggingFace (${HF_VISION_MODEL})`);

        let imageUrl = request.imageUrl;
        // If we only have base64, create a data URI
        if (!imageUrl && request.imageBase64) {
          imageUrl = `data:image/jpeg;base64,${request.imageBase64}`;
        }

        if (!imageUrl) {
          throw new Error('Image URL or Base64 required for HF Vision');
        }

        const response = await this.hfProvider.complete([
          {
            role: 'user',
            content: [
              { type: 'text', text: VISION_ANALYSIS_PROMPT },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ]);
        content = response.content;
      } else {
        // GEMINI LOGIC
        if (!this.apiKey) throw new Error('GEMINI_API_KEY Configured');
        const model = modelVersion;

        logger.info(`[VisionService] Using Gemini (${model})`);

        // Prepare image data for Gemini
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

        // For URL-based images on Gemini, sometimes fetching ourselves constitutes a better path if fileUri is not supported by API Key directly (Vertex AI vs AI Studio)
        // But the original code handled it:
        // "For URL-based images, we need to fetch and convert to base64"
        let imageData = imagePart;

        if (request.imageUrl && !request.imageBase64) {
          logger.info(`[VisionService] Fetching image: ${request.imageUrl}`);
          const imageResponse = await fetch(request.imageUrl);
          if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status}`);
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64 = Buffer.from(imageBuffer).toString('base64');
          imageData = {
            inlineData: {
              mimeType: contentType,
              data: base64,
            },
          };
        }

        const { fetchWithRetry } = await import('../api-lib/lib/index.js');
        const responseBody = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
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

        const data = responseBody as {
          candidates?: { content?: { parts?: { text: string }[] } }[];
        };
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      // 3. Parse Response (Common)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse Vision response as JSON: ' + content.slice(0, 100));
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
        model_version: modelVersion,
        processing_time_ms: processingTime,
      };

      // 4. Save to CACHE
      if (imageHash) {
        try {
          // Note: using modelVersion keeps cache separated between Gemini/HF
          await sql`
            INSERT INTO vision_cache (image_hash, image_url, analysis_result, model_version)
            VALUES (${imageHash}, ${request.imageUrl || 'base64'}, ${JSON.stringify(
              result
            )}, ${modelVersion})
            ON CONFLICT DO NOTHING
            `;
          logger.info('[VisionService] Saved to cache');
        } catch (cacheErr) {
          logger.warn('[VisionService] Failed to save cache', { error: cacheErr });
        }
      }

      logger.info('[VisionService] Analysis completed', {
        quality: overallQuality,
        provider: this.provider,
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

    const category = result.product_category || 'товар';
    const material = result.material_detected !== 'unknown' ? result.material_detected : '';

    // Build SEO-optimized title
    const title = [category, material].filter(Boolean).join(' ').trim();

    // Build description accurately from vision selling points
    const description = `Качественный ${title}. ${
      result.texture_tags.length > 0 ? `Особенности: ${result.texture_tags.join(', ')}.` : ''
    }`;

    return {
      title_ru: title,
      description_ru: description,
      tags: [...result.seo_tags_ru, ...result.texture_tags],
    };
  }
}

// Singleton
export const visionService = new VisionService();

// ============================================
// NeuroGUARDIAN — Content Specialist (SMM Agent)
// AI-powered content generation for marketplaces
// Version: 1.0.0 | Date: January 2026
// ============================================

import { BaseSpecialist, type SpecialistContext } from './BaseSpecialist.js';
import { visionService } from '../../vision/VisionService.js';
import { renderFactory } from '../../vision/RenderFactory.js';
import { geminiFlash } from '../../infrastructure/llm/GeminiProvider.js';
import { sql } from '../../api-lib/services/database.js';
import { logger } from '../../api-lib/lib/logger.js';

// ============================================
// Types
// ============================================

export type ContentPlatform = 'instagram' | 'telegram' | 'wb_desc' | 'ozon_desc';

export interface ContentGenerationRequest {
  productId: string;
  platform: ContentPlatform;
  style?: 'professional' | 'friendly' | 'luxury' | 'casual';
  includeImage?: boolean;
}

export interface ContentGenerationResult {
  success: boolean;
  imageUrl?: string;
  postText: string;
  hashtags: string;
  platform: ContentPlatform;
  quotaRemaining: number;
  error?: string;
}

// ============================================
// Quota Guard
// ============================================

const QUOTA_LIMITS = {
  free: 0,
  basic: 20,
  pro: 100,
  business: 500,
} as const;

async function checkAndDecrementQuota(
  userId: number
): Promise<{ allowed: boolean; remaining: number; tier: string }> {
  try {
    // Get current quota
    const result = await sql`
      SELECT 
        subscription_plan,
        COALESCE(generated_content_count, 0) as used_count
      FROM users
      WHERE id = ${userId}
    `;

    if (result.rows.length === 0) {
      return { allowed: false, remaining: 0, tier: 'free' };
    }

    const { subscription_plan, used_count } = result.rows[0];
    const tier = subscription_plan || 'free';
    const limit = QUOTA_LIMITS[tier as keyof typeof QUOTA_LIMITS] || 0;
    const remaining = Math.max(0, limit - Number(used_count));

    if (remaining <= 0) {
      return { allowed: false, remaining: 0, tier };
    }

    // Increment counter
    await sql`
      UPDATE users 
      SET generated_content_count = COALESCE(generated_content_count, 0) + 1
      WHERE id = ${userId}
    `;

    return { allowed: true, remaining: remaining - 1, tier };
  } catch (error) {
    logger.error('[ContentSpecialist] Quota check failed', { error, userId });
    return { allowed: false, remaining: 0, tier: 'error' };
  }
}

// ============================================
// Content Specialist Class
// ============================================

export class ContentSpecialist extends BaseSpecialist {
  readonly name = 'ContentSpecialist';
  readonly description = 'Генерация контента для соцсетей и описаний товаров';
  readonly tools: string[] = []; // Не использует standard tools, custom pipeline

  readonly systemPrompt = `# 📸 КОНТЕНТ-СПЕЦИАЛИСТ

Ты — SMM-эксперт для маркетплейсов. Генерируешь продающий контент.

## ПЛАТФОРМЫ:
- instagram: Короткий, вовлекающий пост с эмодзи
- telegram: Информативный пост с призывом к действию
- wb_desc: SEO-оптимизированное описание для Wildberries
- ozon_desc: Описание для Ozon с ключевыми характеристиками

## СТИЛЬ:
- Professional: Деловой тон, факты
- Friendly: Дружелюбный, живой
- Luxury: Премиальный, статусный
- Casual: Простой, разговорный`;

  async buildContext(context: SpecialistContext): Promise<string> {
    return `Пользователь: ${context.userId}, Маркетплейс: ${context.userState.marketplace || 'N/A'}`;
  }

  /**
   * Generate content for a product
   */
  async generateContent(
    userId: number,
    request: ContentGenerationRequest
  ): Promise<ContentGenerationResult> {
    const startTime = Date.now();

    try {
      // 1. Check Quota
      const quota = await checkAndDecrementQuota(userId);
      if (!quota.allowed) {
        return {
          success: false,
          postText: '',
          hashtags: '',
          platform: request.platform,
          quotaRemaining: 0,
          error: `Лимит генераций исчерпан (${quota.tier}). Обновите тариф до PRO для увеличения лимита.`,
        };
      }

      // 2. Get product data from DB
      const productResult = await sql`
        SELECT product_id, nm_id, title, image_url, current_price, marketplace, cost_price
        FROM products
        WHERE user_id = ${userId} AND product_id = ${request.productId}
        LIMIT 1
      `;

      if (productResult.rows.length === 0) {
        return {
          success: false,
          postText: '',
          hashtags: '',
          platform: request.platform,
          quotaRemaining: quota.remaining,
          error: 'Товар не найден',
        };
      }

      const product = productResult.rows[0];

      // 3. Analyze image with Vision (if available)
      let visionData = '';
      if (product.image_url) {
        try {
          // VisionService expects VisionCheckRequest and returns VisionAnalysisResult directly
          const visionResult = await visionService.analyzeImage({
            imageUrl: product.image_url as string,
            checkType: 'full',
            targetMarketplace: product.marketplace === 'WB' ? 'WB' : 'Ozon',
            mode: 'fast', // Use fast mode for cost savings
          });

          // visionResult is VisionAnalysisResult directly (not wrapped)
          if (visionResult && visionResult.detected_colors) {
            visionData = JSON.stringify({
              colors: visionResult.detected_colors,
              category: visionResult.product_category,
              seo_tags: visionResult.seo_tags_ru,
              quality_score: visionResult.overall_quality,
            });
          }
        } catch (visionError) {
          logger.warn('[ContentSpecialist] Vision analysis failed', { error: visionError });
        }
      }

      // 4. Generate Text Content using Gemini Flash (cheap & fast)
      const prompt = this.buildContentPrompt(product, request.platform, request.style, visionData);

      const textResponse = await geminiFlash.complete(
        [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.7 }
      );

      // 5. Parse response
      const { postText, hashtags } = this.parseContentResponse(
        textResponse.content,
        request.platform
      );

      // 6. Generate Image (optional, uses quota)
      let imageUrl: string | undefined;
      if (request.includeImage && product.image_url) {
        try {
          const renderResult = await renderFactory.workflowWhiteBackground(product.image_url, {
            shadowIntensity: 0.3,
            upscale: false, // Save costs with schnell
          });

          if (renderResult.success && renderResult.resultUrl) {
            imageUrl = renderResult.resultUrl;
          }
        } catch (renderError) {
          logger.warn('[ContentSpecialist] Image generation failed', { error: renderError });
        }
      }

      // 7. Cache result
      await this.cacheContent(userId, request.productId, request.platform, postText, hashtags);

      const latencyMs = Date.now() - startTime;
      logger.info('[ContentSpecialist] Content generated', {
        userId,
        productId: request.productId,
        platform: request.platform,
        latencyMs,
        hasImage: !!imageUrl,
      });

      return {
        success: true,
        imageUrl,
        postText,
        hashtags,
        platform: request.platform,
        quotaRemaining: quota.remaining,
      };
    } catch (error) {
      logger.error('[ContentSpecialist] Generation failed', { error, userId, request });
      return {
        success: false,
        postText: '',
        hashtags: '',
        platform: request.platform,
        quotaRemaining: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build content generation prompt
   */
  private buildContentPrompt(
    product: Record<string, unknown>,
    platform: ContentPlatform,
    style: string = 'professional',
    visionData: string
  ): string {
    const platformInstructions: Record<ContentPlatform, string> = {
      instagram:
        'Напиши короткий вовлекающий пост для Instagram (до 150 слов). Используй эмодзи. Добавь призыв к действию.',
      telegram:
        'Напиши информативный пост для Telegram-канала (до 200 слов). Добавь ссылку-плейсхолдер [ССЫЛКА].',
      wb_desc:
        'Напиши SEO-оптимизированное описание для Wildberries (до 300 слов). Включи ключевые характеристики и преимущества.',
      ozon_desc:
        'Напиши описание товара для Ozon (до 300 слов). Структурируй по разделам: Описание, Характеристики, Преимущества.',
    };

    const styleInstructions: Record<string, string> = {
      professional: 'Тон: Деловой, экспертный, с фактами.',
      friendly: 'Тон: Дружелюбный, живой, с юмором.',
      luxury: 'Тон: Премиальный, элегантный, статусный.',
      casual: 'Тон: Простой, разговорный, как с другом.',
    };

    return `${platformInstructions[platform]}

${styleInstructions[style] || styleInstructions.professional}

ТОВАР:
- Название: ${product.title}
- Цена: ${product.current_price}₽
- Маркетплейс: ${product.marketplace}

${visionData ? `ДАННЫЕ VISION AI:\n${visionData}` : ''}

ФОРМАТ ОТВЕТА:
---POST---
[Текст поста здесь]
---HASHTAGS---
[Хештеги через пробел]
---END---`;
  }

  /**
   * Parse LLM response into text and hashtags
   */
  private parseContentResponse(
    response: string,
    platform: ContentPlatform
  ): { postText: string; hashtags: string } {
    try {
      const postMatch = response.match(/---POST---\s*([\s\S]*?)\s*---HASHTAGS---/);
      const hashtagsMatch = response.match(/---HASHTAGS---\s*([\s\S]*?)\s*---END---/);

      if (postMatch && hashtagsMatch) {
        return {
          postText: postMatch[1].trim(),
          hashtags: hashtagsMatch[1].trim(),
        };
      }
    } catch (e) {
      logger.warn('[ContentSpecialist] Failed to parse response', { error: e });
    }

    // Fallback: use entire response
    const defaultHashtags: Record<ContentPlatform, string> = {
      instagram: '#wildberries #ozon #товары #распродажа',
      telegram: '#маркетплейс #товары #скидки',
      wb_desc: '',
      ozon_desc: '',
    };

    return {
      postText: response.replace(/---\w+---/g, '').trim(),
      hashtags: defaultHashtags[platform],
    };
  }

  /**
   * Cache generated content for reuse
   */
  private async cacheContent(
    userId: number,
    productId: string,
    platform: ContentPlatform,
    postText: string,
    hashtags: string
  ): Promise<void> {
    try {
      await sql`
        INSERT INTO content_cache (user_id, product_id, platform, post_text, hashtags, created_at)
        VALUES (${userId}, ${productId}, ${platform}, ${postText}, ${hashtags}, NOW())
        ON CONFLICT (user_id, product_id, platform) 
        DO UPDATE SET post_text = EXCLUDED.post_text, hashtags = EXCLUDED.hashtags, created_at = NOW()
      `;
    } catch (error) {
      logger.warn('[ContentSpecialist] Cache insert failed (table may not exist)', { error });
    }
  }

  /**
   * Get cached content if available
   */
  async getCachedContent(
    userId: number,
    productId: string,
    platform: ContentPlatform
  ): Promise<{ postText: string; hashtags: string } | null> {
    try {
      const result = await sql`
        SELECT post_text, hashtags
        FROM content_cache
        WHERE user_id = ${userId} 
          AND product_id = ${productId} 
          AND platform = ${platform}
          AND created_at > NOW() - INTERVAL '7 days'
        LIMIT 1
      `;

      if (result.rows.length > 0) {
        return {
          postText: result.rows[0].post_text,
          hashtags: result.rows[0].hashtags,
        };
      }
    } catch (error) {
      logger.debug('[ContentSpecialist] Cache lookup failed', { error });
    }

    return null;
  }
}

// Export singleton
export const contentSpecialist = new ContentSpecialist();

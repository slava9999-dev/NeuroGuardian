// ============================================
// NeuroGUARDIAN — Content Specialist (SMM Agent)
// AI-powered content generation for marketplaces
// Version: 1.1.0 | Date: January 2026
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
    const result = await sql.unsafe(
      `
      SELECT 
        subscription_plan,
        COALESCE(generated_content_count, 0) as used_count
      FROM users
      WHERE id = $1
    `,
      [userId]
    );

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

    await sql.unsafe(
      `
      UPDATE users 
      SET generated_content_count = COALESCE(generated_content_count, 0) + 1
      WHERE id = $1
    `,
      [userId]
    );

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
  readonly tools: string[] = [];

  readonly systemPrompt = `# 📸 КОНТЕНТ-СПЕЦИАЛИСТ (GEN-V5)

Ты — SMM-эксперт и SEO-оптимизатор высшего уровня для маркетплейсов. Ты создаешь контент, который не просто описывает товар, а ПРОДАЕТ его и ведет в ТОП поиска.

## 🚀 СТРАТЕГИЯ SEO 2026:
- **WB (Wildberries)**: Заголовок до 60 символов. Описание до 5000 символов. 
- **Ozon**: Акцент на преимуществах и структуре. Используй формат Rich-контента.
- **Инстаграм/ТГ**: Используй опыт успешных кейсов — не грузи теорией, пиши про ВЫГОДУ для покупателя.

## 🎨 СТИЛЬ (TONE OF VOICE):
- Professional, Friendly, Luxury, Casual. Избегай клише "лучшее качество" и "доступная цена".

## ⚠️ ВАЖНО:
- Если Vision AI нашел дефекты — делай акцент на качестве товара.
- НИКОГДА не упоминай, что ты ИИ.`;

  async buildContext(context: SpecialistContext): Promise<string> {
    return `User: ${context.userId}, Marketplace: ${context.userState.marketplace || 'any'}`;
  }

  async generateContent(
    userId: number,
    request: ContentGenerationRequest
  ): Promise<ContentGenerationResult> {
    // const startTime = Date.now();

    try {
      const quota = await checkAndDecrementQuota(userId);
      if (!quota.allowed) {
        return {
          success: false,
          postText: '',
          hashtags: '',
          platform: request.platform,
          quotaRemaining: 0,
          error: 'Лимит генераций исчерпан.',
        };
      }

      const productResult = await sql.unsafe(
        `
        SELECT product_id, nm_id, title, image_url, current_price, marketplace
        FROM products
        WHERE user_id = $1 AND product_id = $2
        LIMIT 1
      `,
        [userId, request.productId]
      );

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

      // Vision analysis
      let visionData = '';
      if (product.image_url) {
        try {
          const visionResult = await visionService.analyzeImage({
            imageUrl: product.image_url as string,
            checkType: 'full',
            mode: 'fast',
          });
          visionData = JSON.stringify(visionResult);
        } catch (visionError) {
          logger.warn('[ContentSpecialist] Vision failed', { visionError });
        }
      }

      const prompt = this.buildContentPrompt(product, request as any, visionData);

      const textResponse = await geminiFlash.complete(
        [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.7 }
      );

      const { postText, hashtags } = this.parseContentResponse(
        textResponse.content,
        request.platform
      );

      let imageUrl: string | undefined;
      if (request.includeImage && product.image_url) {
        try {
          const renderResult = await renderFactory.workflowWhiteBackground(product.image_url);
          imageUrl = renderResult.resultUrl;
        } catch (e) {
          logger.warn('[ContentSpecialist] Render failed', { e });
        }
      }

      return {
        success: true,
        imageUrl,
        postText,
        hashtags,
        platform: request.platform,
        quotaRemaining: quota.remaining,
      };
    } catch (error) {
      return {
        success: false,
        postText: '',
        hashtags: '',
        platform: request.platform,
        quotaRemaining: 0,
        error: String(error),
      };
    }
  }

  private buildContentPrompt(product: any, request: any, visionData: string): string {
    return `Generate ${request.platform} post for ${product.title} in ${request.style || 'professional'} style.
    Price: ${product.current_price} RUB. Marketplace: ${product.marketplace}.
    Vision AI Data: ${visionData}
    Format: ---POST--- [Text] ---HASHTAGS--- [Hashtags] ---END---`;
  }

  private parseContentResponse(
    response: string,
    _platform: ContentPlatform
  ): { postText: string; hashtags: string } {
    const postMatch = response.match(/---POST---\s*([\s\S]*?)\s*---HASHTAGS---/);
    const hashtagsMatch = response.match(/---HASHTAGS---\s*([\s\S]*?)\s*---END---/);
    return {
      postText: postMatch ? postMatch[1].trim() : response,
      hashtags: hashtagsMatch ? hashtagsMatch[1].trim() : '#wb #ozon',
    };
  }
}

export const contentSpecialist = new ContentSpecialist();

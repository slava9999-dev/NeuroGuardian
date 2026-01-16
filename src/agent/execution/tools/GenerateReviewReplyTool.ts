// ============================================
// NeuroGUARDIAN — Generate Review Reply Tool
// AI-powered automated replies for marketplace reviews
// Version: 1.0.0 | Date: January 2026
// ============================================

import { defineTool } from '../ToolRegistry.js';
import {
  GenerateReviewReplyArgsSchema,
  type GenerateReviewReplyArgs,
} from '../../../api-lib/agent/validators.js';
import { geminiFlash } from '../../../infrastructure/llm/GeminiProvider.js';
import { sql } from '../../../api-lib/services/database.js';
import { logger } from '../../../api-lib/lib/logger.js';

export const generateReviewReplyTool = defineTool({
  name: 'generate_review_reply',
  description: 'Сгенерировать вежливый и продающий ответ на отзыв покупателя.',
  category: 'write',
  requiresConfirmation: true, // Safety first for public replies
  schema: GenerateReviewReplyArgsSchema,
  examples: [
    'Ответь на отзыв 12345 в WB',
    'Придумай ответ на негативный отзыв',
    'Поблагодари покупателя за 5 звезд',
  ],
  execute: async (userId, args: GenerateReviewReplyArgs) => {
    try {
      // 1. Fetch review details from DB (if review_id provided)
      const reviewResult = await sql.unsafe(
        `
        SELECT text, rating, product_title, marketplace
        FROM reviews
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      `,
        [args.review_id, userId]
      );

      const review = reviewResult.rows[0] || {
        text: args.text || 'Отзыв без текста',
        rating: 5,
        product_title: 'ваш товар',
        marketplace: args.marketplace,
      };

      // 2. Build prompt for Gemini
      const prompt = `Ты — менеджер по работе с клиентами на ${review.marketplace}.
      Напиши ответ на отзыв покупателя.
      
      ДАННЫЕ ОТЗЫВА:
      - Товар: ${review.product_title}
      - Оценка: ${review.rating}/5
      - Текст отзыва: "${review.text}"
      
      ТРЕБОВАНИЯ К ОТВЕТУ:
      - Тон: ${args.tone || 'polite'} (polite/friendly/official)
      - Поблагодари за выбор
      - Если оценка < 4, вырази сожаление и предложи решение (напр. проверить товар при получении)
      - На WB упомяни, что в магазине есть и другие крутые товары
      - Не используй шаблонные фразы "спасибо за ваш отзыв" в чистом виде
      - Ответ должен быть человечным, а не сухим ботом.`;

      // 3. Generate content
      const response = await geminiFlash.complete([
        { role: 'system', content: 'Ты профи в клиентском сервисе.' },
        { role: 'user', content: prompt },
      ]);

      return {
        success: true,
        data: {
          reply_text: response.content.trim(),
          original_review: review.text,
          rating: review.rating,
          marketplace: review.marketplace,
        },
      };
    } catch (error) {
      logger.error('[GenerateReviewReplyTool] Failed', { error, userId });
      return { success: false, error: 'Не удалось сгенерировать ответ.' };
    }
  },
});

import { z } from 'zod';
import { defineTool } from '../ToolRegistry.js';
import { logger } from '../../../api-lib/lib/logger.js';
import { llmRouter } from '../../../infrastructure/llm/LLMRouter.js';

/**
 * Universal Semantic Core Generator Tool
 * Generates a full 1000-keyword semantic core for any niche/product.
 */
export const generateSemanticCoreTool = defineTool({
  name: 'generate_semantic_core',
  description:
    'Генерирует комплексное семантическое ядро (ВЧ, СЧ, НЧ, LSI) для любого товара на WB/Ozon. Подходит для любой ниши.',
  category: 'analyze',
  schema: z.object({
    productCategory: z
      .string()
      .describe('Ниша или категория товара (например: косметика, электроника, мебель)'),
    targetAudience: z
      .string()
      .optional()
      .describe('Целевая аудитория (например: профессиональные мастера, домохозяйки)'),
    features: z.string().optional().describe('Ключевые особенности товара'),
  }),
  execute: async (userId, args) => {
    try {
      logger.info(`[SemanticCore] Generating core for niche: ${args.productCategory}`);

      const systemPrompt = `Ты — ведущий SEO-аналитик маркетплейсов Wildberries и Ozon.
Твоя задача: спроектировать полное семантическое ядро для товара в нише "${args.productCategory}".

СТРУКТУРА ЯДРА (выдай в формате JSON):
1. HIGH_FREQUENCY: 10-15 самых мощных запросов для заголовка.
2. MIDDLE_FREQUENCY: 30-40 запросов для характеристик и доп. полей.
3. LSI_KEYWORDS: "скрытая семантика" — слова-ассоциации, которые повышают релевантность (материалы, эмоции, свойства).
4. INTENT_CLUSTERS: Группировка запросов по интенту (Подарок, Офис, Для дома и т.д.).
5. NEGATIVE_KEYWORDS: Список мусорных фраз для исключения в рекламе (АРК).

ФОРМАТ ОТВЕТА (JSON ONLY):
{
  "niche": "...",
  "core": {
    "header_keywords": [],
    "characteristic_keywords": [],
    "lsi_keywords": [],
    "clusters": { "name": ["phrase1", "phrase2"] },
    "negative_keywords": []
  },
  "recommendations": "..."
}`;

      const userPrompt = `Категория: ${args.productCategory}
Целевая аудитория: ${args.targetAudience || 'общая'}
Особенности: ${args.features || 'не указаны'}`;

      const response = await llmRouter.generateStructuredResponse(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.5, jsonMode: true }
      );

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      logger.error('Semantic core generation failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

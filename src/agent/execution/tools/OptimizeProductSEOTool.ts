import { z } from 'zod';
import { defineTool } from '../ToolRegistry.js';
import { logger } from '../../../api-lib/lib/logger.js';
import { llmRouter } from '../../../infrastructure/llm/LLMRouter.js';

/**
 * Optimize Product SEO Tool
 * Uses the 2025-2026 Semantic Core strategies from Arbarea strategy docs
 */
export const optimizeProductSEOTool = defineTool({
  name: 'optimize_product_seo',
  description:
    'Оптимизирует заголовок и описание товара на основе семантического ядра 2025 года. Использует LSI-фразы, кластеры WB и эмоциональный интент.',
  category: 'analyze',
  schema: z.object({
    productId: z.string().describe('ID товара для оптимизации'),
    marketplace: z.enum(['WB', 'Ozon']).describe('Маркетплейс'),
    currentTitle: z.string().describe('Текущий заголовок'),
    currentDescription: z.string().optional().describe('Текущее описание'),
    category: z.string().optional().describe('Категория (например: панно, рейлинг)'),
  }),
  execute: async (userId, args) => {
    try {
      logger.info(`[SEO] Optimizing product ${args.productId} for ${args.marketplace}`);

      const systemPrompt = `Ты — эксперт по SEO для маркетплейсов WB и Ozon, специализирующийся на бренде Arbarea (Loft, Handmade, Дерево).
Твоя задача: переписать заголовок и описание товара, используя семантическое ядро 2025 года.

СТРАТЕГИЯ 2025:
1. КЛАСТЕРЫ: Для WB важны точные вхождения в кластеры (панно из дерева, рейлинг для кухни).
2. ИНТЕНТ: Для панно важна эмоция (уют, сканди, подарок), для рейлингов — рациональность (размер, цвет, материал).
3. LSI: Используй скрытую семантику (фактура дерева, запах леса, премиум ясень).
4. ОГРАНИЧЕНИЯ: Заголовок WB до 100 символов, Ozon до 200.

СЕМАНТИЧЕСКОЕ ЯДРО (Контекст):
- Панно: геометрия, горы, массив сосны, декор над кроватью, подарок на новоселье.
- Рейлинги: 600/800/1000мм, черный матовый, штанга на фартук, организация пространства.
- Держатели: без сверления, массив ясеня, аксессуары для ванной премиум.

ОТВЕТ ГЕНЕРИРУЙ В ФОРМАТЕ JSON:
{
  "optimizedTitle": "...",
  "optimizedDescription": "...",
  "keyPhrasesAdded": ["...", "..."],
  "strategyApplied": "..."
}`;

      const userPrompt = `Товар: ${args.currentTitle}
Категория: ${args.category || 'автоопределение'}
Маркетплейс: ${args.marketplace}
Текущее описание: ${args.currentDescription || 'отсутствует'}

Выполни оптимизацию.`;

      const response = await llmRouter.generateStructuredResponse(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          temperature: 0.7,
          jsonMode: true,
        }
      );

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      logger.error('SEO optimization failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

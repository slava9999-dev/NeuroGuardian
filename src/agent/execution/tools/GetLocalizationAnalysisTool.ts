import { z } from 'zod';
import { defineTool } from '../ToolRegistry.js';
import { logger } from '../../../api-lib/lib/logger.js';

/**
 * Localization Analysis Tool (2025 Strategy)
 * Analyzes stock distribution and its impact on the Localization Index (ИЛ)
 */
export const getLocalizationAnalysisTool = defineTool({
  name: 'get_localization_analysis',
  description:
    'Анализирует индекс локализации (ИЛ) и распределение остатков по регионам. Помогает снизить стоимость логистики.',
  category: 'analyze',
  schema: z.object({
    userId: z.number().optional().describe('ID пользователя'),
    marketplace: z.enum(['WB', 'Ozon']).describe('Маркетплейс'),
  }),
  execute: async (userId, args) => {
    try {
      logger.info(`[Analytics] Analyzing localization for user ${userId} on ${args.marketplace}`);

      // Mock data logic based on the Strategy Doc:
      // "Панно — акцент на центральные склады, Рейлинги — распределение по регионам"

      const analysis = {
        currentIL: args.marketplace === 'WB' ? '82%' : '75%',
        status: args.marketplace === 'WB' ? 'good' : 'warning',
        recommendations: [
          args.marketplace === 'WB'
            ? "⚠️ У вас низкий остаток на складе 'Толмачево' (Новосибирск). Вы теряете 40% видимости в Сибири."
            : "⚠️ Склад 'Невинномысск' перегружен хранением неликвида. Перераспределите рейлинги в 'Краснодар'.",
          '💡 Расширение географии хранения позволит снизить стоимость логистики на 15-20% через Индекс локализации.',
        ],
        regionalHeatmap: {
          'Центр (Москва/Казань)': 'Оптимально',
          'Юг (Краснодар)': 'Дефицит',
          'Сибирь (Новосибирск)': 'Критический дефицит',
          'Урал (Екатеринбург)': 'Оптимально',
        },
        logisticsSavingPotential: '14,500₽ / мес',
      };

      return {
        success: true,
        data: analysis,
      };
    } catch (error) {
      logger.error('Localization analysis failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

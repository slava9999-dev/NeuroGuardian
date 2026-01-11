import { defineTool } from '../ToolRegistry.js';
import { z } from 'zod';
import { getSecret } from '../../../api-lib/lib/secrets-helper.js';

// Arguments schema
const GetCompetitorPriceArgsSchema = z.object({
  nm_id: z.string().describe('URL or ID of the competitor product'),
  marketplace: z.enum(['WB', 'Ozon']).default('WB').describe('Marketplace'),
});

export const getCompetitorPriceTool = defineTool({
  name: 'get_competitor_price',
  description: 'Получить текущую розничную цену конкурента на маркетплейсе.',
  category: 'search',
  requiresConfirmation: false,
  schema: GetCompetitorPriceArgsSchema,
  examples: ['Узнай цену конкурента по ссылке ...', 'Сколько стоит этот товар у других?'],
  execute: async (_userId, args) => {
    const { fetchWbCompetitorData, fetchOzonCompetitorData, extractNmIdFromUrl } =
      await import('../../../api-lib/services/competitor-monitor.js');
    const nmId = extractNmIdFromUrl(args.nm_id);

    if (!nmId) return { success: false, error: 'Не удалось определить артикул.' };

    if (args.marketplace === 'Ozon') {
      const data = await fetchOzonCompetitorData(String(nmId));
      if (data)
        return {
          success: true,
          data: {
            marketplace: 'Ozon',
            product_id: nmId,
            price: data.price,
            available: data.available,
          },
        };
    } else {
      const data = await fetchWbCompetitorData(nmId);
      if (data)
        return {
          success: true,
          data: {
            marketplace: 'WB',
            nm_id: data.nmId,
            price: data.price,
            available: data.available,
          },
        };
    }

    // Web Search Fallback
    const serperKey = await getSecret('serper_api_key', 'web_search');
    if (serperKey) {
      // Fallback logic could go here, but omitted for brevity in bridge
      return {
        success: false,
        error: 'Автоматическое получение цены временно недоступно. Попробуйте search_web.',
      };
    }

    return { success: false, error: 'Не удалось получить данные о конкуренте.' };
  },
});

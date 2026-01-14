import { z } from 'zod';
import { defineTool } from '../ToolRegistry.js';
import { priceParserService } from '../../../api-lib/services/index.js';

export const getRealPriceTool = defineTool({
  name: 'get_real_price',
  description:
    'Получает РЕАЛЬНУЮ цену для покупателя с сайта (Цифровое Зрение). Используйте этот инструмент, когда нужно узнать финальную стоимость товара для клиента (с учетом СПП, скидок, Ozon Карты), а не ту цену, которую установил селлер в кабинете. Работает в "боевом" режиме через мобильное API.',
  category: 'analyze',
  requiresConfirmation: false,
  examples: [
    'Какая реальная цена на WB для артикула 213123?',
    'Проверь цену покупателя для товара ozon',
    'Почему цена низкая? Посмотри реальную стоимость',
  ],
  schema: z.object({
    marketplace: z.enum(['wb', 'ozon']).describe('Маркетплейс (wb или ozon)'),
    sku: z.string().describe('Артикул товара (числовой ID или SKU)'),
  }),
  execute: async (_userId, args) => {
    const { marketplace, sku } = args;

    if (marketplace === 'wb') {
      const result = await priceParserService.getWbRealPrice(sku);
      if (result.error) {
        return { success: false, error: result.error };
      }

      const diff = result.sellerPrice - result.buyerPrice;
      const discountPercent =
        result.sellerPrice > 0 ? Math.round((diff / result.sellerPrice) * 100) : 0;

      return {
        success: true,
        data: {
          ...result,
          spp_estimate: `${discountPercent}% (СПП/Скидка покупателя)`,
          message: `Цена для покупателя: ${result.buyerPrice}₽. Селлерская цена: ${result.sellerPrice}₽. Скидка маркетплейса: ~${discountPercent}%`,
        },
      };
    } else {
      const result = await priceParserService.getOzonRealPrice(sku);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, data: result };
    }
  },
});

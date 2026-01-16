import { defineTool } from '../ToolRegistry.js';
import { UpdateProductSettingsArgsSchema } from '../../../api-lib/agent/validators.js';
import {
  updateProductCostPrice,
  updateProductCategory,
  updateProductMonitoring,
} from '../../../api-lib/services/index.js';
import { getFilteredProducts } from '../../../api-lib/services/database.js';

export const updateProductSettingsTool = defineTool({
  name: 'update_product_settings',
  description:
    'Обновление внутренних настроек товара: себестоимость, категория, мониторинг (мин. цена).',
  category: 'write',
  requiresConfirmation: true, // Internal changes still confirmed for safety
  schema: UpdateProductSettingsArgsSchema,
  examples: ['Установи себестоимость 500 для товара X', 'Измени категорию товара на "Одежда"'],
  execute: async (userId, args) => {
    // Industrial check: directly fetch one product
    const products = await getFilteredProducts(userId, {
      search: args.product_id,
      limit: 1,
      accountId: args.account_id,
    });

    if (products.length === 0) return { success: false, error: 'Товар не найден' };
    const p = products[0];
    const changes: string[] = [];

    if (args.cost_price !== undefined) {
      await updateProductCostPrice(userId, p.product_id, args.cost_price);
      changes.push(`себестоимость: ${args.cost_price}₽`);
    }
    if (args.category !== undefined) {
      await updateProductCategory(userId, p.product_id, args.category);
      changes.push(`категория: ${args.category}`);
    }
    if (args.min_price !== undefined || args.is_monitored !== undefined) {
      const monitored =
        args.is_monitored !== undefined ? args.is_monitored : (p.is_monitored ?? true);
      const minPrice = args.min_price !== undefined ? args.min_price : p.min_price;
      await updateProductMonitoring(userId, p.product_id, monitored, minPrice);
      if (args.min_price !== undefined) changes.push(`мин. цена: ${args.min_price}₽`);
      if (args.is_monitored !== undefined)
        changes.push(`мониторинг: ${monitored ? 'ВКЛ' : 'ВЫКЛ'}`);
    }

    return {
      success: true,
      data: {
        message: `Обновлены настройки для "${p.title}": ${changes.join(', ')}`,
        product_id: p.product_id,
        changes,
      },
    };
  },
});

import { z } from 'zod';
import { defineTool } from '../ToolRegistry.js';
import { db, products } from '../../../infrastructure/database/db.js';
import { eq, and } from 'drizzle-orm';

/**
 * Tool to add a competitor monitor to a product
 */
export const AddCompetitorMonitorTool = defineTool({
  name: 'add_competitor_monitor',
  description:
    'Добавляет ссылку на товар конкурента для отслеживания и автоматического репрайсинга.',
  category: 'write',
  requiresConfirmation: true, // Changing pricing strategy is dangerous
  schema: z.object({
    my_product_article: z.string().describe('Артикул моего товара (Wildberries/Ozon)'),
    competitor_url: z.string().url().describe('Полная ссылка на товар конкурента'),
    target_diff: z
      .number()
      .default(10)
      .describe('На сколько рублей быть дешевле конкурента (по умолчанию 10)'),
    strategy: z
      .enum(['passive', 'aggressive'])
      .default('passive')
      .describe('Стратегия: passive (только уведомления) или aggressive (авто-снижение цены)'),
  }),
  examples: [
    'Следи за конкурентом https://www.wildberries.ru/catalog/123456/detail.aspx для моего артикула 987654',
    'Хочу быть дешевле конкурента (ссылка) на 50 рублей, артикул 111222, стратегия aggressive',
  ],
  execute: async (userId, args) => {
    // 1. Find my product
    const product = await db.query.products.findFirst({
      where: and(
        eq(products.userId, String(userId)),
        eq(products.productId, args.my_product_article)
      ),
    });

    if (!product) {
      return {
        success: false,
        error: `Товар с артикулом ${args.my_product_article} не найден в вашем каталоге.`,
      };
    }

    // Format strategy string e.g. "aggressive:10" or "passive"
    const strategyValue =
      args.strategy === 'aggressive' ? `aggressive:${args.target_diff}` : 'passive';

    // 2. Update product
    await db
      .update(products)
      .set({
        competitorUrl: args.competitor_url,
        // competitorPrice: 0, // Не обязательно сбрасывать, или можно
        priceStrategy: strategyValue,
        updatedAt: new Date(),
      })
      .where(eq(products.id, product.id));

    return {
      success: true,
      data: {
        product_id: product.productId,
        competitor_url: args.competitor_url,
        strategy: strategyValue,
      },
      message: `✅ Конкурент добавлен для товара ${args.my_product_article}!\n\n🔗 Ссылка: ${args.competitor_url}\n⚔️ Стратегия: ${args.strategy} (Diff: ${args.target_diff}₽)`,
    };
  },
});

/**
 * Tool to check sentinel status and potential threats
 */
export const CheckSentinelStatusTool = defineTool({
  name: 'check_sentinel_status',
  description: 'Проверяет статус защиты Sentinel и показывает последние угрозы.',
  category: 'read',
  requiresConfirmation: false,
  schema: z.object({}),
  examples: ['Статус Sentinel', 'Какие угрозы есть?'],
  execute: async (userId, _args) => {
    // Find products with monitoring enabled
    const stats = await db.query.products.findMany({
      where: and(eq(products.userId, String(userId)), eq(products.isMonitored, true)),
      columns: {
        id: true,
        title: true,
        productId: true,
        currentPrice: true,
        minPrice: true,
        competitorPrice: true,
        competitorUrl: true,
      },
    });

    if (stats.length === 0) {
      return {
        success: true,
        message:
          'Sentinel активен, но товары не находятся под мониторингом. Добавьте товары в защиту.',
      };
    }

    const threats = stats.filter(
      p => (p.currentPrice || 0) < (p.minPrice || 0) && (p.minPrice || 0) > 0
    );

    let message = `🛡️ **Sentinel Статус**\n\n📦 Под защитой: ${stats.length} товаров.\n`;

    if (threats.length > 0) {
      message += `\n⚠️ **Обнаружено ${threats.length} угроз (Цена ниже Stop Loss):**\n`;
      for (const t of threats.slice(0, 5)) {
        message += `• ${t.title} (${t.productId}): ${t.currentPrice}₽ < ${t.minPrice}₽\n`;
      }
      if (threats.length > 5) message += `...и еще ${threats.length - 5}.\n`;
      message += `\nРекомендую использовать команду "Исправить цены" или нажать кнопку в отчете.`;
    } else {
      message += `\n✅ Угроз не обнаружено. Все цены в норме.`;
    }

    return {
      success: true,
      message,
    };
  },
});

/**
 * Tool to get overall inventory statistics (Ozon vs WB counts)
 */
export const GetInventoryStatsTool = defineTool({
  name: 'get_inventory_stats',
  description: 'Возвращает статистику по количеству товаров на Ozon и Wildberries.',
  category: 'read',
  requiresConfirmation: false,
  schema: z.object({}),
  examples: ['Сколько у меня товаров?', 'Статистика по маркетплейсам'],
  execute: async (userId, _args) => {
    // Count all products grouped by marketplace
    const allProducts = await db.query.products.findMany({
      where: eq(products.userId, String(userId)),
      columns: { marketplace: true },
    });

    const stats = {
      ozon: allProducts.filter(p => p.marketplace === 'Ozon').length,
      wb: allProducts.filter(p => p.marketplace === 'WB').length,
      total: allProducts.length,
    };

    return {
      success: true,
      data: stats,
      message: `📊 **Ваш каталог:**\n- Ozon: ${stats.ozon} товаров\n- Wildberries: ${stats.wb} товаров\n- Всего: ${stats.total} товаров`,
    };
  },
});

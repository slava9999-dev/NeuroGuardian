import { defineTool } from '../ToolRegistry.js';
import { GetReviewsArgsSchema, type GetReviewsArgs } from '../../../api-lib/agent/validators.js';
import { getUserReviews } from '../../../api-lib/services/reviews-service.js';

export const getReviewsTool = defineTool({
  name: 'get_reviews',
  description: 'Получить последние отзывы покупателей о товарах.',
  category: 'read',
  requiresConfirmation: false,
  schema: GetReviewsArgsSchema,
  examples: ['Что пишут покупатели?', 'Покажи последние отзывы', 'Жалуются ли на товар X?'],
  execute: async (userId, args: GetReviewsArgs) => {
    const reviews = await getUserReviews(userId, {
      ...args,
      marketplace: (args.marketplace === 'all' ? undefined : args.marketplace) as
        | 'WB'
        | 'Ozon'
        | undefined,
      accountId: args.account_id,
    });
    if (reviews.length === 0)
      return { success: true, data: { reviews: [], message: 'Отзывов пока нет.' } };

    return {
      success: true,
      data: {
        total: reviews.length,
        reviews: reviews.slice(0, args.limit).map(r => ({
          marketplace: r.marketplace,
          rating: r.rating,
          text: r.text,
          author: r.author_name,
          date: r.created_at,
          product: r.product_title || r.product_id,
        })),
      },
    };
  },
});

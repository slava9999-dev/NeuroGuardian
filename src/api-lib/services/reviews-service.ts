import { fetchWithRetry } from '../lib/index.js';
import { getMarketplaceKeys } from './marketplace-bridge.js';
import { logger } from '../lib/logger.js';

// Types
export interface Review {
  id: string;
  marketplace: 'WB' | 'Ozon';
  product_id: string; // nmID or product_id
  product_title?: string;
  product_image?: string;
  rating: number;
  text: string;
  created_at: string;
  author_name: string;
  status: 'new' | 'viewed' | 'replied';
  answer?: string;
}

export interface GetReviewsParams {
  limit?: number;
  is_replied?: boolean; // true = answered, false = new, undefined = all
  marketplace?: 'WB' | 'Ozon';
  accountId?: number;
}

/**
 * Fetch WB Reviews
 * API: https://feedbacks-api.wildberries.ru/api/v1/feedbacks
 */
async function fetchWbReviews(apiKey: string, params: GetReviewsParams): Promise<Review[]> {
  try {
    const queryParams = new URLSearchParams({
      isAnswered: String(params.is_replied ?? false),
      take: String(params.limit || 20),
      skip: '0',
      order: 'dateDesc',
    });

    const response = (await fetchWithRetry(
      `https://feedbacks-api.wildberries.ru/api/v1/feedbacks?${queryParams}`,
      {
        headers: { Authorization: apiKey },
      }
    )) as { data?: { feedbacks: unknown[] } };

    const items = response.data?.feedbacks || [];

    return items.map((item: unknown) => {
      const i = item as {
        id: string;
        nmId: unknown;
        productName?: string;
        productValuation?: number;
        text: string;
        createdDate: string;
        userName: string;
        answer?: { text: string };
      };
      return {
        id: i.id,
        marketplace: 'WB',
        product_id: String(i.nmId),
        product_title: i.productName || String(i.productValuation || ''),
        rating: i.productValuation || 0,
        text: i.text,
        created_at: i.createdDate,
        author_name: i.userName,
        status: i.answer ? 'replied' : 'new',
        answer: i.answer ? i.answer.text : undefined,
      };
    });
  } catch (error) {
    logger.error('WB Reviews Error:', error);
    return [];
  }
}

/**
 * Fetch Ozon Reviews
 * API: https://api-seller.ozon.ru/v2/product/reviews (Actually via POST /v1/review/list usually or interaction API)
 * NOTE: Ozon Official API for reviews requires interaction-api scope.
 * Let's assume standard seller API.
 */
async function fetchOzonReviews(
  clientId: string,
  apiKey: string,
  params: GetReviewsParams
): Promise<Review[]> {
  try {
    const response = (await fetchWithRetry('https://api-seller.ozon.ru/v1/review/list', {
      method: 'POST',
      body: JSON.stringify({
        page: 1,
        page_size: params.limit || 20,
        sort_dir: 'DESC',
        status:
          params.is_replied === true ? 'PROCESSED' : params.is_replied === false ? 'NEW' : 'ALL',
      }),
      headers: {
        'Client-Id': clientId,
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    })) as { result?: unknown[] };

    const items = response.result || [];

    return items.map((item: unknown) => {
      const i = item as {
        id: string;
        sku: unknown;
        rating: number;
        text: string;
        created_at: string;
        interaction_status: string;
      };
      return {
        id: i.id,
        marketplace: 'Ozon',
        product_id: String(i.sku),
        rating: i.rating,
        text: i.text,
        created_at: i.created_at,
        author_name: 'Покупатель Ozon',
        status: i.interaction_status === 'PROCESSED' ? 'replied' : 'new',
      };
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn('Ozon Reviews API Error:', { error: errorMsg });
    return [];
  }
}

/**
 * Main Service Function
 */
export async function getUserReviews(
  userId: number,
  params: GetReviewsParams = {}
): Promise<Review[]> {
  const keys = await getMarketplaceKeys(userId, params.accountId);
  const reviews: Review[] = [];

  if (keys.wb && (!params.marketplace || params.marketplace === 'WB')) {
    const wbReviews = await fetchWbReviews(keys.wb, params);
    reviews.push(...wbReviews);
  }

  if (keys.ozon && (!params.marketplace || params.marketplace === 'Ozon')) {
    const ozonReviews = await fetchOzonReviews(keys.ozon.clientId, keys.ozon.apiKey, params);
    reviews.push(...ozonReviews);
  }

  return reviews.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

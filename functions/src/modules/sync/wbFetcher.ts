// ============================================
// NeuroGUARDIAN — WB Fetcher
// Wildberries Content API integration
// ============================================

import axios, { AxiosError } from 'axios';
import { 
  WBCardsListResponseSchema, 
  WBPricesResponseSchema,
  ProductDoc,
  WBCard,
} from '../../schemas';
import { exponentialBackoff } from '../../lib/rateLimiter';

// WB API endpoints
const WB_API_BASE = {
  content: 'https://content-api.wildberries.ru',
  prices: 'https://discounts-prices-api.wb.ru',
  stocks: 'https://marketplace-api.wildberries.ru',
};

interface WBFetcherConfig {
  apiKey: string;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Create WB API client with auth headers
 */
function createWBClient(apiKey: string, baseURL: string, timeoutMs: number = 30000) {
  return axios.create({
    baseURL,
    timeout: timeoutMs,
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Fetch all cards (products) from WB Content API with pagination
 */
export async function fetchWBCards(
  config: WBFetcherConfig
): Promise<WBCard[]> {
  const client = createWBClient(config.apiKey, WB_API_BASE.content, config.timeoutMs);
  const allCards: WBCard[] = [];
  let cursor: { nmID?: number; updatedAt?: string } = {};
  let hasMore = true;
  
  console.log('Starting WB cards fetch...');
  
  while (hasMore) {
    try {
      const response = await exponentialBackoff(
        async () => {
          return client.post('/content/v2/get/cards/list', {
            settings: {
              cursor: {
                limit: 100, // Max per request
                ...(cursor.nmID && { nmID: cursor.nmID }),
                ...(cursor.updatedAt && { updatedAt: cursor.updatedAt }),
              },
              filter: {
                withPhoto: -1, // All products
              },
            },
          });
        },
        config.maxRetries ?? 3
      );
      
      // Validate response
      const parsed = WBCardsListResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        console.error('Invalid WB response:', parsed.error);
        break;
      }
      
      const { cards, cursor: newCursor } = parsed.data;
      
      if (cards && cards.length > 0) {
        allCards.push(...cards);
        console.log(`Fetched ${cards.length} cards, total: ${allCards.length}`);
        
        // Update cursor for next page
        if (newCursor?.nmID) {
          cursor = {
            nmID: newCursor.nmID,
            updatedAt: newCursor.updatedAt,
          };
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Error fetching WB cards:', axiosError.message);
      
      if (axiosError.response?.status === 429) {
        console.log('Rate limited, will retry with backoff...');
        // exponentialBackoff handles this
      }
      
      throw error;
    }
  }
  
  console.log(`Completed WB cards fetch. Total: ${allCards.length}`);
  return allCards;
}

/**
 * Fetch current prices from WB Prices API
 */
export async function fetchWBPrices(
  config: WBFetcherConfig,
  nmIds: number[]
): Promise<Map<number, number>> {
  const client = createWBClient(config.apiKey, WB_API_BASE.prices, config.timeoutMs);
  const priceMap = new Map<number, number>();
  
  // WB API accepts max 1000 IDs per request
  const chunks = chunkArray(nmIds, 1000);
  
  for (const chunk of chunks) {
    try {
      const response = await exponentialBackoff(
        async () => {
          return client.get('/public/api/v1/info', {
            params: {
              quantity: 0, // Get all
            },
          });
        },
        config.maxRetries ?? 3
      );
      
      // Validate response
      const parsed = WBPricesResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        console.error('Invalid WB prices response:', parsed.error);
        continue;
      }
      
      for (const item of parsed.data) {
        if (chunk.includes(item.nmId)) {
          priceMap.set(item.nmId, item.price);
        }
      }
    } catch (error) {
      console.error('Error fetching WB prices:', error);
      throw error;
    }
  }
  
  return priceMap;
}

/**
 * Update stock to zero (Defense Protocol)
 */
export async function zeroWBStock(
  config: WBFetcherConfig,
  skus: string[],
  warehouseId: number
): Promise<boolean> {
  const client = createWBClient(config.apiKey, WB_API_BASE.stocks, config.timeoutMs);
  
  try {
    const stocks = skus.map(sku => ({
      sku,
      warehouseId,
      amount: 0,
    }));
    
    await exponentialBackoff(
      async () => {
        return client.put('/api/v3/stocks', { stocks });
      },
      config.maxRetries ?? 3
    );
    
    console.log(`Successfully zeroed stock for ${skus.length} SKUs`);
    return true;
  } catch (error) {
    console.error('Error zeroing WB stock:', error);
    return false;
  }
}

/**
 * Update price (Defense Protocol - Price Correction mode)
 */
export async function updateWBPrice(
  config: WBFetcherConfig,
  nmId: number,
  newPrice: number
): Promise<boolean> {
  const client = createWBClient(config.apiKey, WB_API_BASE.prices, config.timeoutMs);
  
  try {
    await exponentialBackoff(
      async () => {
        return client.post('/public/api/v1/prices', [{
          nmId,
          price: newPrice,
        }]);
      },
      config.maxRetries ?? 3
    );
    
    console.log(`Successfully updated price for nmId ${nmId} to ${newPrice}`);
    return true;
  } catch (error) {
    console.error('Error updating WB price:', error);
    return false;
  }
}

/**
 * Map WB card to our Product format
 */
export function mapWBCardToProduct(
  card: WBCard, 
  userId: number,
  existingProduct?: Partial<ProductDoc>
): Omit<ProductDoc, 'id'> {
  const imageUrl = card.photos?.[0]?.c246x328 || card.photos?.[0]?.big || '';
  const price = card.sizes?.[0]?.price || 0;
  
  return {
    userId,
    productId: `wb-${card.nmID}`,
    nmId: card.nmID,
    vendorCode: card.vendorCode,
    title: card.title || `Товар ${card.vendorCode}`,
    imageUrl,
    brand: card.brand,
    currentPrice: price,
    minPrice: existingProduct?.minPrice ?? 0,
    stock: 0, // Will be updated separately
    marketplace: 'WB',
    status: existingProduct?.status ?? 'active',
    isMonitored: existingProduct?.isMonitored ?? false,
    lastCheckedAt: new Date(),
    lastTriggeredAt: existingProduct?.lastTriggeredAt ?? null,
    createdAt: existingProduct?.createdAt ?? new Date(),
    updatedAt: new Date(),
  };
}

// Helper function
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

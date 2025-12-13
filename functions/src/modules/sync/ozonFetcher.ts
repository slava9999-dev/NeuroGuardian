// ============================================
// NeuroGUARDIAN — Ozon Fetcher
// Ozon Seller API integration
// ============================================

import axios, { AxiosError } from 'axios';
import { 
  OzonProductListResponseSchema,
  OzonProductInfoResponseSchema,
  OzonPricesResponseSchema,
  ProductDoc,
  OzonProductItemSchema,
} from '../../schemas';
import { exponentialBackoff } from '../../lib/rateLimiter';
import { z } from 'zod';

// Ozon API endpoint
const OZON_API_BASE = 'https://api-seller.ozon.ru';

interface OzonFetcherConfig {
  apiKey: string;
  clientId: string;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Create Ozon API client with auth headers
 */
function createOzonClient(config: OzonFetcherConfig) {
  return axios.create({
    baseURL: OZON_API_BASE,
    timeout: config.timeoutMs ?? 30000,
    headers: {
      'Client-Id': config.clientId,
      'Api-Key': config.apiKey,
      'Content-Type': 'application/json',
    },
  });
}

type OzonProductItem = z.infer<typeof OzonProductItemSchema>;

/**
 * Fetch all products from Ozon with pagination
 */
export async function fetchOzonProducts(
  config: OzonFetcherConfig
): Promise<OzonProductItem[]> {
  const client = createOzonClient(config);
  const allProducts: OzonProductItem[] = [];
  let lastId = '';
  let hasMore = true;
  
  console.log('Starting Ozon products fetch...');
  
  while (hasMore) {
    try {
      const response = await exponentialBackoff(
        async () => {
          return client.post('/v2/product/list', {
            filter: {
              visibility: 'ALL',
            },
            last_id: lastId || undefined,
            limit: 1000, // Max per request
          });
        },
        config.maxRetries ?? 3
      );
      
      // Validate response
      const parsed = OzonProductListResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        console.error('Invalid Ozon response:', parsed.error);
        break;
      }
      
      const { items, last_id, total } = parsed.data.result;
      
      if (items && items.length > 0) {
        allProducts.push(...items);
        console.log(`Fetched ${items.length} products, total: ${allProducts.length}/${total}`);
        
        if (last_id && items.length === 1000) {
          lastId = last_id;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Error fetching Ozon products:', axiosError.message);
      throw error;
    }
  }
  
  console.log(`Completed Ozon products fetch. Total: ${allProducts.length}`);
  return allProducts;
}

/**
 * Fetch detailed product info including images
 */
export async function fetchOzonProductInfo(
  config: OzonFetcherConfig,
  productIds: number[]
) {
  const client = createOzonClient(config);
  const chunks = chunkArray(productIds, 100); // Ozon limit
  const allInfo: z.infer<typeof OzonProductInfoResponseSchema>['result']['items'] = [];
  
  for (const chunk of chunks) {
    try {
      const response = await exponentialBackoff(
        async () => {
          return client.post('/v2/product/info', {
            product_id: chunk,
          });
        },
        config.maxRetries ?? 3
      );
      
      const parsed = OzonProductInfoResponseSchema.safeParse(response.data);
      if (parsed.success) {
        allInfo.push(...parsed.data.result.items);
      }
    } catch (error) {
      console.error('Error fetching Ozon product info:', error);
    }
  }
  
  return allInfo;
}

/**
 * Fetch current prices from Ozon
 */
export async function fetchOzonPrices(
  config: OzonFetcherConfig,
  productIds: number[]
): Promise<Map<number, number>> {
  const client = createOzonClient(config);
  const priceMap = new Map<number, number>();
  const chunks = chunkArray(productIds, 1000);
  
  for (const chunk of chunks) {
    try {
      const response = await exponentialBackoff(
        async () => {
          return client.post('/v1/product/info/prices', {
            filter: {
              offer_id: [], // Empty = all
              product_id: chunk,
              visibility: 'ALL',
            },
            limit: 1000,
          });
        },
        config.maxRetries ?? 3
      );
      
      const parsed = OzonPricesResponseSchema.safeParse(response.data);
      if (parsed.success) {
        for (const item of parsed.data.result.items) {
          const price = parseFloat(item.price.price) || 0;
          priceMap.set(item.product_id, price);
        }
      }
    } catch (error) {
      console.error('Error fetching Ozon prices:', error);
    }
  }
  
  return priceMap;
}

/**
 * Update stock to zero (Defense Protocol)
 */
export async function zeroOzonStock(
  config: OzonFetcherConfig,
  items: Array<{ product_id: number; offer_id: string }>,
  warehouseId: number
): Promise<boolean> {
  const client = createOzonClient(config);
  
  try {
    const stocks = items.map(item => ({
      offer_id: item.offer_id,
      product_id: item.product_id,
      stock: 0,
      warehouse_id: warehouseId,
    }));
    
    await exponentialBackoff(
      async () => {
        return client.post('/v2/products/stocks', { stocks });
      },
      config.maxRetries ?? 3
    );
    
    console.log(`Successfully zeroed stock for ${items.length} Ozon products`);
    return true;
  } catch (error) {
    console.error('Error zeroing Ozon stock:', error);
    return false;
  }
}

/**
 * Update price (Defense Protocol - Price Correction mode)
 */
export async function updateOzonPrice(
  config: OzonFetcherConfig,
  productId: number,
  offerId: string,
  newPrice: number
): Promise<boolean> {
  const client = createOzonClient(config);
  
  try {
    await exponentialBackoff(
      async () => {
        return client.post('/v1/product/import/prices', {
          prices: [{
            product_id: productId,
            offer_id: offerId,
            price: newPrice.toString(),
            old_price: '0', // No strikethrough price
          }],
        });
      },
      config.maxRetries ?? 3
    );
    
    console.log(`Successfully updated Ozon price for ${productId} to ${newPrice}`);
    return true;
  } catch (error) {
    console.error('Error updating Ozon price:', error);
    return false;
  }
}

/**
 * Map Ozon product to our Product format
 */
export function mapOzonProductToProduct(
  product: OzonProductItem,
  info: z.infer<typeof OzonProductInfoResponseSchema>['result']['items'][0] | null,
  userId: number,
  existingProduct?: Partial<ProductDoc>
): Omit<ProductDoc, 'id'> {
  const imageUrl = info?.primary_image || info?.images?.[0] || '';
  const price = info?.marketing_price 
    ? parseFloat(info.marketing_price) 
    : (info?.price ? parseFloat(info.price) : 0);
  const stock = info?.stocks?.present ?? 0;
  
  return {
    userId,
    productId: `ozon-${product.product_id}`,
    offerId: product.offer_id,
    vendorCode: product.offer_id,
    title: info?.name || product.name || `Товар ${product.offer_id}`,
    imageUrl,
    currentPrice: price,
    minPrice: existingProduct?.minPrice ?? 0,
    stock,
    marketplace: 'Ozon',
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

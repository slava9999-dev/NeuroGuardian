import { OzonProductInfoResponseSchema, ProductDoc, OzonProductItemSchema } from '../../schemas';
import { z } from 'zod';
interface OzonFetcherConfig {
    apiKey: string;
    clientId: string;
    maxRetries?: number;
    timeoutMs?: number;
}
type OzonProductItem = z.infer<typeof OzonProductItemSchema>;
/**
 * Fetch all products from Ozon with pagination
 */
export declare function fetchOzonProducts(config: OzonFetcherConfig): Promise<OzonProductItem[]>;
/**
 * Fetch detailed product info including images
 */
export declare function fetchOzonProductInfo(config: OzonFetcherConfig, productIds: number[]): Promise<{
    offer_id: string;
    name: string;
    id: number;
    price?: string | undefined;
    stocks?: {
        present: number;
        reserved: number;
    } | undefined;
    barcode?: string | undefined;
    primary_image?: string | undefined;
    images?: string[] | undefined;
    marketing_price?: string | undefined;
    min_price?: string | undefined;
}[]>;
/**
 * Fetch current prices from Ozon
 */
export declare function fetchOzonPrices(config: OzonFetcherConfig, productIds: number[]): Promise<Map<number, number>>;
/**
 * Update stock to zero (Defense Protocol)
 */
export declare function zeroOzonStock(config: OzonFetcherConfig, items: Array<{
    product_id: number;
    offer_id: string;
}>, warehouseId: number): Promise<boolean>;
/**
 * Update price (Defense Protocol - Price Correction mode)
 */
export declare function updateOzonPrice(config: OzonFetcherConfig, productId: number, offerId: string, newPrice: number): Promise<boolean>;
/**
 * Map Ozon product to our Product format
 */
export declare function mapOzonProductToProduct(product: OzonProductItem, info: z.infer<typeof OzonProductInfoResponseSchema>['result']['items'][0] | null, userId: number, existingProduct?: Partial<ProductDoc>): Omit<ProductDoc, 'id'>;
export {};
//# sourceMappingURL=ozonFetcher.d.ts.map
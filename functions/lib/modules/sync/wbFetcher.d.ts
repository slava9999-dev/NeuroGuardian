import { ProductDoc, WBCard } from '../../schemas';
interface WBFetcherConfig {
    apiKey: string;
    maxRetries?: number;
    timeoutMs?: number;
}
/**
 * Fetch all cards (products) from WB Content API with pagination
 */
export declare function fetchWBCards(config: WBFetcherConfig): Promise<WBCard[]>;
/**
 * Fetch current prices from WB Prices API
 */
export declare function fetchWBPrices(config: WBFetcherConfig, nmIds: number[]): Promise<Map<number, number>>;
/**
 * Update stock to zero (Defense Protocol)
 */
export declare function zeroWBStock(config: WBFetcherConfig, skus: string[], warehouseId: number): Promise<boolean>;
/**
 * Update price (Defense Protocol - Price Correction mode)
 */
export declare function updateWBPrice(config: WBFetcherConfig, nmId: number, newPrice: number): Promise<boolean>;
/**
 * Map WB card to our Product format
 */
export declare function mapWBCardToProduct(card: WBCard, userId: number, existingProduct?: Partial<ProductDoc>): Omit<ProductDoc, 'id'>;
export {};
//# sourceMappingURL=wbFetcher.d.ts.map
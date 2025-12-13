"use strict";
// ============================================
// NeuroGUARDIAN — Ozon Fetcher
// Ozon Seller API integration
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchOzonProducts = fetchOzonProducts;
exports.fetchOzonProductInfo = fetchOzonProductInfo;
exports.fetchOzonPrices = fetchOzonPrices;
exports.zeroOzonStock = zeroOzonStock;
exports.updateOzonPrice = updateOzonPrice;
exports.mapOzonProductToProduct = mapOzonProductToProduct;
const axios_1 = __importDefault(require("axios"));
const schemas_1 = require("../../schemas");
const rateLimiter_1 = require("../../lib/rateLimiter");
// Ozon API endpoint
const OZON_API_BASE = 'https://api-seller.ozon.ru';
/**
 * Create Ozon API client with auth headers
 */
function createOzonClient(config) {
    return axios_1.default.create({
        baseURL: OZON_API_BASE,
        timeout: config.timeoutMs ?? 30000,
        headers: {
            'Client-Id': config.clientId,
            'Api-Key': config.apiKey,
            'Content-Type': 'application/json',
        },
    });
}
/**
 * Fetch all products from Ozon with pagination
 */
async function fetchOzonProducts(config) {
    const client = createOzonClient(config);
    const allProducts = [];
    let lastId = '';
    let hasMore = true;
    console.log('Starting Ozon products fetch...');
    while (hasMore) {
        try {
            const response = await (0, rateLimiter_1.exponentialBackoff)(async () => {
                return client.post('/v2/product/list', {
                    filter: {
                        visibility: 'ALL',
                    },
                    last_id: lastId || undefined,
                    limit: 1000, // Max per request
                });
            }, config.maxRetries ?? 3);
            // Validate response
            const parsed = schemas_1.OzonProductListResponseSchema.safeParse(response.data);
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
                }
                else {
                    hasMore = false;
                }
            }
            else {
                hasMore = false;
            }
        }
        catch (error) {
            const axiosError = error;
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
async function fetchOzonProductInfo(config, productIds) {
    const client = createOzonClient(config);
    const chunks = chunkArray(productIds, 100); // Ozon limit
    const allInfo = [];
    for (const chunk of chunks) {
        try {
            const response = await (0, rateLimiter_1.exponentialBackoff)(async () => {
                return client.post('/v2/product/info', {
                    product_id: chunk,
                });
            }, config.maxRetries ?? 3);
            const parsed = schemas_1.OzonProductInfoResponseSchema.safeParse(response.data);
            if (parsed.success) {
                allInfo.push(...parsed.data.result.items);
            }
        }
        catch (error) {
            console.error('Error fetching Ozon product info:', error);
        }
    }
    return allInfo;
}
/**
 * Fetch current prices from Ozon
 */
async function fetchOzonPrices(config, productIds) {
    const client = createOzonClient(config);
    const priceMap = new Map();
    const chunks = chunkArray(productIds, 1000);
    for (const chunk of chunks) {
        try {
            const response = await (0, rateLimiter_1.exponentialBackoff)(async () => {
                return client.post('/v1/product/info/prices', {
                    filter: {
                        offer_id: [], // Empty = all
                        product_id: chunk,
                        visibility: 'ALL',
                    },
                    limit: 1000,
                });
            }, config.maxRetries ?? 3);
            const parsed = schemas_1.OzonPricesResponseSchema.safeParse(response.data);
            if (parsed.success) {
                for (const item of parsed.data.result.items) {
                    const price = parseFloat(item.price.price) || 0;
                    priceMap.set(item.product_id, price);
                }
            }
        }
        catch (error) {
            console.error('Error fetching Ozon prices:', error);
        }
    }
    return priceMap;
}
/**
 * Update stock to zero (Defense Protocol)
 */
async function zeroOzonStock(config, items, warehouseId) {
    const client = createOzonClient(config);
    try {
        const stocks = items.map(item => ({
            offer_id: item.offer_id,
            product_id: item.product_id,
            stock: 0,
            warehouse_id: warehouseId,
        }));
        await (0, rateLimiter_1.exponentialBackoff)(async () => {
            return client.post('/v2/products/stocks', { stocks });
        }, config.maxRetries ?? 3);
        console.log(`Successfully zeroed stock for ${items.length} Ozon products`);
        return true;
    }
    catch (error) {
        console.error('Error zeroing Ozon stock:', error);
        return false;
    }
}
/**
 * Update price (Defense Protocol - Price Correction mode)
 */
async function updateOzonPrice(config, productId, offerId, newPrice) {
    const client = createOzonClient(config);
    try {
        await (0, rateLimiter_1.exponentialBackoff)(async () => {
            return client.post('/v1/product/import/prices', {
                prices: [{
                        product_id: productId,
                        offer_id: offerId,
                        price: newPrice.toString(),
                        old_price: '0', // No strikethrough price
                    }],
            });
        }, config.maxRetries ?? 3);
        console.log(`Successfully updated Ozon price for ${productId} to ${newPrice}`);
        return true;
    }
    catch (error) {
        console.error('Error updating Ozon price:', error);
        return false;
    }
}
/**
 * Map Ozon product to our Product format
 */
function mapOzonProductToProduct(product, info, userId, existingProduct) {
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
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
//# sourceMappingURL=ozonFetcher.js.map
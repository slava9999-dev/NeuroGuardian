"use strict";
// ============================================
// NeuroGUARDIAN — WB Fetcher
// Wildberries Content API integration
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchWBCards = fetchWBCards;
exports.fetchWBPrices = fetchWBPrices;
exports.zeroWBStock = zeroWBStock;
exports.updateWBPrice = updateWBPrice;
exports.mapWBCardToProduct = mapWBCardToProduct;
const axios_1 = __importDefault(require("axios"));
const schemas_1 = require("../../schemas");
const rateLimiter_1 = require("../../lib/rateLimiter");
// WB API endpoints
const WB_API_BASE = {
    content: 'https://content-api.wildberries.ru',
    prices: 'https://discounts-prices-api.wb.ru',
    stocks: 'https://marketplace-api.wildberries.ru',
};
/**
 * Create WB API client with auth headers
 */
function createWBClient(apiKey, baseURL, timeoutMs = 30000) {
    return axios_1.default.create({
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
async function fetchWBCards(config) {
    const client = createWBClient(config.apiKey, WB_API_BASE.content, config.timeoutMs);
    const allCards = [];
    let cursor = {};
    let hasMore = true;
    console.log('Starting WB cards fetch...');
    while (hasMore) {
        try {
            const response = await (0, rateLimiter_1.exponentialBackoff)(async () => {
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
            }, config.maxRetries ?? 3);
            // Validate response
            const parsed = schemas_1.WBCardsListResponseSchema.safeParse(response.data);
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
async function fetchWBPrices(config, nmIds) {
    const client = createWBClient(config.apiKey, WB_API_BASE.prices, config.timeoutMs);
    const priceMap = new Map();
    // WB API accepts max 1000 IDs per request
    const chunks = chunkArray(nmIds, 1000);
    for (const chunk of chunks) {
        try {
            const response = await (0, rateLimiter_1.exponentialBackoff)(async () => {
                return client.get('/public/api/v1/info', {
                    params: {
                        quantity: 0, // Get all
                    },
                });
            }, config.maxRetries ?? 3);
            // Validate response
            const parsed = schemas_1.WBPricesResponseSchema.safeParse(response.data);
            if (!parsed.success) {
                console.error('Invalid WB prices response:', parsed.error);
                continue;
            }
            for (const item of parsed.data) {
                if (chunk.includes(item.nmId)) {
                    priceMap.set(item.nmId, item.price);
                }
            }
        }
        catch (error) {
            console.error('Error fetching WB prices:', error);
            throw error;
        }
    }
    return priceMap;
}
/**
 * Update stock to zero (Defense Protocol)
 */
async function zeroWBStock(config, skus, warehouseId) {
    const client = createWBClient(config.apiKey, WB_API_BASE.stocks, config.timeoutMs);
    try {
        const stocks = skus.map(sku => ({
            sku,
            warehouseId,
            amount: 0,
        }));
        await (0, rateLimiter_1.exponentialBackoff)(async () => {
            return client.put('/api/v3/stocks', { stocks });
        }, config.maxRetries ?? 3);
        console.log(`Successfully zeroed stock for ${skus.length} SKUs`);
        return true;
    }
    catch (error) {
        console.error('Error zeroing WB stock:', error);
        return false;
    }
}
/**
 * Update price (Defense Protocol - Price Correction mode)
 */
async function updateWBPrice(config, nmId, newPrice) {
    const client = createWBClient(config.apiKey, WB_API_BASE.prices, config.timeoutMs);
    try {
        await (0, rateLimiter_1.exponentialBackoff)(async () => {
            return client.post('/public/api/v1/prices', [{
                    nmId,
                    price: newPrice,
                }]);
        }, config.maxRetries ?? 3);
        console.log(`Successfully updated price for nmId ${nmId} to ${newPrice}`);
        return true;
    }
    catch (error) {
        console.error('Error updating WB price:', error);
        return false;
    }
}
/**
 * Map WB card to our Product format
 */
function mapWBCardToProduct(card, userId, existingProduct) {
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
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
//# sourceMappingURL=wbFetcher.js.map
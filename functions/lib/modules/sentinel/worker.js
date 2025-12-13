"use strict";
// ============================================
// NeuroGUARDIAN — Worker Function
// Cloud Tasks triggered worker
// Checks prices and executes defense
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.processUser = processUser;
const firestore_1 = require("../../lib/firestore");
const secretManager_1 = require("../sync/secretManager");
const wbFetcher_1 = require("../sync/wbFetcher");
const ozonFetcher_1 = require("../sync/ozonFetcher");
const defenseProtocol_1 = require("./defenseProtocol");
/**
 * Main worker function
 * Called by Cloud Tasks for each user
 */
async function processUser(payload) {
    const startTime = Date.now();
    const { userId, marketplace, productIds, priority } = payload;
    console.log(`Worker starting for user ${userId}, priority: ${priority}`);
    const result = {
        userId,
        productsChecked: 0,
        defensesTriggered: 0,
        errors: 0,
        duration: 0,
    };
    try {
        // Get user settings
        const user = await (0, firestore_1.getUser)(userId);
        if (!user) {
            console.error(`User ${userId} not found`);
            result.errors++;
            return finalizeResult(result, startTime);
        }
        // Check subscription
        if (!user.subscriptionActive) {
            console.log(`User ${userId} subscription inactive, skipping`);
            return finalizeResult(result, startTime);
        }
        // Check if protection is enabled
        if (!user.protectionEnabled) {
            console.log(`User ${userId} protection disabled, skipping`);
            return finalizeResult(result, startTime);
        }
        const defenseMode = user.defenseMode;
        // Get monitored products
        let products = await (0, firestore_1.getMonitoredProducts)(userId, marketplace);
        // Filter by specific product IDs if provided
        if (productIds && productIds.length > 0) {
            products = products.filter((p) => productIds.includes(p.productId));
        }
        if (products.length === 0) {
            console.log(`No monitored products for user ${userId}`);
            return finalizeResult(result, startTime);
        }
        console.log(`Checking ${products.length} products for user ${userId}`);
        // Group products by marketplace
        const wbProducts = products.filter((p) => p.marketplace === 'WB');
        const ozonProducts = products.filter((p) => p.marketplace === 'Ozon');
        // Process WB products
        if (wbProducts.length > 0) {
            const wbResult = await processWBProducts(userId, wbProducts, defenseMode);
            result.productsChecked += wbResult.checked;
            result.defensesTriggered += wbResult.triggered;
            result.errors += wbResult.errors;
        }
        // Process Ozon products
        if (ozonProducts.length > 0) {
            const ozonResult = await processOzonProducts(userId, ozonProducts, defenseMode);
            result.productsChecked += ozonResult.checked;
            result.defensesTriggered += ozonResult.triggered;
            result.errors += ozonResult.errors;
        }
        return finalizeResult(result, startTime);
    }
    catch (error) {
        console.error(`Worker error for user ${userId}:`, error);
        result.errors++;
        return finalizeResult(result, startTime);
    }
}
/**
 * Process WB products
 */
async function processWBProducts(userId, products, defenseMode) {
    const result = { checked: 0, triggered: 0, errors: 0 };
    try {
        // Get API key
        const credentials = await (0, secretManager_1.getApiKey)(userId, 'WB');
        if (!credentials) {
            console.error(`No WB API key for user ${userId}`);
            result.errors = products.length;
            return result;
        }
        // Get nmIds
        const nmIds = products
            .filter((p) => p.nmId)
            .map((p) => p.nmId);
        if (nmIds.length === 0) {
            console.log('No WB products with nmId');
            return result;
        }
        // Fetch current prices
        const priceMap = await (0, wbFetcher_1.fetchWBPrices)({ apiKey: credentials.apiKey, maxRetries: 2 }, nmIds);
        // Check each product
        for (const product of products) {
            result.checked++;
            if (!product.nmId)
                continue;
            const currentPrice = priceMap.get(product.nmId);
            if (currentPrice === undefined) {
                console.warn(`No price found for WB product ${product.nmId}`);
                continue;
            }
            // Check if defense should trigger
            if ((0, defenseProtocol_1.shouldTriggerDefense)(currentPrice, product.minPrice)) {
                console.log(`Defense trigger for WB ${product.nmId}: ${currentPrice} < ${product.minPrice}`);
                const defenseResult = await (0, defenseProtocol_1.executeDefense)({
                    userId,
                    product,
                    currentPrice,
                    minPrice: product.minPrice,
                    defenseMode,
                    wbApiKey: credentials.apiKey,
                });
                if (defenseResult.success) {
                    result.triggered++;
                }
                else {
                    result.errors++;
                }
            }
            else {
                // Update last checked time
                await (0, firestore_1.updateProductStatus)(userId, product.productId, product.status, {
                    currentPrice,
                    lastCheckedAt: new Date(),
                });
            }
        }
    }
    catch (error) {
        console.error('Error processing WB products:', error);
        result.errors++;
    }
    return result;
}
/**
 * Process Ozon products
 */
async function processOzonProducts(userId, products, defenseMode) {
    const result = { checked: 0, triggered: 0, errors: 0 };
    try {
        // Get API key
        const credentials = await (0, secretManager_1.getApiKey)(userId, 'Ozon');
        if (!credentials || !credentials.clientId) {
            console.error(`No Ozon API credentials for user ${userId}`);
            result.errors = products.length;
            return result;
        }
        // Get product IDs
        const productIds = products
            .map((p) => parseInt(p.productId.replace('ozon-', ''), 10))
            .filter((id) => !isNaN(id));
        if (productIds.length === 0) {
            console.log('No valid Ozon product IDs');
            return result;
        }
        // Fetch current prices
        const priceMap = await (0, ozonFetcher_1.fetchOzonPrices)({ apiKey: credentials.apiKey, clientId: credentials.clientId, maxRetries: 2 }, productIds);
        // Check each product
        for (const product of products) {
            result.checked++;
            const ozonProductId = parseInt(product.productId.replace('ozon-', ''), 10);
            if (isNaN(ozonProductId))
                continue;
            const currentPrice = priceMap.get(ozonProductId);
            if (currentPrice === undefined) {
                console.warn(`No price found for Ozon product ${ozonProductId}`);
                continue;
            }
            // Check if defense should trigger
            if ((0, defenseProtocol_1.shouldTriggerDefense)(currentPrice, product.minPrice)) {
                console.log(`Defense trigger for Ozon ${ozonProductId}: ${currentPrice} < ${product.minPrice}`);
                const defenseResult = await (0, defenseProtocol_1.executeDefense)({
                    userId,
                    product,
                    currentPrice,
                    minPrice: product.minPrice,
                    defenseMode,
                    ozonApiKey: credentials.apiKey,
                    ozonClientId: credentials.clientId,
                });
                if (defenseResult.success) {
                    result.triggered++;
                }
                else {
                    result.errors++;
                }
            }
            else {
                // Update last checked time
                await (0, firestore_1.updateProductStatus)(userId, product.productId, product.status, {
                    currentPrice,
                    lastCheckedAt: new Date(),
                });
            }
        }
    }
    catch (error) {
        console.error('Error processing Ozon products:', error);
        result.errors++;
    }
    return result;
}
/**
 * Finalize result with duration
 */
function finalizeResult(result, startTime) {
    result.duration = Date.now() - startTime;
    console.log(`Worker completed for user ${result.userId} in ${result.duration}ms: ${result.productsChecked} checked, ${result.defensesTriggered} triggered, ${result.errors} errors`);
    return result;
}
//# sourceMappingURL=worker.js.map
"use strict";
// ============================================
// NeuroGUARDIAN — Defense Protocol
// Actions when price drops below minPrice
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeDefense = executeDefense;
exports.shouldTriggerDefense = shouldTriggerDefense;
exports.calculateSavings = calculateSavings;
const wbFetcher_1 = require("../sync/wbFetcher");
const ozonFetcher_1 = require("../sync/ozonFetcher");
const firestore_1 = require("../../lib/firestore");
const alerting_1 = require("./alerting");
/**
 * Execute defense protocol for a single product
 */
async function executeDefense(ctx) {
    const { userId, product, currentPrice, minPrice, defenseMode } = ctx;
    console.log(`Executing defense for product ${product.productId}: ${currentPrice} < ${minPrice}`);
    const savedAmount = minPrice - currentPrice;
    try {
        let success = false;
        let action = 'none';
        let newStock;
        let newPrice;
        if (defenseMode === 'zero_stock') {
            // Mode 1: Zero out stock
            success = await executeZeroStock(ctx);
            action = 'zero_stock';
            newStock = 0;
        }
        else {
            // Mode 2: Correct price back to minPrice
            success = await executePriceCorrection(ctx);
            action = 'price_correction';
            newPrice = minPrice;
        }
        if (success) {
            // Update product status
            await (0, firestore_1.updateProductStatus)(userId, product.productId, 'triggered', {
                lastTriggeredAt: new Date(),
                currentPrice: newPrice ?? currentPrice,
                stock: newStock ?? product.stock,
            });
            // Update user stats
            const user = await (0, firestore_1.getUser)(userId);
            if (user) {
                await (0, firestore_1.updateUserStats)(userId, {
                    triggeredToday: (user.triggeredToday || 0) + 1,
                    savedAmount: (user.savedAmount || 0) + savedAmount,
                });
            }
            // Add log entry
            await (0, firestore_1.addLogEntry)(userId, 'defense_triggered', `🛡️ Защита сработала!`, `Товар "${product.title}" защищён. ${defenseMode === 'zero_stock' ? 'Сток обнулён.' : `Цена восстановлена до ${minPrice}₽.`}`, {
                oldPrice: currentPrice,
                newPrice: newPrice ?? currentPrice,
                minPrice,
                savedAmount,
                action,
                marketplace: product.marketplace,
            }, product.productId);
            // Send Telegram notification
            await (0, alerting_1.sendTelegramAlert)(userId, {
                type: 'defense_triggered',
                productTitle: product.title,
                vendorCode: product.vendorCode,
                oldPrice: currentPrice,
                minPrice,
                action,
                savedAmount,
                marketplace: product.marketplace,
            });
            return {
                success: true,
                action,
                productId: product.productId,
                marketplace: product.marketplace,
                oldPrice: currentPrice,
                newPrice,
                oldStock: product.stock,
                newStock,
                message: `Defense executed: ${action}`,
            };
        }
        else {
            throw new Error('Defense action failed');
        }
    }
    catch (error) {
        console.error(`Defense failed for product ${product.productId}:`, error);
        // Log the error
        await (0, firestore_1.addLogEntry)(userId, 'error', '❌ Ошибка защиты', `Не удалось защитить товар "${product.title}": ${error.message}`, {
            error: error.message,
            productId: product.productId,
            marketplace: product.marketplace,
        }, product.productId);
        return {
            success: false,
            action: 'none',
            productId: product.productId,
            marketplace: product.marketplace,
            oldPrice: currentPrice,
            message: `Defense failed: ${error.message}`,
            error: error.message,
        };
    }
}
/**
 * Execute zero stock action
 */
async function executeZeroStock(ctx) {
    const { product, wbApiKey, ozonApiKey, ozonClientId } = ctx;
    if (product.marketplace === 'WB') {
        if (!wbApiKey) {
            throw new Error('WB API key not available');
        }
        // Get SKUs from product (need to fetch or store them)
        // For now, using vendorCode as SKU
        const skus = [product.vendorCode];
        const warehouseId = 1; // TODO: Get actual warehouse ID
        return (0, wbFetcher_1.zeroWBStock)({ apiKey: wbApiKey, maxRetries: 3 }, skus, warehouseId);
    }
    else if (product.marketplace === 'Ozon') {
        if (!ozonApiKey || !ozonClientId) {
            throw new Error('Ozon API credentials not available');
        }
        const productId = parseInt(product.productId.replace('ozon-', ''), 10);
        const warehouseId = 1; // TODO: Get actual warehouse ID
        return (0, ozonFetcher_1.zeroOzonStock)({ apiKey: ozonApiKey, clientId: ozonClientId, maxRetries: 3 }, [{ product_id: productId, offer_id: product.offerId || '' }], warehouseId);
    }
    return false;
}
/**
 * Execute price correction action
 */
async function executePriceCorrection(ctx) {
    const { product, minPrice, wbApiKey, ozonApiKey, ozonClientId } = ctx;
    if (product.marketplace === 'WB') {
        if (!wbApiKey) {
            throw new Error('WB API key not available');
        }
        const nmId = product.nmId;
        if (!nmId) {
            throw new Error('WB nmId not available');
        }
        return (0, wbFetcher_1.updateWBPrice)({ apiKey: wbApiKey, maxRetries: 3 }, nmId, minPrice);
    }
    else if (product.marketplace === 'Ozon') {
        if (!ozonApiKey || !ozonClientId) {
            throw new Error('Ozon API credentials not available');
        }
        const productId = parseInt(product.productId.replace('ozon-', ''), 10);
        return (0, ozonFetcher_1.updateOzonPrice)({ apiKey: ozonApiKey, clientId: ozonClientId, maxRetries: 3 }, productId, product.offerId || '', minPrice);
    }
    return false;
}
/**
 * Check if defense should trigger for a product
 */
function shouldTriggerDefense(currentPrice, minPrice) {
    // Only trigger if minPrice is set (> 0) and current price is below it
    return minPrice > 0 && currentPrice < minPrice;
}
/**
 * Calculate potential savings
 */
function calculateSavings(currentPrice, minPrice, stock) {
    if (currentPrice >= minPrice)
        return 0;
    return (minPrice - currentPrice) * stock;
}
//# sourceMappingURL=defenseProtocol.js.map
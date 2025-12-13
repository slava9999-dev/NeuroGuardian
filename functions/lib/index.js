"use strict";
// ============================================
// NeuroGUARDIAN — Cloud Functions Entry Point
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMinPrice = exports.updateSettings = exports.dailyReset = exports.sentinelWorker = exports.sentinelDispatcher = exports.getProducts = exports.saveApiKey = exports.paymentWebhook = exports.telegramAuth = exports.paymentSuccess = exports.refund = exports.validatePromo = exports.getPlans = exports.yookassaWebhook = exports.createPayment = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
// Initialize Firebase Admin
admin.initializeApp();
// Import modules
const gatekeeper_1 = require("./modules/gatekeeper");
const sync_1 = require("./modules/sync");
const sentinel_1 = require("./modules/sentinel");
const firestore_1 = require("./lib/firestore");
const schemas_1 = require("./schemas");
// NEW: Payment endpoints
const endpoints_1 = require("./modules/payments/endpoints");
Object.defineProperty(exports, "createPayment", { enumerable: true, get: function () { return endpoints_1.createPaymentEndpoint; } });
Object.defineProperty(exports, "yookassaWebhook", { enumerable: true, get: function () { return endpoints_1.paymentWebhookEndpoint; } });
Object.defineProperty(exports, "getPlans", { enumerable: true, get: function () { return endpoints_1.getPlansEndpoint; } });
Object.defineProperty(exports, "validatePromo", { enumerable: true, get: function () { return endpoints_1.validatePromoEndpoint; } });
Object.defineProperty(exports, "refund", { enumerable: true, get: function () { return endpoints_1.refundEndpoint; } });
Object.defineProperty(exports, "paymentSuccess", { enumerable: true, get: function () { return endpoints_1.paymentSuccessEndpoint; } });
const db = admin.firestore();
// ============================================
// AUTH ENDPOINTS
// ============================================
/**
 * Telegram WebApp authentication
 */
exports.telegramAuth = functions.https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { initData } = req.body;
        if (!initData) {
            res.status(400).json({ error: 'Missing initData' });
            return;
        }
        // Validate and parse initData
        const userData = (0, gatekeeper_1.parseAndValidateInitData)(initData);
        if (!userData || !userData.user) {
            res.status(401).json({ error: 'Invalid initData' });
            return;
        }
        const tgUser = userData.user;
        // Create or update user
        await (0, firestore_1.upsertUser)(tgUser.id, {
            telegramId: tgUser.id,
            username: tgUser.username ?? null,
            firstName: tgUser.first_name,
            lastName: tgUser.last_name ?? null,
            photoUrl: tgUser.photo_url ?? null,
            lastActiveAt: new Date(),
        });
        // Check subscription status
        const subscription = await (0, gatekeeper_1.checkSubscription)(tgUser.id);
        // Get user data
        const userDoc = await db.collection('users').doc(tgUser.id.toString()).get();
        const user = userDoc.data();
        // Grant trial if first login
        if (user && !user.subscriptionPlan && !subscription.isActive) {
            await (0, gatekeeper_1.grantTrialSubscription)(tgUser.id, 7);
        }
        res.json({
            success: true,
            user: {
                ...user,
                subscription,
            },
        });
    }
    catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: error.message });
    }
});
// ============================================
// PAYMENT ENDPOINTS
// ============================================
/**
 * CloudPayments webhook handler
 */
exports.paymentWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    try {
        const signature = req.headers['content-hmac'];
        const apiSecret = process.env.CLOUDPAYMENTS_API_SECRET || '';
        // Validate signature
        if (apiSecret && signature) {
            const isValid = (0, gatekeeper_1.validateCloudPaymentsSignature)(JSON.stringify(req.body), signature, apiSecret);
            if (!isValid) {
                console.error('Invalid payment webhook signature');
                res.status(401).json({ code: 13 }); // CloudPayments error code
                return;
            }
        }
        const { OperationType, Status } = req.body;
        if (OperationType === 'Payment' && Status === 'Completed') {
            await (0, gatekeeper_1.handlePaymentSuccess)(req.body);
        }
        else if (OperationType === 'Payment' && Status === 'Declined') {
            await (0, gatekeeper_1.handlePaymentFailure)(req.body);
        }
        else if (OperationType === 'Refund') {
            await (0, gatekeeper_1.handleRefund)(req.body);
        }
        res.json({ code: 0 }); // Success
    }
    catch (error) {
        console.error('Payment webhook error:', error);
        res.status(500).json({ code: 1, message: error.message });
    }
});
// ============================================
// SYNC ENDPOINTS
// ============================================
/**
 * Save API key and sync products
 */
exports.saveApiKey = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const { initData, marketplace, apiKey, clientId } = req.body;
        // Validate auth
        if (!(0, gatekeeper_1.validateInitData)(initData)) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const userId = (0, gatekeeper_1.parseAndValidateInitData)(initData)?.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        // Store API key in Secret Manager
        const keyRef = await (0, sync_1.storeApiKey)(userId, marketplace, apiKey, clientId);
        // Update user with key reference
        await db.collection('users').doc(userId.toString()).update({
            [`${marketplace.toLowerCase()}KeyRef`]: keyRef,
            updatedAt: new Date(),
        });
        // Sync products
        let productsCount = 0;
        if (marketplace === 'WB') {
            const cards = await (0, sync_1.fetchWBCards)({ apiKey, maxRetries: 3 });
            const products = cards.map(card => ({
                ...(0, sync_1.mapWBCardToProduct)(card, userId),
                productId: `wb-${card.nmID}`,
            }));
            await (0, firestore_1.batchUpsertProducts)(userId, products);
            productsCount = products.length;
        }
        else if (marketplace === 'Ozon' && clientId) {
            const items = await (0, sync_1.fetchOzonProducts)({ apiKey, clientId, maxRetries: 3 });
            const productIds = items.map(item => item.product_id);
            const infos = await (0, sync_1.fetchOzonProductInfo)({ apiKey, clientId }, productIds);
            const products = items.map(item => {
                const info = infos.find(i => i.id === item.product_id) ?? null;
                return {
                    ...(0, sync_1.mapOzonProductToProduct)(item, info, userId),
                    productId: `ozon-${item.product_id}`,
                };
            });
            await (0, firestore_1.batchUpsertProducts)(userId, products);
            productsCount = products.length;
        }
        // Update total products count
        await db.collection('users').doc(userId.toString()).update({
            totalProducts: productsCount,
            updatedAt: new Date(),
        });
        res.json({
            success: true,
            productsCount,
        });
    }
    catch (error) {
        console.error('Save API key error:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Get user's products
 */
exports.getProducts = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const initData = req.headers.authorization?.replace('Bearer ', '');
        if (!initData || !(0, gatekeeper_1.validateInitData)(initData)) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const userId = (0, gatekeeper_1.parseAndValidateInitData)(initData)?.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        const marketplace = req.query.marketplace;
        const products = await (0, firestore_1.getUserProducts)(userId, marketplace);
        res.json({
            success: true,
            products,
        });
    }
    catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: error.message });
    }
});
// ============================================
// SENTINEL FUNCTIONS
// ============================================
/**
 * Dispatcher - triggered by Cloud Scheduler every 1-2 minutes
 */
exports.sentinelDispatcher = functions.pubsub
    .schedule('every 2 minutes')
    .onRun(async () => {
    console.log('Sentinel Dispatcher running...');
    const result = await (0, sentinel_1.dispatch)();
    console.log('Dispatcher result:', result);
    return null;
});
/**
 * Worker - triggered by Cloud Tasks
 */
exports.sentinelWorker = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    try {
        // Parse and validate payload
        const payload = schemas_1.WorkerTaskPayloadSchema.parse(req.body);
        // Process user
        const result = await (0, sentinel_1.processUser)(payload);
        res.json({
            success: true,
            result,
        });
    }
    catch (error) {
        console.error('Worker error:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Daily reset - triggered at midnight
 */
exports.dailyReset = functions.pubsub
    .schedule('0 0 * * *')
    .timeZone('Europe/Moscow')
    .onRun(async () => {
    console.log('Running daily reset...');
    await (0, firestore_1.resetDailyTriggeredCounts)();
    return null;
});
// ============================================
// USER SETTINGS
// ============================================
/**
 * Update user settings (protection, defense mode, etc.)
 */
exports.updateSettings = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const initData = req.headers.authorization?.replace('Bearer ', '');
        if (!initData || !(0, gatekeeper_1.validateInitData)(initData)) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const userId = (0, gatekeeper_1.parseAndValidateInitData)(initData)?.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        const { protectionEnabled, defenseMode } = req.body;
        const updates = { updatedAt: new Date() };
        if (typeof protectionEnabled === 'boolean') {
            updates.protectionEnabled = protectionEnabled;
        }
        if (defenseMode === 'zero_stock' || defenseMode === 'price_correction') {
            updates.defenseMode = defenseMode;
        }
        await db.collection('users').doc(userId.toString()).update(updates);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Update product minPrice
 */
exports.updateMinPrice = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const initData = req.headers.authorization?.replace('Bearer ', '');
        if (!initData || !(0, gatekeeper_1.validateInitData)(initData)) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const userId = (0, gatekeeper_1.parseAndValidateInitData)(initData)?.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        const { productId, minPrice } = req.body;
        if (!productId || typeof minPrice !== 'number' || minPrice < 0) {
            res.status(400).json({ error: 'Invalid input' });
            return;
        }
        await db.collection('users')
            .doc(userId.toString())
            .collection('products')
            .doc(productId)
            .update({
            minPrice,
            status: minPrice > 0 ? 'protected' : 'active',
            updatedAt: new Date(),
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Update minPrice error:', error);
        res.status(500).json({ error: error.message });
    }
});
//# sourceMappingURL=index.js.map
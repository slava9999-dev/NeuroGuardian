"use strict";
// ============================================
// NeuroGUARDIAN — Payment Endpoints
// HTTP endpoints for payment flow
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
exports.paymentSuccessEndpoint = exports.refundEndpoint = exports.validatePromoEndpoint = exports.getPlansEndpoint = exports.paymentWebhookEndpoint = exports.createPaymentEndpoint = void 0;
const functions = __importStar(require("firebase-functions"));
const payments_1 = require("../../services/payments");
const users_1 = require("../../services/users");
const models_1 = require("../../schemas/models");
const crypto = __importStar(require("crypto"));
// ============================================
// CREATE PAYMENT
// ============================================
exports.createPaymentEndpoint = functions.https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { userId, planId, promoCode } = req.body;
        if (!userId || !planId) {
            res.status(400).json({ error: 'userId and planId are required' });
            return;
        }
        // Validate plan
        if (!models_1.PLAN_LIMITS[planId]) {
            res.status(400).json({ error: 'Invalid plan' });
            return;
        }
        // Verify user exists
        const user = await (0, users_1.getUserById)(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Create payment
        const result = await (0, payments_1.createPayment)({
            userId,
            planId,
            returnUrl: `${process.env.WEBAPP_URL || 'https://neuro-guardian.vercel.app'}/payment-success`,
            savePaymentMethod: true,
            promoCode,
        });
        if (result.success) {
            res.json({
                success: true,
                paymentId: result.paymentId,
                confirmationUrl: result.confirmationUrl,
            });
        }
        else {
            res.status(400).json({
                success: false,
                error: result.error,
            });
        }
    }
    catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ============================================
// PAYMENT WEBHOOK (YooKassa)
// ============================================
exports.paymentWebhookEndpoint = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    try {
        const event = req.body;
        // Validate webhook signature (if configured)
        const signature = req.headers['x-yookassa-signature'];
        if (process.env.YOOKASSA_WEBHOOK_SECRET && signature) {
            const expectedSignature = crypto
                .createHmac('sha256', process.env.YOOKASSA_WEBHOOK_SECRET)
                .update(JSON.stringify(req.body))
                .digest('hex');
            if (signature !== expectedSignature) {
                console.error('Invalid webhook signature');
                res.status(401).send('Invalid signature');
                return;
            }
        }
        // Process webhook
        await (0, payments_1.handlePaymentWebhook)(event);
        res.status(200).send('OK');
    }
    catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Internal server error');
    }
});
// ============================================
// GET SUBSCRIPTION PLANS
// ============================================
exports.getPlansEndpoint = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    const plans = Object.entries(models_1.PLAN_LIMITS).map(([id, plan]) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        price: plan.price,
        durationDays: plan.durationDays,
        features: {
            maxProducts: plan.maxProducts === -1 ? 'Unlimited' : plan.maxProducts,
            checkIntervalMinutes: plan.checkIntervalMinutes,
            defenseModes: plan.defenseModes,
            alertChannels: plan.alertChannels,
            supportPriority: plan.supportPriority,
        },
    }));
    res.json({ plans });
});
// ============================================
// VALIDATE PROMO CODE
// ============================================
exports.validatePromoEndpoint = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const { code, planId } = req.body;
        if (!code) {
            res.status(400).json({ valid: false, error: 'Code is required' });
            return;
        }
        const { db } = await Promise.resolve().then(() => __importStar(require('../../lib/firestore')));
        const promoDoc = await db.collection('promo_codes').doc(code.toUpperCase()).get();
        if (!promoDoc.exists) {
            res.json({ valid: false, error: 'Промокод не найден' });
            return;
        }
        const promo = promoDoc.data();
        const now = new Date();
        // Check validity
        if (promo.validFrom && new Date(promo.validFrom) > now) {
            res.json({ valid: false, error: 'Промокод ещё не активен' });
            return;
        }
        if (promo.validUntil && new Date(promo.validUntil) < now) {
            res.json({ valid: false, error: 'Промокод истёк' });
            return;
        }
        if (promo.maxUses && promo.usedCount >= promo.maxUses) {
            res.json({ valid: false, error: 'Промокод исчерпан' });
            return;
        }
        if (promo.planRestrictions && !promo.planRestrictions.includes(planId)) {
            res.json({ valid: false, error: 'Промокод не применим к этому тарифу' });
            return;
        }
        // Calculate discount
        const plan = models_1.PLAN_LIMITS[planId];
        if (!plan) {
            res.json({ valid: false, error: 'Неверный тариф' });
            return;
        }
        let discount = 0;
        if (promo.discountType === 'percent') {
            discount = Math.floor(plan.price * promo.discountValue / 100);
        }
        else {
            discount = promo.discountValue;
        }
        res.json({
            valid: true,
            discountType: promo.discountType,
            discountValue: promo.discountValue,
            discountAmount: discount,
            finalPrice: Math.max(plan.price - discount, 0),
        });
    }
    catch (error) {
        console.error('Validate promo error:', error);
        res.status(500).json({ valid: false, error: 'Ошибка сервера' });
    }
});
// ============================================
// REQUEST REFUND (Admin only)
// ============================================
exports.refundEndpoint = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        // Simple admin auth (in production, use proper authentication)
        const adminKey = req.headers['x-admin-key'];
        if (adminKey !== process.env.ADMIN_API_KEY) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { transactionId, reason } = req.body;
        if (!transactionId) {
            res.status(400).json({ error: 'transactionId is required' });
            return;
        }
        const success = await (0, payments_1.createRefund)(transactionId, reason);
        res.json({ success });
    }
    catch (error) {
        console.error('Refund error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ============================================
// PAYMENT SUCCESS PAGE DATA
// ============================================
exports.paymentSuccessEndpoint = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    const { userId } = req.query;
    if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
    }
    try {
        const user = await (0, users_1.getUserById)(Number(userId));
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({
            success: true,
            subscription: {
                plan: user.subscriptionPlan,
                active: user.subscriptionActive,
                expiresAt: user.subscriptionExpiresAt,
            },
        });
    }
    catch (error) {
        console.error('Payment success error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=endpoints.js.map
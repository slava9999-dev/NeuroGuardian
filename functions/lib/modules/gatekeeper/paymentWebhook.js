"use strict";
// ============================================
// NeuroGUARDIAN — Payment Webhook Handler
// Handles T-Pay/CloudPayments webhooks
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
exports.PRICING = void 0;
exports.validateCloudPaymentsSignature = validateCloudPaymentsSignature;
exports.handlePaymentSuccess = handlePaymentSuccess;
exports.handlePaymentFailure = handlePaymentFailure;
exports.handleRefund = handleRefund;
exports.generatePaymentLink = generatePaymentLink;
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const subscriptionMiddleware_1 = require("./subscriptionMiddleware");
const db = admin.firestore();
// Pricing configuration
exports.PRICING = {
    basic: {
        monthly: { price: 990, days: 30 },
        quarterly: { price: 2490, days: 90 },
        yearly: { price: 7990, days: 365 },
    },
    pro: {
        monthly: { price: 1990, days: 30 },
        quarterly: { price: 4990, days: 90 },
        yearly: { price: 14990, days: 365 },
    },
};
/**
 * Validate CloudPayments webhook signature
 */
function validateCloudPaymentsSignature(body, signature, apiSecret) {
    try {
        const expectedSignature = crypto
            .createHmac('sha256', apiSecret)
            .update(body)
            .digest('base64');
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    }
    catch (error) {
        console.error('Error validating signature:', error);
        return false;
    }
}
/**
 * Handle successful payment webhook
 */
async function handlePaymentSuccess(payload) {
    console.log('Processing payment success:', payload);
    // Parse custom data
    let paymentData;
    try {
        if (payload.Data) {
            paymentData = JSON.parse(payload.Data);
        }
        else if (payload.AccountId) {
            // Fallback: extract from AccountId
            paymentData = {
                telegramId: parseInt(payload.AccountId, 10),
                plan: 'basic',
                period: 'monthly',
            };
        }
        else {
            throw new Error('Missing payment data');
        }
    }
    catch (error) {
        console.error('Failed to parse payment data:', error);
        throw new Error('INVALID_PAYMENT_DATA');
    }
    // Get days for the plan/period
    const planConfig = exports.PRICING[paymentData.plan]?.[paymentData.period];
    if (!planConfig) {
        throw new Error('INVALID_PLAN_OR_PERIOD');
    }
    // Extend subscription
    await (0, subscriptionMiddleware_1.extendSubscription)(paymentData.telegramId, paymentData.plan, planConfig.days);
    // Log transaction
    await db.collection('transactions').add({
        telegramId: paymentData.telegramId,
        transactionId: payload.TransactionId,
        amount: payload.Amount,
        currency: payload.Currency || 'RUB',
        plan: paymentData.plan,
        period: paymentData.period,
        days: planConfig.days,
        status: 'completed',
        createdAt: new Date(),
    });
    console.log(`Payment processed successfully for user ${paymentData.telegramId}`);
}
/**
 * Handle payment failure webhook
 */
async function handlePaymentFailure(payload) {
    console.log('Processing payment failure:', payload);
    // Log failed transaction
    await db.collection('transactions').add({
        transactionId: payload.TransactionId,
        amount: payload.Amount,
        status: 'failed',
        error: payload.Status,
        createdAt: new Date(),
    });
}
/**
 * Handle refund webhook
 */
async function handleRefund(payload) {
    console.log('Processing refund:', payload);
    // Parse user ID from payload
    let telegramId = null;
    if (payload.Data) {
        try {
            const data = JSON.parse(payload.Data);
            telegramId = data.telegramId;
        }
        catch {
            // Try AccountId
        }
    }
    if (!telegramId && payload.AccountId) {
        telegramId = parseInt(payload.AccountId, 10);
    }
    if (!telegramId || isNaN(telegramId)) {
        console.error('Cannot determine user for refund');
        return;
    }
    // Cancel subscription
    await (0, subscriptionMiddleware_1.cancelSubscription)(telegramId);
    // Log refund
    await db.collection('transactions').add({
        telegramId,
        transactionId: payload.TransactionId,
        amount: payload.Amount,
        status: 'refunded',
        createdAt: new Date(),
    });
    console.log(`Refund processed for user ${telegramId}`);
}
/**
 * Generate payment link for CloudPayments
 */
function generatePaymentLink(telegramId, plan, period) {
    const planConfig = exports.PRICING[plan][period];
    const data = {
        telegramId,
        plan,
        period,
    };
    // CloudPayments widget URL parameters
    const params = new URLSearchParams({
        publicId: process.env.CLOUDPAYMENTS_PUBLIC_ID || '',
        description: `NeuroGUARDIAN ${plan === 'pro' ? 'Pro' : 'Basic'} - ${period}`,
        amount: planConfig.price.toString(),
        currency: 'RUB',
        accountId: telegramId.toString(),
        data: JSON.stringify(data),
    });
    return `https://widget.cloudpayments.ru/pay?${params.toString()}`;
}
//# sourceMappingURL=paymentWebhook.js.map
"use strict";
// ============================================
// NeuroGUARDIAN — Payment Service
// YooKassa integration with auto-renewal
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPayment = createPayment;
exports.handlePaymentWebhook = handlePaymentWebhook;
exports.processAutoRenewals = processAutoRenewals;
exports.createRefund = createRefund;
const uuid_1 = require("uuid");
const axios_1 = __importDefault(require("axios"));
const firestore_1 = require("../lib/firestore");
const models_1 = require("../schemas/models");
// ============================================
// CONFIGURATION
// ============================================
const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3';
const SHOP_ID = process.env.YOOKASSA_SHOP_ID || '';
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || '';
const yookassaClient = axios_1.default.create({
    baseURL: YOOKASSA_API_URL,
    auth: {
        username: SHOP_ID,
        password: SECRET_KEY,
    },
    headers: {
        'Content-Type': 'application/json',
    },
});
// ============================================
// PAYMENT CREATION
// ============================================
async function createPayment(params) {
    const { userId, planId, returnUrl, savePaymentMethod = true, promoCode } = params;
    // Get plan details
    const plan = models_1.PLAN_LIMITS[planId];
    if (!plan) {
        return { success: false, error: 'Invalid plan' };
    }
    // Calculate amount with promo code
    let amount = plan.price;
    let discount = 0;
    if (promoCode) {
        const promo = await firestore_1.db.collection('promo_codes').doc(promoCode.toUpperCase()).get();
        if (promo.exists) {
            const promoData = promo.data();
            if (promoData.discountType === 'percent') {
                discount = Math.floor(amount * promoData.discountValue / 100);
            }
            else {
                discount = promoData.discountValue;
            }
            amount = Math.max(amount - discount, 0);
            // Increment usage count
            await promo.ref.update({
                usedCount: (promoData.usedCount || 0) + 1,
            });
        }
    }
    // Get user for customer ID
    const userDoc = await firestore_1.db.collection('users').doc(userId.toString()).get();
    const user = userDoc.data();
    // Create idempotency key
    const idempotencyKey = (0, uuid_1.v4)();
    // Create transaction record first
    const transactionId = (0, uuid_1.v4)();
    const transactionData = {
        id: transactionId,
        userId,
        type: 'subscription',
        status: 'pending',
        amount,
        currency: 'RUB',
        planId,
        periodDays: plan.durationDays,
        provider: 'yookassa',
        description: `Подписка NeuroGUARDIAN ${planId} на ${plan.durationDays} дней`,
        metadata: {
            promoCode,
            discount,
            originalAmount: plan.price,
        },
        createdAt: new Date(),
    };
    await firestore_1.db.collection('transactions').doc(transactionId).set(transactionData);
    try {
        // Create YooKassa payment
        const response = await yookassaClient.post('/payments', {
            amount: {
                value: amount.toFixed(2),
                currency: 'RUB',
            },
            capture: true, // Auto-capture
            confirmation: {
                type: 'redirect',
                return_url: returnUrl,
            },
            description: transactionData.description,
            metadata: {
                transaction_id: transactionId,
                user_id: userId,
                plan_id: planId,
            },
            save_payment_method: savePaymentMethod,
            ...(user?.customerId && { customer_id: user.customerId }),
            receipt: {
                customer: {
                    full_name: user?.firstName || 'Покупатель',
                },
                items: [
                    {
                        description: `Подписка ${planId.toUpperCase()}`,
                        quantity: 1,
                        amount: {
                            value: amount.toFixed(2),
                            currency: 'RUB',
                        },
                        vat_code: 1, // НДС не облагается
                        payment_mode: 'full_prepayment',
                        payment_subject: 'service',
                    },
                ],
            },
        }, {
            headers: {
                'Idempotence-Key': idempotencyKey,
            },
        });
        const paymentId = response.data.id;
        const confirmationUrl = response.data.confirmation?.confirmation_url;
        // Update transaction with external ID
        await firestore_1.db.collection('transactions').doc(transactionId).update({
            externalId: paymentId,
        });
        return {
            success: true,
            paymentId,
            confirmationUrl,
        };
    }
    catch (error) {
        console.error('YooKassa payment error:', error.response?.data || error.message);
        // Mark transaction as failed
        await firestore_1.db.collection('transactions').doc(transactionId).update({
            status: 'failed',
            metadata: {
                ...transactionData.metadata,
                error: error.response?.data || error.message,
            },
        });
        return {
            success: false,
            error: error.response?.data?.description || 'Ошибка создания платежа',
        };
    }
}
// ============================================
// WEBHOOK HANDLER
// ============================================
async function handlePaymentWebhook(event) {
    const { object: payment } = event;
    const transactionId = payment.metadata?.transaction_id;
    if (!transactionId) {
        console.error('Webhook: no transaction_id in metadata');
        return;
    }
    const transactionRef = firestore_1.db.collection('transactions').doc(transactionId);
    const transactionDoc = await transactionRef.get();
    if (!transactionDoc.exists) {
        console.error('Webhook: transaction not found:', transactionId);
        return;
    }
    const transaction = transactionDoc.data();
    switch (event.event) {
        case 'payment.succeeded':
            await handlePaymentSuccess(transaction, payment);
            break;
        case 'payment.canceled':
            await handlePaymentCanceled(transaction);
            break;
        case 'refund.succeeded':
            await handleRefundSuccess(transaction);
            break;
        default:
            console.log('Webhook: unhandled event:', event.event);
    }
}
// ============================================
// PAYMENT SUCCESS HANDLER
// ============================================
async function handlePaymentSuccess(transaction, payment) {
    const { userId, planId, periodDays } = transaction;
    // Update transaction
    await firestore_1.db.collection('transactions').doc(transaction.id).update({
        status: 'succeeded',
        paidAt: new Date(),
        paymentMethodType: payment.payment_method?.type,
    });
    // Calculate subscription dates
    const userRef = firestore_1.db.collection('users').doc(userId.toString());
    const userDoc = await userRef.get();
    const user = userDoc.data();
    const now = new Date();
    let expiresAt;
    // If already subscribed, extend from current expiry
    if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > now) {
        expiresAt = new Date(user.subscriptionExpiresAt);
        expiresAt.setDate(expiresAt.getDate() + (periodDays || 30));
    }
    else {
        // New subscription
        expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + (periodDays || 30));
    }
    // Update user subscription
    const updateData = {
        subscriptionPlan: planId || 'basic',
        subscriptionActive: true,
        subscriptionStartedAt: user.subscriptionStartedAt || now,
        subscriptionExpiresAt: expiresAt,
        totalPaid: (user.totalPaid || 0) + transaction.amount,
        updatedAt: now,
    };
    // Save payment method for auto-renewal
    if (payment.payment_method?.saved) {
        updateData.paymentMethodId = payment.payment_method.id;
    }
    await userRef.update(updateData);
    // Create log entry
    await firestore_1.db.collection('logs').add({
        id: (0, uuid_1.v4)(),
        userId,
        type: 'subscription_activated',
        title: 'Подписка активирована',
        message: `Тариф ${planId?.toUpperCase()} активирован до ${expiresAt.toLocaleDateString('ru-RU')}`,
        transactionId: transaction.id,
        metadata: { planId, expiresAt, amount: transaction.amount },
        read: false,
        createdAt: now,
    });
    // Send Telegram notification
    await sendTelegramNotification(userId, `✅ Подписка активирована!\n\nТариф: ${planId?.toUpperCase()}\nДействует до: ${expiresAt.toLocaleDateString('ru-RU')}\n\nСпасибо за покупку!`);
    // Handle referral commission
    if (user.referredBy) {
        await processReferralCommission(user.referredBy, transaction.amount);
    }
}
// ============================================
// PAYMENT CANCELED HANDLER
// ============================================
async function handlePaymentCanceled(transaction) {
    await firestore_1.db.collection('transactions').doc(transaction.id).update({
        status: 'canceled',
    });
    await firestore_1.db.collection('logs').add({
        id: (0, uuid_1.v4)(),
        userId: transaction.userId,
        type: 'payment_failed',
        title: 'Платёж отменён',
        message: 'Платёж был отменён',
        transactionId: transaction.id,
        read: false,
        createdAt: new Date(),
    });
}
// ============================================
// REFUND HANDLER
// ============================================
async function handleRefundSuccess(transaction) {
    await firestore_1.db.collection('transactions').doc(transaction.id).update({
        status: 'refunded',
        refundedAt: new Date(),
    });
    // Optionally deactivate subscription
    // (Usually we let it run until expiry)
    await firestore_1.db.collection('logs').add({
        id: (0, uuid_1.v4)(),
        userId: transaction.userId,
        type: 'payment_failed',
        title: 'Возврат средств',
        message: `Возврат ${transaction.amount}₽ выполнен`,
        transactionId: transaction.id,
        read: false,
        createdAt: new Date(),
    });
}
// ============================================
// AUTO-RENEWAL
// ============================================
async function processAutoRenewals() {
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    // Find users with expiring subscriptions
    const usersSnapshot = await firestore_1.db.collection('users')
        .where('subscriptionActive', '==', true)
        .where('autoRenew', '==', true)
        .where('paymentMethodId', '!=', null)
        .where('subscriptionExpiresAt', '<=', threeDaysFromNow)
        .where('subscriptionExpiresAt', '>', now)
        .get();
    for (const doc of usersSnapshot.docs) {
        const user = doc.data();
        try {
            await createRecurringPayment(user);
        }
        catch (error) {
            console.error(`Auto-renewal failed for user ${user.telegramId}:`, error);
        }
    }
}
async function createRecurringPayment(user) {
    const plan = models_1.PLAN_LIMITS[user.subscriptionPlan];
    const amount = plan.price;
    const transactionId = (0, uuid_1.v4)();
    await firestore_1.db.collection('transactions').doc(transactionId).set({
        id: transactionId,
        userId: user.telegramId,
        type: 'subscription',
        status: 'pending',
        amount,
        currency: 'RUB',
        planId: user.subscriptionPlan,
        periodDays: plan.durationDays,
        provider: 'yookassa',
        description: `Автопродление подписки ${user.subscriptionPlan}`,
        createdAt: new Date(),
    });
    try {
        const response = await yookassaClient.post('/payments', {
            amount: {
                value: amount.toFixed(2),
                currency: 'RUB',
            },
            capture: true,
            payment_method_id: user.paymentMethodId,
            description: `Автопродление NeuroGUARDIAN ${user.subscriptionPlan}`,
            metadata: {
                transaction_id: transactionId,
                user_id: user.telegramId,
                plan_id: user.subscriptionPlan,
                auto_renewal: true,
            },
        }, {
            headers: {
                'Idempotence-Key': (0, uuid_1.v4)(),
            },
        });
        await firestore_1.db.collection('transactions').doc(transactionId).update({
            externalId: response.data.id,
        });
    }
    catch (error) {
        console.error('Auto-renewal payment failed:', error.response?.data || error.message);
        await firestore_1.db.collection('transactions').doc(transactionId).update({
            status: 'failed',
        });
        // Notify user about failed auto-renewal
        await sendTelegramNotification(user.telegramId, `⚠️ Не удалось продлить подписку автоматически.\n\nПожалуйста, продлите подписку вручную, чтобы не потерять защиту.`);
    }
}
// ============================================
// REFERRAL SYSTEM
// ============================================
async function processReferralCommission(referrerId, paymentAmount) {
    const referralDoc = await firestore_1.db.collection('referrals')
        .where('ownerId', '==', referrerId)
        .limit(1)
        .get();
    if (referralDoc.empty)
        return;
    const referral = referralDoc.docs[0].data();
    const commissionPercent = referral.commissionPercent || 20;
    const commission = Math.floor(paymentAmount * commissionPercent / 100);
    // Update referral stats
    await referralDoc.docs[0].ref.update({
        totalEarned: (referral.totalEarned || 0) + commission,
        activeReferrals: (referral.activeReferrals || 0) + 1,
    });
    // Create bonus transaction
    await firestore_1.db.collection('transactions').add({
        id: (0, uuid_1.v4)(),
        userId: referrerId,
        type: 'bonus',
        status: 'succeeded',
        amount: commission,
        currency: 'RUB',
        provider: 'manual',
        description: `Реферальный бонус ${commissionPercent}%`,
        createdAt: new Date(),
        paidAt: new Date(),
    });
    // Notify referrer
    await sendTelegramNotification(referrerId, `🎁 Вы получили реферальный бонус ${commission}₽!\n\nСпасибо, что рекомендуете NeuroGUARDIAN.`);
}
// ============================================
// TELEGRAM NOTIFICATIONS
// ============================================
async function sendTelegramNotification(userId, message) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken)
        return;
    try {
        await axios_1.default.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: userId,
            text: message,
            parse_mode: 'HTML',
        });
    }
    catch (error) {
        console.error('Telegram notification failed:', error);
    }
}
// ============================================
// CREATE REFUND
// ============================================
async function createRefund(transactionId, reason) {
    const transactionDoc = await firestore_1.db.collection('transactions').doc(transactionId).get();
    if (!transactionDoc.exists)
        return false;
    const transaction = transactionDoc.data();
    if (transaction.status !== 'succeeded')
        return false;
    try {
        await yookassaClient.post('/refunds', {
            payment_id: transaction.externalId,
            amount: {
                value: transaction.amount.toFixed(2),
                currency: 'RUB',
            },
            description: reason || 'Возврат по запросу пользователя',
        }, {
            headers: {
                'Idempotence-Key': (0, uuid_1.v4)(),
            },
        });
        return true;
    }
    catch (error) {
        console.error('Refund failed:', error);
        return false;
    }
}
//# sourceMappingURL=payments.js.map
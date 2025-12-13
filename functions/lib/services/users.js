"use strict";
// ============================================
// NeuroGUARDIAN — User Service
// User management and subscription logic
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateUser = getOrCreateUser;
exports.getUserById = getUserById;
exports.getUserWithStatus = getUserWithStatus;
exports.updateUserSettings = updateUserSettings;
exports.checkExpiredSubscriptions = checkExpiredSubscriptions;
exports.applyReferralCode = applyReferralCode;
exports.getUserReferralStats = getUserReferralStats;
exports.updateUserStats = updateUserStats;
exports.resetDailyStats = resetDailyStats;
exports.createLogEntry = createLogEntry;
exports.getUserLogs = getUserLogs;
exports.markLogsAsRead = markLogsAsRead;
const uuid_1 = require("uuid");
const firestore_1 = require("../lib/firestore");
const models_1 = require("../schemas/models");
async function getOrCreateUser(telegramUser) {
    const userRef = firestore_1.db.collection('users').doc(telegramUser.id.toString());
    const userDoc = await userRef.get();
    const now = new Date();
    if (userDoc.exists) {
        // Update last active timestamp
        await userRef.update({
            lastActiveAt: now,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name || null,
            username: telegramUser.username || null,
            photoUrl: telegramUser.photo_url || null,
        });
        return userDoc.data();
    }
    // Create new user with trial
    const trialExpiresAt = new Date(now);
    trialExpiresAt.setDate(trialExpiresAt.getDate() + models_1.PLAN_LIMITS.trial.durationDays);
    const newUser = {
        telegramId: telegramUser.id,
        username: telegramUser.username || null,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name || null,
        photoUrl: telegramUser.photo_url || null,
        languageCode: telegramUser.language_code || 'ru',
        subscriptionPlan: 'trial',
        subscriptionActive: true,
        subscriptionStartedAt: now,
        subscriptionExpiresAt: trialExpiresAt,
        autoRenew: true,
        customerId: null,
        paymentMethodId: null,
        totalPaid: 0,
        protectionEnabled: false,
        defenseMode: 'zero_stock',
        alertsEnabled: true,
        emailForAlerts: null,
        wbKeyRef: null,
        ozonKeyRef: null,
        ozonClientId: null,
        totalProducts: 0,
        protectedProducts: 0,
        triggeredToday: 0,
        triggeredAllTime: 0,
        savedAmount: 0,
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
        lastCheckedAt: null,
        betaFeatures: false,
        referralCode: generateReferralCode(telegramUser.id),
        referredBy: null,
    };
    await userRef.set(newUser);
    // Create referral entry
    await firestore_1.db.collection('referrals').doc(newUser.referralCode).set({
        code: newUser.referralCode,
        ownerId: telegramUser.id,
        totalReferrals: 0,
        activeReferrals: 0,
        totalEarned: 0,
        commissionPercent: 20,
        createdAt: now,
    });
    // Log new user
    await createLogEntry(telegramUser.id, {
        type: 'info',
        title: 'Добро пожаловать!',
        message: `Пробный период активирован до ${trialExpiresAt.toLocaleDateString('ru-RU')}`,
    });
    return newUser;
}
// ============================================
// USER DATA RETRIEVAL
// ============================================
async function getUserById(telegramId) {
    const userDoc = await firestore_1.db.collection('users').doc(telegramId.toString()).get();
    return userDoc.exists ? userDoc.data() : null;
}
async function getUserWithStatus(telegramId) {
    const user = await getUserById(telegramId);
    if (!user)
        return null;
    return {
        user,
        isActive: (0, models_1.isSubscriptionActive)(user),
        daysLeft: (0, models_1.getDaysUntilExpiry)(user),
        limits: (0, models_1.checkPlanLimits)(user),
    };
}
// ============================================
// USER SETTINGS UPDATE
// ============================================
async function updateUserSettings(telegramId, settings) {
    const userRef = firestore_1.db.collection('users').doc(telegramId.toString());
    const userDoc = await userRef.get();
    if (!userDoc.exists)
        return false;
    const user = userDoc.data();
    // Check if user can use selected defense mode
    if (settings.defenseMode) {
        const limits = (0, models_1.checkPlanLimits)(user);
        if (!limits.canUseDefenseMode(settings.defenseMode)) {
            return false;
        }
    }
    await userRef.update({
        ...settings,
        updatedAt: new Date(),
    });
    await createLogEntry(telegramId, {
        type: 'settings_changed',
        title: 'Настройки обновлены',
        message: 'Настройки защиты изменены',
        metadata: settings,
    });
    return true;
}
// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================
async function checkExpiredSubscriptions() {
    const now = new Date();
    // Find expired subscriptions
    const expiredUsers = await firestore_1.db.collection('users')
        .where('subscriptionActive', '==', true)
        .where('subscriptionExpiresAt', '<', now)
        .get();
    for (const doc of expiredUsers.docs) {
        const user = doc.data();
        await doc.ref.update({
            subscriptionActive: false,
            protectionEnabled: false, // Disable protection
            updatedAt: now,
        });
        await createLogEntry(user.telegramId, {
            type: 'subscription_expired',
            title: 'Подписка истекла',
            message: 'Ваша подписка истекла. Продлите для продолжения защиты.',
        });
        // Send Telegram notification
        await sendExpiredNotification(user.telegramId);
    }
}
async function sendExpiredNotification(userId) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken)
        return;
    const axios = require('axios');
    try {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: userId,
            text: `⚠️ <b>Подписка истекла</b>\n\nВаша защита отключена. Продлите подписку, чтобы продолжить защищать маржу.`,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                        { text: '💳 Продлить подписку', web_app: { url: process.env.WEBAPP_URL } },
                    ]],
            },
        });
    }
    catch (error) {
        console.error('Failed to send expiry notification:', error);
    }
}
// ============================================
// REFERRAL SYSTEM
// ============================================
async function applyReferralCode(userId, referralCode) {
    const userRef = firestore_1.db.collection('users').doc(userId.toString());
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        return { success: false, error: 'Пользователь не найден' };
    }
    const user = userDoc.data();
    if (user.referredBy) {
        return { success: false, error: 'Вы уже использовали реферальный код' };
    }
    // Find referral
    const referralDoc = await firestore_1.db.collection('referrals').doc(referralCode.toUpperCase()).get();
    if (!referralDoc.exists) {
        return { success: false, error: 'Код не найден' };
    }
    const referral = referralDoc.data();
    // Can't refer yourself
    if (referral.ownerId === userId) {
        return { success: false, error: 'Нельзя использовать свой код' };
    }
    // Apply referral
    await userRef.update({
        referredBy: referral.ownerId,
        updatedAt: new Date(),
    });
    // Update referral stats
    await referralDoc.ref.update({
        totalReferrals: (referral.totalReferrals || 0) + 1,
    });
    return { success: true };
}
async function getUserReferralStats(userId) {
    const user = await getUserById(userId);
    if (!user?.referralCode)
        return null;
    const referralDoc = await firestore_1.db.collection('referrals').doc(user.referralCode).get();
    if (!referralDoc.exists)
        return null;
    const referral = referralDoc.data();
    const botUsername = process.env.BOT_USERNAME || 'neuroguardian_bot';
    return {
        code: user.referralCode,
        totalReferrals: referral.totalReferrals || 0,
        activeReferrals: referral.activeReferrals || 0,
        totalEarned: referral.totalEarned || 0,
        link: `https://t.me/${botUsername}?start=${user.referralCode}`,
    };
}
// ============================================
// STATISTICS
// ============================================
async function updateUserStats(userId, stats) {
    await firestore_1.db.collection('users').doc(userId.toString()).update({
        ...stats,
        updatedAt: new Date(),
    });
}
async function resetDailyStats() {
    // Reset triggeredToday for all users
    const batch = firestore_1.db.batch();
    const usersSnapshot = await firestore_1.db.collection('users').get();
    usersSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { triggeredToday: 0 });
    });
    await batch.commit();
}
// ============================================
// LOGGING
// ============================================
async function createLogEntry(userId, entry) {
    const logId = (0, uuid_1.v4)();
    await firestore_1.db.collection('logs').doc(logId).set({
        id: logId,
        userId,
        type: entry.type || 'info',
        title: entry.title || '',
        message: entry.message || '',
        productId: entry.productId || null,
        transactionId: entry.transactionId || null,
        metadata: entry.metadata || {},
        read: false,
        createdAt: new Date(),
    });
    return logId;
}
async function getUserLogs(userId, limit = 50) {
    const logsSnapshot = await firestore_1.db.collection('logs')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
    return logsSnapshot.docs.map((doc) => doc.data());
}
async function markLogsAsRead(userId) {
    const logsSnapshot = await firestore_1.db.collection('logs')
        .where('userId', '==', userId)
        .where('read', '==', false)
        .get();
    const batch = firestore_1.db.batch();
    logsSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { read: true });
    });
    await batch.commit();
}
// ============================================
// HELPERS
// ============================================
function generateReferralCode(userId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}
//# sourceMappingURL=users.js.map
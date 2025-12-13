"use strict";
// ============================================
// NeuroGUARDIAN — Subscription Middleware
// Checks subscription status before API calls
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
exports.checkSubscription = checkSubscription;
exports.requireSubscription = requireSubscription;
exports.grantTrialSubscription = grantTrialSubscription;
exports.extendSubscription = extendSubscription;
exports.cancelSubscription = cancelSubscription;
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
/**
 * Check if user has active subscription
 */
async function checkSubscription(telegramId) {
    try {
        const userDoc = await db.collection('users').doc(telegramId.toString()).get();
        if (!userDoc.exists) {
            return {
                isActive: false,
                expiresAt: null,
                plan: null,
                daysLeft: null,
            };
        }
        const user = userDoc.data();
        const now = new Date();
        // Check if subscription is active and not expired
        const isActive = user.subscriptionActive &&
            user.subscriptionExpiresAt !== null &&
            user.subscriptionExpiresAt > now;
        // Calculate days left
        const daysLeft = user.subscriptionExpiresAt
            ? Math.max(0, Math.ceil((user.subscriptionExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
            : null;
        return {
            isActive,
            expiresAt: user.subscriptionExpiresAt,
            plan: user.subscriptionPlan,
            daysLeft,
        };
    }
    catch (error) {
        console.error('Error checking subscription:', error);
        return {
            isActive: false,
            expiresAt: null,
            plan: null,
            daysLeft: null,
        };
    }
}
/**
 * Middleware to require active subscription
 * Returns user data if subscription is active, throws error otherwise
 */
async function requireSubscription(telegramId) {
    const userDoc = await db.collection('users').doc(telegramId.toString()).get();
    if (!userDoc.exists) {
        throw new Error('USER_NOT_FOUND');
    }
    const user = userDoc.data();
    const status = await checkSubscription(telegramId);
    if (!status.isActive) {
        throw new Error('SUBSCRIPTION_EXPIRED');
    }
    return user;
}
/**
 * Grant trial subscription to new user
 */
async function grantTrialSubscription(telegramId, days = 7) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    await db.collection('users').doc(telegramId.toString()).update({
        subscriptionActive: true,
        subscriptionExpiresAt: expiresAt,
        subscriptionPlan: 'trial',
        updatedAt: new Date(),
    });
    console.log(`Granted ${days}-day trial to user ${telegramId}`);
}
/**
 * Extend subscription after successful payment
 */
async function extendSubscription(telegramId, plan, days) {
    const userDoc = await db.collection('users').doc(telegramId.toString()).get();
    if (!userDoc.exists) {
        throw new Error('USER_NOT_FOUND');
    }
    const user = userDoc.data();
    const now = new Date();
    // Calculate new expiration: extend from current expiration if still active, otherwise from now
    let newExpiresAt;
    if (user.subscriptionActive && user.subscriptionExpiresAt && user.subscriptionExpiresAt > now) {
        newExpiresAt = new Date(user.subscriptionExpiresAt);
    }
    else {
        newExpiresAt = new Date();
    }
    newExpiresAt.setDate(newExpiresAt.getDate() + days);
    await db.collection('users').doc(telegramId.toString()).update({
        subscriptionActive: true,
        subscriptionExpiresAt: newExpiresAt,
        subscriptionPlan: plan,
        updatedAt: new Date(),
    });
    console.log(`Extended subscription for user ${telegramId}: ${plan} for ${days} days`);
}
/**
 * Cancel subscription (e.g., on refund)
 */
async function cancelSubscription(telegramId) {
    await db.collection('users').doc(telegramId.toString()).update({
        subscriptionActive: false,
        updatedAt: new Date(),
    });
    console.log(`Cancelled subscription for user ${telegramId}`);
}
//# sourceMappingURL=subscriptionMiddleware.js.map
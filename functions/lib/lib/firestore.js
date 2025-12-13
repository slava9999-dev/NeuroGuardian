"use strict";
// ============================================
// NeuroGUARDIAN — Firestore Helpers
// Database utilities
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
exports.getUser = getUser;
exports.upsertUser = upsertUser;
exports.getActiveProtectedUsers = getActiveProtectedUsers;
exports.updateUserStats = updateUserStats;
exports.getUserProducts = getUserProducts;
exports.getMonitoredProducts = getMonitoredProducts;
exports.upsertProduct = upsertProduct;
exports.batchUpsertProducts = batchUpsertProducts;
exports.updateProductStatus = updateProductStatus;
exports.addLogEntry = addLogEntry;
exports.getUserLogs = getUserLogs;
exports.markLogAsRead = markLogAsRead;
exports.resetDailyTriggeredCounts = resetDailyTriggeredCounts;
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// ============================================
// User Operations
// ============================================
/**
 * Get user by Telegram ID
 */
async function getUser(telegramId) {
    const doc = await db.collection('users').doc(telegramId.toString()).get();
    return doc.exists ? doc.data() : null;
}
/**
 * Create or update user
 */
async function upsertUser(telegramId, data) {
    const docRef = db.collection('users').doc(telegramId.toString());
    const existing = await docRef.get();
    if (existing.exists) {
        await docRef.update({
            ...data,
            updatedAt: new Date(),
        });
    }
    else {
        await docRef.set({
            telegramId,
            username: null,
            firstName: 'User',
            lastName: null,
            photoUrl: null,
            subscriptionActive: false,
            subscriptionExpiresAt: null,
            subscriptionPlan: null,
            protectionEnabled: false,
            defenseMode: 'zero_stock',
            wbKeyRef: null,
            ozonKeyRef: null,
            totalProducts: 0,
            triggeredToday: 0,
            savedAmount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastActiveAt: new Date(),
            ...data,
        });
    }
}
/**
 * Get users with protection enabled (for Dispatcher)
 */
async function getActiveProtectedUsers() {
    const snapshot = await db.collection('users')
        .where('protectionEnabled', '==', true)
        .where('subscriptionActive', '==', true)
        .get();
    return snapshot.docs.map((doc) => doc.data());
}
/**
 * Update user stats
 */
async function updateUserStats(telegramId, updates) {
    await db.collection('users').doc(telegramId.toString()).update({
        ...updates,
        updatedAt: new Date(),
    });
}
// ============================================
// Product Operations
// ============================================
/**
 * Get all products for user
 */
async function getUserProducts(telegramId, marketplace) {
    let query = db.collection('users')
        .doc(telegramId.toString())
        .collection('products');
    if (marketplace) {
        query = query.where('marketplace', '==', marketplace);
    }
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
/**
 * Get products with monitoring enabled
 */
async function getMonitoredProducts(telegramId, marketplace) {
    let query = db.collection('users')
        .doc(telegramId.toString())
        .collection('products')
        .where('minPrice', '>', 0);
    if (marketplace) {
        query = query.where('marketplace', '==', marketplace);
    }
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
/**
 * Upsert product
 */
async function upsertProduct(telegramId, productId, data) {
    await db.collection('users')
        .doc(telegramId.toString())
        .collection('products')
        .doc(productId)
        .set(data, { merge: true });
}
/**
 * Batch upsert products
 */
async function batchUpsertProducts(telegramId, products) {
    const batch = db.batch();
    const userProductsRef = db.collection('users')
        .doc(telegramId.toString())
        .collection('products');
    for (const product of products) {
        const docRef = userProductsRef.doc(product.productId);
        batch.set(docRef, product, { merge: true });
    }
    await batch.commit();
}
/**
 * Update product status
 */
async function updateProductStatus(telegramId, productId, status, additionalData) {
    await db.collection('users')
        .doc(telegramId.toString())
        .collection('products')
        .doc(productId)
        .update({
        status,
        ...additionalData,
        updatedAt: new Date(),
    });
}
// ============================================
// Log Operations
// ============================================
/**
 * Add log entry
 */
async function addLogEntry(telegramId, type, title, message, metadata = {}, productId) {
    const logRef = await db.collection('users')
        .doc(telegramId.toString())
        .collection('logs')
        .add({
        userId: telegramId,
        type,
        title,
        message,
        metadata,
        productId,
        isRead: false,
        createdAt: new Date(),
    });
    return logRef.id;
}
/**
 * Get recent logs for user
 */
async function getUserLogs(telegramId, limit = 50) {
    const snapshot = await db.collection('users')
        .doc(telegramId.toString())
        .collection('logs')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
/**
 * Mark log as read
 */
async function markLogAsRead(telegramId, logId) {
    await db.collection('users')
        .doc(telegramId.toString())
        .collection('logs')
        .doc(logId)
        .update({ isRead: true });
}
/**
 * Reset daily triggered count (call at midnight)
 */
async function resetDailyTriggeredCounts() {
    const snapshot = await db.collection('users')
        .where('triggeredToday', '>', 0)
        .get();
    const batch = db.batch();
    for (const doc of snapshot.docs) {
        batch.update(doc.ref, { triggeredToday: 0 });
    }
    await batch.commit();
    console.log(`Reset triggered counts for ${snapshot.size} users`);
}
//# sourceMappingURL=firestore.js.map
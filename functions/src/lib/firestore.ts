// ============================================
// NeuroGUARDIAN — Firestore Helpers
// Database utilities
// ============================================

import * as admin from 'firebase-admin';
import { UserDoc, ProductDoc, LogEntryDoc, LogType, Marketplace } from '../schemas';

const db = admin.firestore();

// ============================================
// User Operations
// ============================================

/**
 * Get user by Telegram ID
 */
export async function getUser(telegramId: number): Promise<UserDoc | null> {
  const doc = await db.collection('users').doc(telegramId.toString()).get();
  return doc.exists ? (doc.data() as UserDoc) : null;
}

/**
 * Create or update user
 */
export async function upsertUser(telegramId: number, data: Partial<UserDoc>): Promise<void> {
  const docRef = db.collection('users').doc(telegramId.toString());
  const existing = await docRef.get();
  
  if (existing.exists) {
    await docRef.update({
      ...data,
      updatedAt: new Date(),
    });
  } else {
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
    } as UserDoc);
  }
}

/**
 * Get users with protection enabled (for Dispatcher)
 */
export async function getActiveProtectedUsers(): Promise<UserDoc[]> {
  const snapshot = await db.collection('users')
    .where('protectionEnabled', '==', true)
    .where('subscriptionActive', '==', true)
    .get();
  
  return snapshot.docs.map((doc) => doc.data() as UserDoc);
}

/**
 * Update user stats
 */
export async function updateUserStats(
  telegramId: number,
  updates: { triggeredToday?: number; savedAmount?: number; totalProducts?: number }
): Promise<void> {
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
export async function getUserProducts(
  telegramId: number,
  marketplace?: Marketplace
): Promise<ProductDoc[]> {
  let query = db.collection('users')
    .doc(telegramId.toString())
    .collection('products') as admin.firestore.Query;
  
  if (marketplace) {
    query = query.where('marketplace', '==', marketplace);
  }
  
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ProductDoc));
}

/**
 * Get products with monitoring enabled
 */
export async function getMonitoredProducts(
  telegramId: number,
  marketplace?: Marketplace
): Promise<ProductDoc[]> {
  let query = db.collection('users')
    .doc(telegramId.toString())
    .collection('products')
    .where('minPrice', '>', 0) as admin.firestore.Query;
  
  if (marketplace) {
    query = query.where('marketplace', '==', marketplace);
  }
  
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ProductDoc));
}

/**
 * Upsert product
 */
export async function upsertProduct(
  telegramId: number,
  productId: string,
  data: Omit<ProductDoc, 'id'>
): Promise<void> {
  await db.collection('users')
    .doc(telegramId.toString())
    .collection('products')
    .doc(productId)
    .set(data, { merge: true });
}

/**
 * Batch upsert products
 */
export async function batchUpsertProducts(
  telegramId: number,
  products: Array<Omit<ProductDoc, 'id'> & { productId: string }>
): Promise<void> {
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
export async function updateProductStatus(
  telegramId: number,
  productId: string,
  status: ProductDoc['status'],
  additionalData?: Partial<ProductDoc>
): Promise<void> {
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
export async function addLogEntry(
  telegramId: number,
  type: LogType,
  title: string,
  message: string,
  metadata: Record<string, unknown> = {},
  productId?: string
): Promise<string> {
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
    } as Omit<LogEntryDoc, 'id'>);
  
  return logRef.id;
}

/**
 * Get recent logs for user
 */
export async function getUserLogs(
  telegramId: number,
  limit: number = 50
): Promise<LogEntryDoc[]> {
  const snapshot = await db.collection('users')
    .doc(telegramId.toString())
    .collection('logs')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as LogEntryDoc));
}

/**
 * Mark log as read
 */
export async function markLogAsRead(telegramId: number, logId: string): Promise<void> {
  await db.collection('users')
    .doc(telegramId.toString())
    .collection('logs')
    .doc(logId)
    .update({ isRead: true });
}

/**
 * Reset daily triggered count (call at midnight)
 */
export async function resetDailyTriggeredCounts(): Promise<void> {
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

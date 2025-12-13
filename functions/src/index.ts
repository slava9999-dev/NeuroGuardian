// ============================================
// NeuroGUARDIAN — Cloud Functions Entry Point
// ============================================

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// Initialize Firebase Admin
admin.initializeApp();

// Import modules
import { 
  validateInitData, 
  parseAndValidateInitData,
  handlePaymentSuccess,
  handlePaymentFailure,
  handleRefund,
  validateCloudPaymentsSignature,
  checkSubscription,
  grantTrialSubscription,
} from './modules/gatekeeper';

import {
  storeApiKey,
  fetchWBCards,
  fetchOzonProducts,
  fetchOzonProductInfo,
  mapWBCardToProduct,
  mapOzonProductToProduct,
} from './modules/sync';

import {
  dispatch,
  processUser,
} from './modules/sentinel';

import {
  upsertUser,
  batchUpsertProducts,
  getUserProducts,
  resetDailyTriggeredCounts,
} from './lib/firestore';

import { WorkerTaskPayloadSchema } from './schemas';

const db = admin.firestore();

// ============================================
// AUTH ENDPOINTS
// ============================================

/**
 * Telegram WebApp authentication
 */
export const telegramAuth = functions.https.onRequest(async (req, res) => {
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
    const userData = parseAndValidateInitData(initData);
    if (!userData || !userData.user) {
      res.status(401).json({ error: 'Invalid initData' });
      return;
    }
    
    const tgUser = userData.user;
    
    // Create or update user
    await upsertUser(tgUser.id, {
      telegramId: tgUser.id,
      username: tgUser.username ?? null,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name ?? null,
      photoUrl: tgUser.photo_url ?? null,
      lastActiveAt: new Date(),
    });
    
    // Check subscription status
    const subscription = await checkSubscription(tgUser.id);
    
    // Get user data
    const userDoc = await db.collection('users').doc(tgUser.id.toString()).get();
    const user = userDoc.data();
    
    // Grant trial if first login
    if (user && !user.subscriptionPlan && !subscription.isActive) {
      await grantTrialSubscription(tgUser.id, 7);
    }
    
    res.json({
      success: true,
      user: {
        ...user,
        subscription,
      },
    });
  } catch (error: any) {
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
export const paymentWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }
  
  try {
    const signature = req.headers['content-hmac'] as string;
    const apiSecret = process.env.CLOUDPAYMENTS_API_SECRET || '';
    
    // Validate signature
    if (apiSecret && signature) {
      const isValid = validateCloudPaymentsSignature(
        JSON.stringify(req.body),
        signature,
        apiSecret
      );
      
      if (!isValid) {
        console.error('Invalid payment webhook signature');
        res.status(401).json({ code: 13 }); // CloudPayments error code
        return;
      }
    }
    
    const { OperationType, Status } = req.body;
    
    if (OperationType === 'Payment' && Status === 'Completed') {
      await handlePaymentSuccess(req.body);
    } else if (OperationType === 'Payment' && Status === 'Declined') {
      await handlePaymentFailure(req.body);
    } else if (OperationType === 'Refund') {
      await handleRefund(req.body);
    }
    
    res.json({ code: 0 }); // Success
  } catch (error: any) {
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
export const saveApiKey = functions.https.onRequest(async (req, res) => {
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
    if (!validateInitData(initData)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const userId = parseAndValidateInitData(initData)?.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    
    // Store API key in Secret Manager
    const keyRef = await storeApiKey(userId, marketplace, apiKey, clientId);
    
    // Update user with key reference
    await db.collection('users').doc(userId.toString()).update({
      [`${marketplace.toLowerCase()}KeyRef`]: keyRef,
      updatedAt: new Date(),
    });
    
    // Sync products
    let productsCount = 0;
    
    if (marketplace === 'WB') {
      const cards = await fetchWBCards({ apiKey, maxRetries: 3 });
      const products = cards.map(card => ({
        ...mapWBCardToProduct(card, userId),
        productId: `wb-${card.nmID}`,
      }));
      await batchUpsertProducts(userId, products);
      productsCount = products.length;
    } else if (marketplace === 'Ozon' && clientId) {
      const items = await fetchOzonProducts({ apiKey, clientId, maxRetries: 3 });
      const productIds = items.map(item => item.product_id);
      const infos = await fetchOzonProductInfo({ apiKey, clientId }, productIds);
      
      const products = items.map(item => {
        const info = infos.find(i => i.id === item.product_id) ?? null;
        return {
          ...mapOzonProductToProduct(item, info, userId),
          productId: `ozon-${item.product_id}`,
        };
      });
      await batchUpsertProducts(userId, products);
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
  } catch (error: any) {
    console.error('Save API key error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user's products
 */
export const getProducts = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const initData = req.headers.authorization?.replace('Bearer ', '');
    
    if (!initData || !validateInitData(initData)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const userId = parseAndValidateInitData(initData)?.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    
    const marketplace = req.query.marketplace as 'WB' | 'Ozon' | undefined;
    const products = await getUserProducts(userId, marketplace);
    
    res.json({
      success: true,
      products,
    });
  } catch (error: any) {
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
export const sentinelDispatcher = functions.pubsub
  .schedule('every 2 minutes')
  .onRun(async () => {
    console.log('Sentinel Dispatcher running...');
    const result = await dispatch();
    console.log('Dispatcher result:', result);
    return null;
  });

/**
 * Worker - triggered by Cloud Tasks
 */
export const sentinelWorker = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }
  
  try {
    // Parse and validate payload
    const payload = WorkerTaskPayloadSchema.parse(req.body);
    
    // Process user
    const result = await processUser(payload);
    
    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('Worker error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Daily reset - triggered at midnight
 */
export const dailyReset = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('Europe/Moscow')
  .onRun(async () => {
    console.log('Running daily reset...');
    await resetDailyTriggeredCounts();
    return null;
  });

// ============================================
// USER SETTINGS
// ============================================

/**
 * Update user settings (protection, defense mode, etc.)
 */
export const updateSettings = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const initData = req.headers.authorization?.replace('Bearer ', '');
    
    if (!initData || !validateInitData(initData)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const userId = parseAndValidateInitData(initData)?.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    
    const { protectionEnabled, defenseMode } = req.body;
    
    const updates: Record<string, any> = { updatedAt: new Date() };
    
    if (typeof protectionEnabled === 'boolean') {
      updates.protectionEnabled = protectionEnabled;
    }
    
    if (defenseMode === 'zero_stock' || defenseMode === 'price_correction') {
      updates.defenseMode = defenseMode;
    }
    
    await db.collection('users').doc(userId.toString()).update(updates);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update product minPrice
 */
export const updateMinPrice = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const initData = req.headers.authorization?.replace('Bearer ', '');
    
    if (!initData || !validateInitData(initData)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const userId = parseAndValidateInitData(initData)?.user?.id;
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
  } catch (error: any) {
    console.error('Update minPrice error:', error);
    res.status(500).json({ error: error.message });
  }
});

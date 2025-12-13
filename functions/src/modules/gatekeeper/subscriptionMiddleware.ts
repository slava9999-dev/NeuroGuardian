// ============================================
// NeuroGUARDIAN — Subscription Middleware
// Checks subscription status before API calls
// ============================================

import * as admin from 'firebase-admin';
import { UserDoc } from '../../schemas';

const db = admin.firestore();

export interface SubscriptionStatus {
  isActive: boolean;
  expiresAt: Date | null;
  plan: 'trial' | 'basic' | 'pro' | null;
  daysLeft: number | null;
}

/**
 * Check if user has active subscription
 */
export async function checkSubscription(telegramId: number): Promise<SubscriptionStatus> {
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
    
    const user = userDoc.data() as UserDoc;
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
  } catch (error) {
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
export async function requireSubscription(telegramId: number): Promise<UserDoc> {
  const userDoc = await db.collection('users').doc(telegramId.toString()).get();
  
  if (!userDoc.exists) {
    throw new Error('USER_NOT_FOUND');
  }
  
  const user = userDoc.data() as UserDoc;
  const status = await checkSubscription(telegramId);
  
  if (!status.isActive) {
    throw new Error('SUBSCRIPTION_EXPIRED');
  }
  
  return user;
}

/**
 * Grant trial subscription to new user
 */
export async function grantTrialSubscription(telegramId: number, days: number = 7): Promise<void> {
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
export async function extendSubscription(
  telegramId: number,
  plan: 'basic' | 'pro',
  days: number
): Promise<void> {
  const userDoc = await db.collection('users').doc(telegramId.toString()).get();
  
  if (!userDoc.exists) {
    throw new Error('USER_NOT_FOUND');
  }
  
  const user = userDoc.data() as UserDoc;
  const now = new Date();
  
  // Calculate new expiration: extend from current expiration if still active, otherwise from now
  let newExpiresAt: Date;
  if (user.subscriptionActive && user.subscriptionExpiresAt && user.subscriptionExpiresAt > now) {
    newExpiresAt = new Date(user.subscriptionExpiresAt);
  } else {
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
export async function cancelSubscription(telegramId: number): Promise<void> {
  await db.collection('users').doc(telegramId.toString()).update({
    subscriptionActive: false,
    updatedAt: new Date(),
  });
  
  console.log(`Cancelled subscription for user ${telegramId}`);
}

// ============================================
// NeuroGUARDIAN — Subscription Utilities
// Logic for handling subscription status and limits
// ============================================

import { TEST_MODE } from './constants.js';

/**
 * Check if user has active subscription
 * In TEST_MODE, always returns true (free Pro for everyone)
 */
export function isSubscriptionActive(user: any): boolean {
  // TEST MODE: everyone gets free access
  if (TEST_MODE) return true;

  if (!user?.subscription_end) return false;
  const endDate = new Date(user.subscription_end);
  return endDate > new Date();
}

/**
 * Get product limit based on subscription plan
 * In TEST_MODE, always returns Pro limit (500)
 */
export function getProductLimit(plan: string | null): number {
  // TEST MODE: everyone gets Pro limits
  if (TEST_MODE) return 500;

  switch (plan) {
    case 'pro':
    case 'yearly':
      return 500;
    case 'basic':
      return 50;
    case 'trial':
      return 20; // Trial users get limited access
    default:
      return 0;
  }
}

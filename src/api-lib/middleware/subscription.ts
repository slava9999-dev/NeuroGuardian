// NeuroGUARDIAN — Subscription Middleware
// Middleware to check subscription status and enforce limits

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SubscriptionService } from '../services/subscription-service.js';

/**
 * Middleware to check if user has active subscription
 * Returns 402 Payment Required if subscription is not active
 */
export async function requireActiveSubscription(
  _req: VercelRequest,
  res: VercelResponse,
  userId: string | number
): Promise<boolean> {
  try {
    const isActive = await SubscriptionService.isActive(userId);

    if (!isActive) {
      const subscription = await SubscriptionService.getSubscription(userId);

      res.status(402).json({
        error: 'Payment Required',
        message: 'Активная подписка необходима для этого действия',
        subscription_status: subscription?.status || 'none',
        trial_ended: subscription?.status === 'expired' && subscription?.trial_ends_at,
        upgrade_url: '/subscription',
      });

      return false;
    }

    return true;
  } catch (error) {
    console.error('Subscription check failed:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Не удалось проверить статус подписки',
    });
    return false;
  }
}

/**
 * Middleware to check subscription limits before adding resources
 */
export async function checkSubscriptionLimits(
  _req: VercelRequest,
  res: VercelResponse,
  userId: string | number,
  resourceType: 'product' | 'account'
): Promise<boolean> {
  try {
    const check = await SubscriptionService.checkSubscription(userId);

    if (!check.is_active) {
      res.status(402).json({
        error: 'Payment Required',
        message: 'Активная подписка необходима',
        upgrade_url: '/subscription',
      });
      return false;
    }

    if (resourceType === 'product' && !check.limits.can_add_product) {
      res.status(403).json({
        error: 'Limit Exceeded',
        message: `Достигнут лимит товаров для тарифа "${check.tier}" (${check.limits.max_products})`,
        current: check.limits.current_products,
        max: check.limits.max_products,
        upgrade_required: true,
        upgrade_url: '/subscription',
      });
      return false;
    }

    if (resourceType === 'account' && !check.limits.can_add_account) {
      res.status(403).json({
        error: 'Limit Exceeded',
        message: `Достигнут лимит магазинов для тарифа "${check.tier}" (${check.limits.max_accounts})`,
        current: check.limits.current_accounts,
        max: check.limits.max_accounts,
        upgrade_required: true,
        upgrade_url: '/subscription',
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error('Limit check failed:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Не удалось проверить лимиты подписки',
    });
    return false;
  }
}

/**
 * Get subscription info for response headers
 */
export async function getSubscriptionHeaders(
  userId: string | number
): Promise<Record<string, string>> {
  try {
    const check = await SubscriptionService.checkSubscription(userId);

    return {
      'X-Subscription-Status': check.status,
      'X-Subscription-Tier': check.tier,
      'X-Subscription-Active': check.is_active.toString(),
      'X-Subscription-Days-Remaining': check.days_remaining?.toString() || '0',
      'X-Subscription-Products-Limit': check.limits.max_products.toString(),
      'X-Subscription-Accounts-Limit': check.limits.max_accounts.toString(),
    };
  } catch (error) {
    console.error('Failed to get subscription headers:', error);
    return {};
  }
}

/**
 * Helper to add subscription info to API responses
 */
export async function enrichResponseWithSubscription(
  userId: string | number,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    const check = await SubscriptionService.checkSubscription(userId);

    return {
      ...data,
      subscription: {
        status: check.status,
        tier: check.tier,
        is_active: check.is_active,
        days_remaining: check.days_remaining,
        limits: check.limits,
        upgrade_required: check.upgrade_required,
        upgrade_reason: check.upgrade_reason,
      },
    };
  } catch (error) {
    console.error('Failed to enrich response:', error);
    return data;
  }
}

// NeuroGUARDIAN — Subscription Handlers
// API endpoints for subscription management

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SubscriptionService } from '../services/subscription-service.js';
import type {
  UpgradeSubscriptionRequest,
  CancelSubscriptionRequest,
} from '../types/subscription.js';

/**
 * GET /api?action=subscription
 * Get current user's subscription info
 */
export async function handleGetSubscription(
  _req: VercelRequest,
  res: VercelResponse,
  userId: string | number
): Promise<void> {
  try {
    const check = await SubscriptionService.checkSubscription(userId);
    const tiers = await SubscriptionService.getAllTiers();

    res.status(200).json({
      success: true,
      subscription: check,
      available_tiers: tiers,
    });
  } catch (error) {
    console.error('Failed to get subscription:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Не удалось получить информацию о подписке',
    });
  }
}

/**
 * POST /api?action=upgrade-subscription
 * Upgrade to a paid tier
 */
export async function handleUpgradeSubscription(
  req: VercelRequest,
  res: VercelResponse,
  userId: string | number
): Promise<void> {
  try {
    const { new_tier, billing_period = 'monthly' } = req.body as UpgradeSubscriptionRequest;

    if (!new_tier) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Параметр new_tier обязателен',
      });
      return;
    }

    // Validate tier
    const tierConfig = await SubscriptionService.getTierConfig(new_tier);

    if (!tierConfig) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Неверный тариф: ${new_tier}`,
      });
      return;
    }

    // Check if downgrade
    const current = await SubscriptionService.getSubscription(userId);
    const tierOrder = { free: 0, basic: 1, pro: 2, business: 3 };

    if (current && tierOrder[new_tier] < tierOrder[current.tier]) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Понижение тарифа не поддерживается. Отмените текущую подписку.',
      });
      return;
    }

    // For now, just update the subscription
    // In production, this should create a payment first
    const subscription = await SubscriptionService.upgrade(userId, new_tier, billing_period);

    res.status(200).json({
      success: true,
      message: 'Подписка успешно обновлена',
      subscription,
      // TODO: Add payment_url when payment integration is ready
    });
  } catch (error) {
    console.error('Failed to upgrade subscription:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Не удалось обновить подписку',
    });
  }
}

/**
 * POST /api?action=cancel-subscription
 * Cancel subscription
 */
export async function handleCancelSubscription(
  req: VercelRequest,
  res: VercelResponse,
  userId: string | number
): Promise<void> {
  try {
    const { reason, cancel_immediately = false } = req.body as CancelSubscriptionRequest;

    const subscription = await SubscriptionService.cancel(userId, reason, cancel_immediately);

    res.status(200).json({
      success: true,
      message: cancel_immediately
        ? 'Подписка отменена немедленно'
        : 'Подписка будет отменена в конце текущего периода',
      subscription,
    });
  } catch (error) {
    console.error('Failed to cancel subscription:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Не удалось отменить подписку',
    });
  }
}

/**
 * GET /api?action=subscription-tiers
 * Get all available subscription tiers
 */
export async function handleGetTiers(_req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const tiers = await SubscriptionService.getAllTiers();

    res.status(200).json({
      success: true,
      tiers,
    });
  } catch (error) {
    console.error('Failed to get tiers:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Не удалось получить список тарифов',
    });
  }
}

/**
 * POST /api?action=check-limits
 * Check if user can add a resource (product or account)
 */
export async function handleCheckLimits(
  req: VercelRequest,
  res: VercelResponse,
  userId: string | number
): Promise<void> {
  try {
    const { resource_type } = req.body as { resource_type: 'product' | 'account' };

    if (!resource_type || !['product', 'account'].includes(resource_type)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Параметр resource_type должен быть "product" или "account"',
      });
      return;
    }

    const check = await SubscriptionService.checkSubscription(userId);

    const canAdd =
      resource_type === 'product' ? check.limits.can_add_product : check.limits.can_add_account;

    res.status(200).json({
      success: true,
      can_add: canAdd,
      limits: check.limits,
      upgrade_required: !canAdd,
      upgrade_reason: !canAdd
        ? resource_type === 'product'
          ? `Достигнут лимит товаров (${check.limits.max_products})`
          : `Достигнут лимит магазинов (${check.limits.max_accounts})`
        : undefined,
    });
  } catch (error) {
    console.error('Failed to check limits:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Не удалось проверить лимиты',
    });
  }
}

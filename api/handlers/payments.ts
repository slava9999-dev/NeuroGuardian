// ============================================
// NeuroGUARDIAN — Payments Handler
// YooKassa payment processing
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

// Import from modular library
import { SUBSCRIPTION_PLANS, type PlanId } from '../../src/api-lib/lib/index.js';
import {
  createYookassaPayment,
  activateSubscription,
  updateTransactionStatus,
  getUserById,
} from '../../src/api-lib/services/index.js';
import { sendTelegramNotification } from '../../src/api-lib/services/notifications.js';
import { getSecurityAgent } from '@neuroguardian/security-agent';

/**
 * Handle create-payment action
 */
export async function handleCreatePayment(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  const { planId } = req.body || {};

  if (!planId || !['basic', 'pro', 'yearly'].includes(planId)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const plan = SUBSCRIPTION_PLANS[planId as PlanId];
  if (!plan) {
    return res.status(400).json({ error: 'Plan not found' });
  }

  // Get user email if exists
  const user = await getUserById(userId);

  // PRODUCTION: YooKassa must be configured
  // PRODUCTION: YooKassa must be configured
  const agent = getSecurityAgent();
  if (!agent.isInitialized()) await agent.initialize();

  const SHOP_ID = (await agent.secrets.get({
    userId: 'system',
    key: 'yookassa_shop_id',
    purpose: 'payment_handler_check',
    ttl: 300
  })).value || process.env.YOOKASSA_SHOP_ID || '';

  const SECRET_KEY = (await agent.secrets.get({
    userId: 'system',
    key: 'yookassa_secret_key',
    purpose: 'payment_handler_check',
    ttl: 300
  })).value || process.env.YOOKASSA_SECRET_KEY || '';
  const IS_PRODUCTION =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  if (!SHOP_ID || !SECRET_KEY) {
    // In development, allow test mode
    if (!IS_PRODUCTION) {
      console.log('🧪 DEV MODE: Activating subscription without payment');
      await activateSubscription(userId, planId === 'yearly' ? 'pro' : planId, plan.durationDays);
      return res.json({
        success: true,
        testMode: true,
        message: `Тестовый режим: подписка ${plan.name} активирована на ${plan.durationDays} дней`,
        plan: {
          id: planId,
          name: plan.name,
          price: plan.price,
          durationDays: plan.durationDays,
        },
      });
    }

    // In production, payment system must be configured
    console.error('❌ PRODUCTION: YooKassa not configured!');
    return res.status(503).json({
      error: 'Платёжная система временно недоступна. Попробуйте позже.',
      code: 'PAYMENT_SYSTEM_UNAVAILABLE',
    });
  }

  const returnUrl =
    process.env.WEBAPP_URL ||
    `https://${process.env.VERCEL_URL}` ||
    'https://neuro-guardian.vercel.app';

  const result = await createYookassaPayment(
    userId,
    planId as PlanId,
    `${returnUrl}?payment_complete=true`,
    undefined // No email in current user schema
  );

  if (!result.success) {
    return res.status(500).json({ error: result.error || 'Payment creation failed' });
  }

  return res.json(result);
}

/**
 * Handle payment-webhook action (from YooKassa)
 */
export async function handlePaymentWebhook(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  // SECURITY: Verify webhook is from YooKassa IP addresses
  const clientIP =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    'unknown';

  const IS_PRODUCTION =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  // Strict IP Validation
  const isYookassaIp = (ip: string) => {
    if (ip === '77.75.156.11' || ip === '77.75.156.35') return true;
    if (ip.startsWith('2a02:5180:')) return true; // IPv6 check

    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return false;

    // 185.71.76.0/27 (0-31)
    if (parts[0] === 185 && parts[1] === 71 && parts[2] === 76 && parts[3] >= 0 && parts[3] <= 31)
      return true;
    // 185.71.77.0/27 (0-31)
    if (parts[0] === 185 && parts[1] === 71 && parts[2] === 77 && parts[3] >= 0 && parts[3] <= 31)
      return true;
    // 77.75.153.0/25 (0-127)
    if (parts[0] === 77 && parts[1] === 75 && parts[2] === 153 && parts[3] >= 0 && parts[3] <= 127)
      return true;
    // 77.75.154.128/25 (128-255)
    if (
      parts[0] === 77 &&
      parts[1] === 75 &&
      parts[2] === 154 &&
      parts[3] >= 128 &&
      parts[3] <= 255
    )
      return true;

    return false;
  };

  if (IS_PRODUCTION && !isYookassaIp(clientIP) && clientIP !== 'unknown') {
    console.error(`🚫 BLOCKED: Webhook from unauthorized IP: ${clientIP}`);
    return res.status(403).json({ error: 'Forbidden: Invalid source IP' });
  }

  const event = req.body;
  if (!event?.object?.id) return res.status(400).json({ error: 'Invalid payload' });

  const payment = event.object;
  const metadata = payment.metadata || {};
  const userId = parseInt(metadata.user_id, 10);
  const planId = metadata.plan_id;
  const referrerId = metadata.referrer_id ? parseInt(metadata.referrer_id, 10) : null;

  console.log(`💳 Payment webhook: status=${payment.status}, userId=${userId}, plan=${planId}`);

  if (payment.status === 'succeeded' && userId && planId) {
    const plan = SUBSCRIPTION_PLANS[planId as PlanId];
    if (plan) {
      const actualPlan = planId === 'yearly' ? 'pro' : planId;

      // CHECK REFERRAL ELIGIBILITY *BEFORE* UPDATING TRANSACTION
      // Because isFirstPayment checks for existing 'succeeded' transactions
      let isFirst = false;
      if (referrerId) {
        const { isFirstPayment } = await import('../../src/api-lib/services/index.js');
        isFirst = await isFirstPayment(userId);
      }

      // Activate subscription
      await activateSubscription(userId, actualPlan, plan.durationDays);

      // Update transaction status
      if (metadata.transaction_id) {
        await updateTransactionStatus(metadata.transaction_id, 'succeeded', payment.id);
      } else {
        await sql`
          UPDATE transactions SET status = 'succeeded', yookassa_payment_id = ${payment.id}, paid_at = CURRENT_TIMESTAMP
          WHERE user_id = ${userId} AND status = 'pending'
          ORDER BY created_at DESC LIMIT 1
        `;
      }

      // Apply referral bonus if eligible
      if (referrerId && isFirst) {
        const { applyReferralBonus } = await import('../../src/api-lib/services/index.js');
        await applyReferralBonus(referrerId, 500); // Standard 500 RUB bonus
        console.log(`🎁 Referral bonus applied to user ${referrerId}`);
      }

      // Send success notification
      await sendTelegramNotification(
        userId,
        `✅ <b>Оплата успешна!</b>\n\n` +
          `Подписка <b>${plan.name}</b> активирована.\n` +
          `📅 Срок действия: ${plan.durationDays} дней\n\n` +
          `🛡️ Защита ваших товаров уже работает!`
      );

      console.log(`✅ Subscription activated for user ${userId}: ${actualPlan}`);
      return res.json({ success: true });
    }
  } else if (payment.status === 'canceled' && userId) {
    if (metadata.transaction_id) {
      await updateTransactionStatus(metadata.transaction_id, 'canceled');
    }
    console.log(`❌ Payment canceled for user ${userId}`);
    return res.json({ success: true });
  }

  return res.json({ success: true, message: 'Event noted' });
}

// ============================================
// NeuroGUARDIAN — Payments Handler
// YooKassa payment processing
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import from modular library
import { SUBSCRIPTION_PLANS, type PlanId } from '../../src/api-lib/lib/index.js';
import {
  createYookassaPayment,
  isValidYookassaIP,
  activateSubscription,
  updateTransactionStatus,
  getUserById,
} from '../../src/api-lib/services/index.js';
import { sendTelegramNotification } from '../../src/api-lib/services/notifications.js';

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
  const returnUrl = process.env.WEBAPP_URL || 'https://neuro-guardian.vercel.app';

  const result = await createYookassaPayment(userId, planId as PlanId, returnUrl, user?.email);

  if (!result.success) {
    return res.status(500).json({ error: result.error || 'Payment creation failed' });
  }

  return res.json({
    success: true,
    paymentId: result.paymentId,
    confirmationToken: result.confirmationToken,
    confirmationUrl: result.confirmationUrl,
    transactionId: result.transactionId,
    plan: result.plan,
  });
}

/**
 * Handle payment-webhook action (from YooKassa)
 */
export async function handlePaymentWebhook(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  // Validate source IP
  const clientIP =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    'unknown';

  console.log(`🔔 Payment webhook from IP: ${clientIP}`);

  // In production, validate YooKassa IPs (temporarily disabled for debugging)
  // if (!isValidYookassaIP(clientIP)) {
  //   console.warn(`⚠️ Invalid webhook source IP: ${clientIP}`);
  //   return res.status(403).json({ error: 'Forbidden' });
  // }

  const { event, object } = req.body || {};

  if (!event || !object) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  console.log(`📬 Webhook event: ${event}, payment: ${object.id}, status: ${object.status}`);

  // Handle successful payment
  if (event === 'payment.succeeded' && object.status === 'succeeded') {
    const { metadata, payment_method } = object;

    if (!metadata?.user_id || !metadata?.plan_id) {
      console.error('❌ Missing metadata in payment');
      return res.status(400).json({ error: 'Missing metadata' });
    }

    const userId = parseInt(metadata.user_id, 10);
    const planId = metadata.plan_id as PlanId;
    const transactionId = metadata.transaction_id;

    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) {
      console.error(`❌ Invalid plan: ${planId}`);
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // Activate subscription
    await activateSubscription(userId, planId, plan.durationDays, payment_method?.id);

    // Update transaction
    if (transactionId) {
      await updateTransactionStatus(transactionId, 'succeeded', object.id);
    }

    // Send notification
    await sendTelegramNotification(
      userId,
      `🎉 Подписка активирована!\n\n` +
        `📦 Тариф: ${plan.name}\n` +
        `⏰ Срок: ${plan.durationDays} дней\n` +
        `💰 Сумма: ${object.amount?.value || plan.price}₽\n\n` +
        `Спасибо за доверие! Ваши товары под защитой.`
    );

    console.log(`✅ Subscription activated for user ${userId}: ${planId}`);
    return res.json({ success: true });
  }

  // Handle cancelled/failed payments
  if (event === 'payment.canceled' || object.status === 'canceled') {
    const { metadata } = object;
    if (metadata?.transaction_id) {
      await updateTransactionStatus(metadata.transaction_id, 'canceled');
    }
    console.log(`❌ Payment canceled: ${object.id}`);
    return res.json({ success: true });
  }

  return res.json({ success: true, message: 'Event noted' });
}

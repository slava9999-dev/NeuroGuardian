// ============================================
// NeuroGUARDIAN — Payments Handler
// YooKassa payment processing
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

// Import subscription service
import { SubscriptionService } from '../services/subscription-service.js';
import { sendTelegramNotification } from '../services/notifications.js';
import { logger } from '../lib/logger.js';

/**
 * Handle create-payment action
 */
export async function handleCreatePayment(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  try {
    const { tier, billing_period = 'monthly', return_url } = req.body || {};

    // Validate tier
    if (!tier || !['basic', 'pro', 'business'].includes(tier)) {
      return res.status(400).json({
        error: 'Invalid tier',
        message: 'Tier must be one of: basic, pro, business',
      });
    }

    // Validate billing period
    if (!['monthly', 'yearly'].includes(billing_period)) {
      return res.status(400).json({
        error: 'Invalid billing period',
        message: 'Billing period must be monthly or yearly',
      });
    }

    // Check if YooKassa is configured
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    const isProduction =
      process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

    if (!shopId || !secretKey) {
      // In development, allow test mode
      if (!isProduction) {
        logger.debug('DEV MODE: Creating test payment', { tier, userId });
        return res.json({
          success: true,
          testMode: true,
          payment_id: `test_${Date.now()}`,
          payment_url: `https://neuro-guardian.vercel.app/subscription/success?test=true`,
          amount: tier === 'basic' ? 999 : tier === 'pro' ? 2999 : 9999,
          currency: 'RUB',
          message: 'Тестовый режим: платёж создан',
        });
      }

      return res.status(503).json({
        error: 'Payment system unavailable',
        message: 'Платёжная система временно недоступна',
      });
    }

    // Create payment via YooKassa
    const { getYooKassaService } = await import('../services/yookassa-service.js');
    const yookassa = getYooKassaService();

    const payment = await yookassa.createPayment({
      tier,
      billing_period,
      return_url,
      userId,
    });

    // Record payment in database
    await sql`
      INSERT INTO payments (
        user_id, payment_id, amount, currency, status, provider, description
      ) VALUES (
        ${userId}, ${payment.payment_id}, ${payment.amount}, ${payment.currency},
        'pending', 'yookassa', ${`Подписка ${tier} - ${billing_period}`}
      )
    `;

    return res.json({
      success: true,
      ...payment,
    });
  } catch (error) {
    logger.error('Failed to create payment', error, { userId, tier: req.body?.tier });
    return res.status(500).json({
      error: 'Payment creation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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
    logger.warn('Payment webhook blocked - unauthorized IP', { clientIP });
    return res.status(403).json({ error: 'Forbidden: Invalid source IP' });
  }

  const event = req.body;
  if (!event?.object?.id) return res.status(400).json({ error: 'Invalid payload' });

  const webhookPayment = event.object;
  const paymentId = webhookPayment.id;

  logger.info('Payment webhook received', { paymentId, status: webhookPayment.status });

  // ============================================
  // 🔐 SECURITY: Verify payment via YooKassa API
  // Never trust webhook data alone - always verify!
  // ============================================

  let verifiedPayment;
  try {
    const { getYooKassaService } = await import('../services/yookassa-service.js');
    const yookassa = getYooKassaService();

    // Fetch REAL payment status from YooKassa API
    verifiedPayment = await yookassa.getPayment(paymentId);

    logger.info('Payment API verification completed', {
      paymentId,
      verifiedStatus: verifiedPayment.status,
    });

    // Compare webhook status with API status
    if (webhookPayment.status !== verifiedPayment.status) {
      logger.error('SECURITY ALERT: Webhook status mismatch', undefined, {
        webhookStatus: webhookPayment.status,
        apiStatus: verifiedPayment.status,
        paymentId,
        clientIP,
      });
      // Use verified status, not webhook status
    }
  } catch (verifyError) {
    logger.error('Payment verification failed', verifyError, { paymentId });
    // In production, reject unverifiable webhooks
    if (IS_PRODUCTION) {
      return res.status(500).json({
        error: 'Payment verification failed',
        message: 'Could not verify payment with YooKassa API',
      });
    }
    // In dev, fall back to webhook data with warning
    logger.warn('DEV MODE: Using unverified webhook data');
    verifiedPayment = webhookPayment;
  }

  // Use VERIFIED payment data
  const payment = verifiedPayment;
  const metadata = payment.metadata || {};
  const userId = parseInt(metadata.user_id, 10);
  const tier = metadata.tier;
  const billingPeriod = metadata.billing_period || 'monthly';

  logger.info('Processing verified payment', { status: payment.status, userId, tier });

  if (payment.status === 'succeeded' && userId && tier) {
    try {
      // Check if already processed (idempotency)
      const existingPayment = await sql`
        SELECT status FROM payments WHERE payment_id = ${paymentId}
      `;

      if (existingPayment.rows[0]?.status === 'succeeded') {
        logger.info('Payment already processed, skipping', { paymentId });
        return res.json({ success: true, message: 'Already processed' });
      }

      // Upgrade subscription to paid tier
      await SubscriptionService.upgrade(userId, tier, billingPeriod);

      // Record payment
      await SubscriptionService.recordPayment(
        userId,
        payment.id,
        parseFloat(payment.amount.value),
        'yookassa'
      );

      // Update payment status in database
      await sql`
        UPDATE payments 
        SET status = 'succeeded', paid_at = NOW(), updated_at = NOW()
        WHERE payment_id = ${payment.id}
      `;

      // Send success notification
      const tierNames: Record<string, string> = {
        basic: 'Базовый',
        pro: 'Профессиональный',
        business: 'Бизнес',
      };

      await sendTelegramNotification(
        userId,
        `✅ <b>Оплата успешна!</b>\n\n` +
          `Подписка <b>${tierNames[tier] || tier}</b> активирована.\n` +
          `📅 Период: ${billingPeriod === 'yearly' ? 'год' : 'месяц'}\n\n` +
          `🛡️ Защита ваших товаров уже работает!`
      );

      logger.info('Subscription activated', { userId, tier, billingPeriod });
      return res.json({ success: true });
    } catch (error) {
      logger.error('Failed to process payment webhook', error, { paymentId, userId });
      return res.status(500).json({ error: 'Failed to process payment' });
    }
  } else if (payment.status === 'canceled' && userId) {
    // Update payment status
    await sql`
      UPDATE payments 
      SET status = 'cancelled', updated_at = NOW()
      WHERE payment_id = ${payment.id}
    `;

    logger.info('Payment canceled', { userId, paymentId: payment.id });
    return res.json({ success: true });
  }

  return res.json({ success: true, message: 'Event noted' });
}

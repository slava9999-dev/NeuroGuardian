// ============================================
// NeuroGUARDIAN — YooKassa Webhook Handler
// POST /api/payment-webhook — Handle payment notifications
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPaymentStatus, SUBSCRIPTION_PLANS, PlanId } from './lib/yookassa';
import { 
  getTransactionByYookassaId, 
  updateTransactionStatus, 
  activateSubscription,
  createLog,
  getUserById 
} from './lib/db';
import { sendTelegramMessage } from './lib/telegram';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body;
    console.log('Webhook received:', JSON.stringify(event, null, 2));

    if (!event?.object?.id) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    const payment = event.object;
    const paymentId = payment.id;

    // Verify payment status via API
    const verifiedPayment = await getPaymentStatus(paymentId);
    if (!verifiedPayment) {
      console.error('Could not verify payment:', paymentId);
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    // Extract metadata
    const metadata = verifiedPayment.metadata || {};
    const userId = parseInt(metadata.user_id, 10);
    const planId = metadata.plan_id as PlanId;
    const transactionId = metadata.transaction_id;

    if (!userId || !planId) {
      console.error('Missing metadata:', metadata);
      return res.status(400).json({ error: 'Invalid payment metadata' });
    }

    // Handle different payment statuses
    switch (verifiedPayment.status) {
      case 'succeeded':
        await handlePaymentSuccess(userId, planId, paymentId, verifiedPayment);
        break;
      case 'canceled':
        await handlePaymentCanceled(userId, paymentId, transactionId);
        break;
      case 'waiting_for_capture':
        // Auto-capture is enabled, this shouldn't happen
        console.log('Payment waiting for capture:', paymentId);
        break;
      default:
        console.log('Unhandled payment status:', verifiedPayment.status);
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    // Return 200 anyway to prevent retries for now
    return res.status(200).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

async function handlePaymentSuccess(
  userId: number,
  planId: PlanId,
  paymentId: string,
  payment: any
): Promise<void> {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) {
    console.error('Invalid plan:', planId);
    return;
  }

  // Get saved payment method ID for auto-renewal
  const paymentMethodId = payment.payment_method?.saved 
    ? payment.payment_method.id 
    : null;

  // Activate subscription
  await activateSubscription(
    userId,
    planId === 'yearly' ? 'pro' : planId,
    plan.durationDays,
    paymentMethodId
  );

  // Update transaction status
  const transaction = await getTransactionByYookassaId(paymentId);
  if (transaction) {
    await updateTransactionStatus(
      transaction.id,
      'succeeded',
      paymentId,
      payment.payment_method?.type
    );
  }

  // Log the event
  await createLog({
    user_id: userId,
    type: 'payment_success',
    severity: 'info',
    title: 'Оплата успешна',
    message: `Подписка ${plan.name} активирована на ${plan.durationDays} дней`,
    transaction_id: transaction?.id,
    metadata: {
      plan_id: planId,
      amount: payment.amount?.value,
      payment_id: paymentId,
    },
  });

  // Send Telegram notification
  const user = await getUserById(userId);
  if (user) {
    await sendTelegramMessage(
      userId,
      `🎉 <b>Оплата прошла успешно!</b>\n\n` +
      `✅ Подписка: ${plan.name}\n` +
      `📅 Активна ${plan.durationDays} дней\n\n` +
      `Теперь ваши товары под защитой NeuroGUARDIAN! 🛡️`
    );
  }

  console.log(`✅ Subscription activated for user ${userId}: ${planId}`);
}

async function handlePaymentCanceled(
  userId: number,
  paymentId: string,
  transactionId?: string
): Promise<void> {
  if (transactionId) {
    await updateTransactionStatus(transactionId, 'canceled', paymentId);
  }

  await createLog({
    user_id: userId,
    type: 'payment_canceled',
    severity: 'warning',
    title: 'Платёж отменён',
    message: 'Платёж был отменён пользователем или банком',
    transaction_id: transactionId,
    metadata: { payment_id: paymentId },
  });

  console.log(`⚠️ Payment canceled for user ${userId}: ${paymentId}`);
}

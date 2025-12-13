// ============================================
// NeuroGUARDIAN — Payment Webhook Handler
// Handles T-Pay/CloudPayments webhooks
// ============================================

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { extendSubscription, cancelSubscription } from './subscriptionMiddleware';

const db = admin.firestore();

// Pricing configuration
export const PRICING = {
  basic: {
    monthly: { price: 990, days: 30 },
    quarterly: { price: 2490, days: 90 },
    yearly: { price: 7990, days: 365 },
  },
  pro: {
    monthly: { price: 1990, days: 30 },
    quarterly: { price: 4990, days: 90 },
    yearly: { price: 14990, days: 365 },
  },
} as const;

interface PaymentWebhookPayload {
  // CloudPayments specific fields
  TransactionId?: number;
  Amount?: number;
  Currency?: string;
  InvoiceId?: string;
  AccountId?: string; // Telegram user ID
  Status?: string;
  OperationType?: string;
  
  // Custom data
  Data?: string; // JSON with plan info
}

interface PaymentData {
  plan: 'basic' | 'pro';
  period: 'monthly' | 'quarterly' | 'yearly';
  telegramId: number;
}

/**
 * Validate CloudPayments webhook signature
 */
export function validateCloudPaymentsSignature(
  body: string,
  signature: string,
  apiSecret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', apiSecret)
      .update(body)
      .digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Error validating signature:', error);
    return false;
  }
}

/**
 * Handle successful payment webhook
 */
export async function handlePaymentSuccess(payload: PaymentWebhookPayload): Promise<void> {
  console.log('Processing payment success:', payload);
  
  // Parse custom data
  let paymentData: PaymentData;
  try {
    if (payload.Data) {
      paymentData = JSON.parse(payload.Data);
    } else if (payload.AccountId) {
      // Fallback: extract from AccountId
      paymentData = {
        telegramId: parseInt(payload.AccountId, 10),
        plan: 'basic',
        period: 'monthly',
      };
    } else {
      throw new Error('Missing payment data');
    }
  } catch (error) {
    console.error('Failed to parse payment data:', error);
    throw new Error('INVALID_PAYMENT_DATA');
  }
  
  // Get days for the plan/period
  const planConfig = PRICING[paymentData.plan]?.[paymentData.period];
  if (!planConfig) {
    throw new Error('INVALID_PLAN_OR_PERIOD');
  }
  
  // Extend subscription
  await extendSubscription(
    paymentData.telegramId,
    paymentData.plan,
    planConfig.days
  );
  
  // Log transaction
  await db.collection('transactions').add({
    telegramId: paymentData.telegramId,
    transactionId: payload.TransactionId,
    amount: payload.Amount,
    currency: payload.Currency || 'RUB',
    plan: paymentData.plan,
    period: paymentData.period,
    days: planConfig.days,
    status: 'completed',
    createdAt: new Date(),
  });
  
  console.log(`Payment processed successfully for user ${paymentData.telegramId}`);
}

/**
 * Handle payment failure webhook
 */
export async function handlePaymentFailure(payload: PaymentWebhookPayload): Promise<void> {
  console.log('Processing payment failure:', payload);
  
  // Log failed transaction
  await db.collection('transactions').add({
    transactionId: payload.TransactionId,
    amount: payload.Amount,
    status: 'failed',
    error: payload.Status,
    createdAt: new Date(),
  });
}

/**
 * Handle refund webhook
 */
export async function handleRefund(payload: PaymentWebhookPayload): Promise<void> {
  console.log('Processing refund:', payload);
  
  // Parse user ID from payload
  let telegramId: number | null = null;
  
  if (payload.Data) {
    try {
      const data = JSON.parse(payload.Data);
      telegramId = data.telegramId;
    } catch {
      // Try AccountId
    }
  }
  
  if (!telegramId && payload.AccountId) {
    telegramId = parseInt(payload.AccountId, 10);
  }
  
  if (!telegramId || isNaN(telegramId)) {
    console.error('Cannot determine user for refund');
    return;
  }
  
  // Cancel subscription
  await cancelSubscription(telegramId);
  
  // Log refund
  await db.collection('transactions').add({
    telegramId,
    transactionId: payload.TransactionId,
    amount: payload.Amount,
    status: 'refunded',
    createdAt: new Date(),
  });
  
  console.log(`Refund processed for user ${telegramId}`);
}

/**
 * Generate payment link for CloudPayments
 */
export function generatePaymentLink(
  telegramId: number,
  plan: 'basic' | 'pro',
  period: 'monthly' | 'quarterly' | 'yearly'
): string {
  const planConfig = PRICING[plan][period];
  
  const data: PaymentData = {
    telegramId,
    plan,
    period,
  };
  
  // CloudPayments widget URL parameters
  const params = new URLSearchParams({
    publicId: process.env.CLOUDPAYMENTS_PUBLIC_ID || '',
    description: `NeuroGUARDIAN ${plan === 'pro' ? 'Pro' : 'Basic'} - ${period}`,
    amount: planConfig.price.toString(),
    currency: 'RUB',
    accountId: telegramId.toString(),
    data: JSON.stringify(data),
  });
  
  return `https://widget.cloudpayments.ru/pay?${params.toString()}`;
}

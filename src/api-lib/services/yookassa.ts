// ============================================
// NeuroGUARDIAN — YooKassa Payment Service
// Payment processing via YooKassa API
// ============================================

import { v4 as uuidv4 } from 'uuid';
import { SUBSCRIPTION_PLANS, type PlanId } from '../lib/index.js';
import { createTransaction } from './database.js';

const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3';
// Helper to get secrets
import { getSecurityAgent } from '@neuroguardian/security-agent';

async function getYookassaSecrets() {
  const agent = getSecurityAgent();
  if (!agent.isInitialized()) await agent.initialize();

  const shopId =
    (
      await agent.secrets.get({
        userId: 'system',
        key: 'yookassa_shop_id',
        purpose: 'payment_processing',
        ttl: 300,
      })
    ).value ||
    process.env.YOOKASSA_SHOP_ID ||
    '';

  const secretKey =
    (
      await agent.secrets.get({
        userId: 'system',
        key: 'yookassa_secret_key',
        purpose: 'payment_processing',
        ttl: 300,
      })
    ).value ||
    process.env.YOOKASSA_SECRET_KEY ||
    '';

  return { shopId, secretKey };
}

export interface PaymentResult {
  success: boolean;
  error?: string;
  paymentId?: string;
  confirmationToken?: string;
  confirmationUrl?: string;
  transactionId?: string;
  plan?: {
    id: string;
    name: string;
    price: number;
    durationDays: number;
  };
}

export interface YookassaPayment {
  id: string;
  status: string;
  paid: boolean;
  amount: {
    value: string;
    currency: string;
  };
  confirmation?: {
    type: string;
    confirmation_token?: string;
    confirmation_url?: string;
    return_url?: string;
  };
  created_at: string;
  description?: string;
  metadata?: Record<string, string>;
  payment_method?: {
    type: string;
    id: string;
    saved: boolean;
    title?: string;
  };
  recipient?: {
    account_id: string;
    gateway_id: string;
  };
  refundable: boolean;
  test: boolean;
}

/**
 * Create YooKassa payment
 */
export async function createYookassaPayment(
  userId: number,
  planId: PlanId,
  returnUrl: string,
  userEmail?: string
): Promise<PaymentResult> {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) {
    return { success: false, error: 'Invalid plan' };
  }

  const { shopId: SHOP_ID, secretKey: SECRET_KEY } = await getYookassaSecrets();

  if (!SHOP_ID || !SECRET_KEY) {
    return { success: false, error: 'Payment system not configured' };
  }

  const auth = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString('base64');
  const idempotencyKey = uuidv4();
  const transactionId = uuidv4();

  // Email for receipt (54-ФЗ compliance)
  const receiptEmail = userEmail || `tg${userId}@neuroguardian.app`;
  console.log(`📧 Payment receipt email: ${receiptEmail}`);

  try {
    const response = await fetch(`${YOOKASSA_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
        'Idempotence-Key': idempotencyKey,
      },
      body: JSON.stringify({
        amount: { value: plan.price.toFixed(2), currency: 'RUB' },
        confirmation: { type: 'embedded', return_url: returnUrl },
        capture: true,
        description: `NeuroGUARDIAN: ${plan.name} (${plan.durationDays} дней) — защита маржи WB/Ozon`,
        metadata: {
          user_id: userId.toString(),
          plan_id: planId,
          transaction_id: transactionId,
        },
        save_payment_method: true,
        receipt: {
          customer: { email: receiptEmail },
          items: [
            {
              description: `Подписка NeuroGUARDIAN ${plan.name} (${plan.durationDays} дней)`,
              amount: { value: plan.price.toFixed(2), currency: 'RUB' },
              vat_code: 1, // НДС не облагается
              quantity: '1',
              payment_subject: 'service',
              payment_mode: 'full_payment',
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('YooKassa error:', errorText);
      return { success: false, error: 'Payment creation failed' };
    }

    const payment = (await response.json()) as YookassaPayment;

    // Create transaction record
    await createTransaction({
      id: transactionId,
      user_id: userId,
      yookassa_payment_id: payment.id,
      amount: plan.price,
      currency: 'RUB',
      status: 'pending',
      plan: planId,
    });

    return {
      success: true,
      paymentId: payment.id,
      confirmationToken: payment.confirmation?.confirmation_token,
      confirmationUrl: payment.confirmation?.confirmation_url,
      transactionId,
      plan: {
        id: planId,
        name: plan.name,
        price: plan.price,
        durationDays: plan.durationDays,
      },
    };
  } catch (error) {
    console.error('Payment creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get YooKassa payment status
 */
export async function getPaymentStatus(paymentId: string): Promise<{
  status: string;
  paid: boolean;
  metadata?: Record<string, string>;
} | null> {
  const { shopId: SHOP_ID, secretKey: SECRET_KEY } = await getYookassaSecrets();

  if (!SHOP_ID || !SECRET_KEY) {
    return null;
  }

  const auth = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString('base64');

  try {
    const response = await fetch(`${YOOKASSA_API_URL}/payments/${paymentId}`, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payment = (await response.json()) as YookassaPayment;
    return {
      status: payment.status,
      paid: payment.paid === true,
      metadata: payment.metadata,
    };
  } catch (error) {
    console.error('Get payment status error:', error);
    return null;
  }
}

/**
 * Validate YooKassa webhook IP
 */
export function isValidYookassaIP(ip: string): boolean {
  const YOOKASSA_IPS = [
    '185.71.76.0/27',
    '185.71.77.0/27',
    '77.75.153.0/25',
    '77.75.156.11',
    '77.75.156.35',
    '77.75.154.128/25',
    '2a02:5180::/32',
  ];

  // Simplified check - in production, use cidr matching
  return YOOKASSA_IPS.some(range => {
    if (range.includes('/')) {
      const [prefix] = range.split('/');
      return ip.startsWith(prefix.slice(0, -1));
    }
    return ip === range;
  });
}

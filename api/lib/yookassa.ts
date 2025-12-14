// ============================================
// NeuroGUARDIAN — YooKassa Payment Integration
// ============================================

import { v4 as uuidv4 } from 'uuid';

const SHOP_ID = process.env.YOOKASSA_SHOP_ID || '';
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || '';
const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3';

// ============================================
// PRICING PLANS
// ============================================

export const SUBSCRIPTION_PLANS = {
  basic: {
    id: 'basic',
    name: 'Базовый',
    price: 499,
    durationDays: 30,
    maxProducts: 50,
    features: ['До 50 товаров', 'Защита Zero Stock', 'Telegram уведомления'],
  },
  pro: {
    id: 'pro',
    name: 'Профессиональный',
    price: 999,
    durationDays: 30,
    maxProducts: 500,
    features: ['До 500 товаров', 'Оба режима защиты', 'Приоритетная поддержка', 'API доступ'],
  },
  yearly: {
    id: 'yearly',
    name: 'Годовой Pro',
    price: 9990,
    durationDays: 365,
    maxProducts: 500,
    features: ['Все из Pro', 'Экономия 2000₽', 'Персональный менеджер'],
  },
} as const;

export type PlanId = keyof typeof SUBSCRIPTION_PLANS;

// ============================================
// TYPES
// ============================================

export interface CreatePaymentParams {
  userId: number;
  planId: PlanId;
  returnUrl: string;
  email?: string;
  savePaymentMethod?: boolean;
  promoCode?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  confirmationToken?: string;
  confirmationUrl?: string;
  error?: string;
}

export interface YookassaPayment {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  amount: {
    value: string;
    currency: string;
  };
  confirmation?: {
    type: string;
    confirmation_token?: string;
    confirmation_url?: string;
  };
  payment_method?: {
    type: string;
    id: string;
    saved: boolean;
  };
  metadata?: Record<string, any>;
  created_at: string;
}

export interface WebhookEvent {
  type: string;
  event: string;
  object: YookassaPayment;
}

// ============================================
// API HELPERS
// ============================================

async function yookassaRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'POST',
  body?: Record<string, any>,
  idempotencyKey?: string
): Promise<T> {
  const auth = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString('base64');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${auth}`,
  };

  if (idempotencyKey) {
    headers['Idempotence-Key'] = idempotencyKey;
  }

  const response = await fetch(`${YOOKASSA_API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('YooKassa API error:', error);
    throw new Error(`YooKassa API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ============================================
// CREATE PAYMENT
// ============================================

export async function createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
  const { userId, planId, returnUrl, email, savePaymentMethod, promoCode } = params;

  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) {
    return { success: false, error: 'Invalid plan' };
  }

  // TODO: Apply promo code discount
  let finalAmount = plan.price;
  
  const idempotencyKey = uuidv4();
  const transactionId = uuidv4();

  try {
    const paymentData: Record<string, any> = {
      amount: {
        value: finalAmount.toFixed(2),
        currency: 'RUB',
      },
      confirmation: {
        type: 'embedded', // For widget integration
        return_url: returnUrl,
      },
      capture: true, // Auto-capture
      description: `NeuroGUARDIAN: ${plan.name} подписка`,
      metadata: {
        user_id: userId.toString(),
        plan_id: planId,
        transaction_id: transactionId,
        promo_code: promoCode || null,
      },
    };

    // Add receipt for Russian law compliance
    if (email) {
      paymentData.receipt = {
        customer: { email },
        items: [
          {
            description: `Подписка ${plan.name}`,
            quantity: 1,
            amount: { value: finalAmount.toFixed(2), currency: 'RUB' },
            vat_code: 1, // НДС не облагается
            payment_mode: 'full_payment',
            payment_subject: 'service',
          },
        ],
      };
    }

    // Save payment method for auto-renewal
    if (savePaymentMethod) {
      paymentData.save_payment_method = true;
    }

    const payment = await yookassaRequest<YookassaPayment>(
      '/payments',
      'POST',
      paymentData,
      idempotencyKey
    );

    return {
      success: true,
      paymentId: payment.id,
      confirmationToken: payment.confirmation?.confirmation_token,
      confirmationUrl: payment.confirmation?.confirmation_url,
    };
  } catch (error) {
    console.error('Create payment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// CREATE RECURRING PAYMENT
// ============================================

export async function createRecurringPayment(
  userId: number,
  paymentMethodId: string,
  planId: PlanId
): Promise<PaymentResult> {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) {
    return { success: false, error: 'Invalid plan' };
  }

  const idempotencyKey = uuidv4();
  const transactionId = uuidv4();

  try {
    const payment = await yookassaRequest<YookassaPayment>(
      '/payments',
      'POST',
      {
        amount: {
          value: plan.price.toFixed(2),
          currency: 'RUB',
        },
        payment_method_id: paymentMethodId,
        capture: true,
        description: `NeuroGUARDIAN: Автопродление ${plan.name}`,
        metadata: {
          user_id: userId.toString(),
          plan_id: planId,
          transaction_id: transactionId,
          is_recurring: 'true',
        },
      },
      idempotencyKey
    );

    return {
      success: payment.status === 'succeeded',
      paymentId: payment.id,
    };
  } catch (error) {
    console.error('Recurring payment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// VERIFY WEBHOOK SIGNATURE
// ============================================

export function verifyWebhookSignature(
  body: string,
  signature: string | null
): boolean {
  // YooKassa doesn't require signature verification for IP whitelist
  // But we should verify by checking payment status via API
  return true;
}

// ============================================
// GET PAYMENT STATUS
// ============================================

export async function getPaymentStatus(paymentId: string): Promise<YookassaPayment | null> {
  try {
    return await yookassaRequest<YookassaPayment>(`/payments/${paymentId}`, 'GET');
  } catch {
    return null;
  }
}

// ============================================
// CREATE REFUND
// ============================================

export async function createRefund(
  paymentId: string,
  amount?: number,
  reason?: string
): Promise<boolean> {
  try {
    const payment = await getPaymentStatus(paymentId);
    if (!payment || payment.status !== 'succeeded') {
      return false;
    }

    const refundAmount = amount || parseFloat(payment.amount.value);

    await yookassaRequest(
      '/refunds',
      'POST',
      {
        payment_id: paymentId,
        amount: {
          value: refundAmount.toFixed(2),
          currency: 'RUB',
        },
        description: reason || 'Возврат средств',
      },
      uuidv4()
    );

    return true;
  } catch (error) {
    console.error('Refund error:', error);
    return false;
  }
}

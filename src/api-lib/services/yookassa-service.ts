// NeuroGUARDIAN — YooKassa Service
// Integration with YooKassa payment gateway

import type { CreatePaymentRequest, CreatePaymentResponse } from '../types/subscription.js';

/**
 * YooKassa API Configuration
 */
interface YooKassaConfig {
  shopId: string;
  secretKey: string;
  returnUrl?: string;
}

/**
 * YooKassa Payment Object
 */
interface YooKassaPayment {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  amount: {
    value: string;
    currency: string;
  };
  description?: string;
  confirmation?: {
    type: 'redirect';
    confirmation_url: string;
  };
  metadata?: Record<string, unknown>;
  created_at: string;
  paid?: boolean;
}

/**
 * YooKassa Service
 * Handles payment creation and verification
 */
export class YooKassaService {
  private shopId: string;
  private secretKey: string;
  private baseUrl = 'https://api.yookassa.ru/v3';

  constructor(config: YooKassaConfig) {
    this.shopId = config.shopId;
    this.secretKey = config.secretKey;
  }

  /**
   * Create payment
   */
  async createPayment(
    request: CreatePaymentRequest & { userId: number }
  ): Promise<CreatePaymentResponse> {
    try {
      // Get tier price
      const amount = this.getTierPrice(request.tier, request.billing_period);

      // Generate idempotency key (unique per request)
      const idempotencyKey = `${request.userId}-${request.tier}-${Date.now()}`;

      // Create payment request
      const paymentRequest = {
        amount: {
          value: amount.toFixed(2),
          currency: 'RUB',
        },
        confirmation: {
          type: 'redirect',
          return_url:
            request.return_url || 'https://neuro-guardian.vercel.app/subscription/success',
        },
        capture: true, // Auto-capture payment
        description: `Подписка ${this.getTierName(request.tier)} - ${request.billing_period === 'yearly' ? 'годовая' : 'месячная'}`,
        metadata: {
          user_id: request.userId,
          tier: request.tier,
          billing_period: request.billing_period,
        },
        receipt: {
          customer: {
            email: 'user@neuroguardian.app', // Fallback email as we don't always have user email in Telegram
          },
          items: [
            {
              description: `Подписка ${this.getTierName(request.tier)}`,
              quantity: '1.00',
              amount: {
                value: amount.toFixed(2),
                currency: 'RUB',
              },
              vat_code: '1', // Без НДС (или 1 - 20%, зависит от СНО). Ставим 1 (Standard) или 2-6 если нужно.
              payment_mode: 'full_payment',
              payment_subject: 'service',
            },
          ],
        },
      };

      // Call YooKassa API
      const response = await fetch(`${this.baseUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': idempotencyKey,
          Authorization: `Basic ${Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64')}`,
        },
        body: JSON.stringify(paymentRequest),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`YooKassa API error: ${JSON.stringify(error)}`);
      }

      const payment: YooKassaPayment = await response.json();

      return {
        payment_id: payment.id,
        payment_url: payment.confirmation?.confirmation_url || '',
        amount,
        currency: 'RUB',
      };
    } catch (error) {
      console.error('Failed to create payment:', error);
      throw error;
    }
  }

  /**
   * Get payment status
   */
  async getPayment(paymentId: string): Promise<YooKassaPayment> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`YooKassa API error: ${JSON.stringify(error)}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get payment:', error);
      throw error;
    }
  }

  /**
   * Verify webhook authenticity
   *
   * IMPORTANT: YooKassa does NOT use cryptographic signatures for webhooks.
   * Their security model relies on:
   * 1. IP address whitelist (implemented in payments.ts)
   * 2. API verification - ALWAYS verify payment status via API before processing
   *
   * @see https://yookassa.ru/developers/using-api/webhooks
   * @deprecated Use API verification in handlePaymentWebhook instead
   */
  verifyWebhookSignature(_body: string, _signature: string): boolean {
    // YooKassa does not send signatures in webhooks
    // Security is enforced via:
    // 1. IP whitelist in handlePaymentWebhook
    // 2. API verification via getPayment() before processing
    console.warn(
      '⚠️ verifyWebhookSignature called but YooKassa uses IP + API verification, not signatures'
    );
    return true; // Always true - actual verification happens via getPayment() API call
  }

  /**
   * Get tier price
   */
  private getTierPrice(tier: string, billingPeriod: 'monthly' | 'yearly'): number {
    const prices: Record<string, { monthly: number; yearly: number }> = {
      free: { monthly: 0, yearly: 0 },
      basic: { monthly: 999, yearly: 9990 },
      pro: { monthly: 2999, yearly: 29990 },
      business: { monthly: 9999, yearly: 99990 },
    };

    return prices[tier]?.[billingPeriod] || 0;
  }

  /**
   * Get tier name in Russian
   */
  private getTierName(tier: string): string {
    const names: Record<string, string> = {
      free: 'Бесплатный',
      basic: 'Базовый',
      pro: 'Профессиональный',
      business: 'Бизнес',
    };

    return names[tier] || tier;
  }
}

/**
 * Get YooKassa service instance
 */
export function getYooKassaService(): YooKassaService {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    throw new Error('YooKassa credentials not configured');
  }

  return new YooKassaService({ shopId, secretKey });
}

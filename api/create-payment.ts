// ============================================
// NeuroGUARDIAN — Create Payment API Endpoint
// POST /api/create-payment — Create YooKassa payment
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateInitData, parseInitDataUnsafe } from './lib/telegram';
import { createPayment, SUBSCRIPTION_PLANS, PlanId } from './lib/yookassa';
import { createTransaction, getUserById } from './lib/db';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { initData, planId, email, savePaymentMethod, promoCode } = req.body;

    // Validate auth
    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    const parsed = isDev ? parseInitDataUnsafe(initData) : validateInitData(initData);

    if (!parsed || !parsed.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = parsed.user.id;

    // Validate plan
    if (!planId || !SUBSCRIPTION_PLANS[planId as PlanId]) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const plan = SUBSCRIPTION_PLANS[planId as PlanId];

    // Check if user exists
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Determine return URL
    const returnUrl = process.env.WEBAPP_URL || 
      `https://${process.env.VERCEL_URL}` || 
      'https://neuro-guardian.vercel.app';

    // Create payment
    const paymentResult = await createPayment({
      userId,
      planId: planId as PlanId,
      returnUrl: `${returnUrl}?payment_complete=true`,
      email,
      savePaymentMethod: savePaymentMethod ?? true,
      promoCode,
    });

    if (!paymentResult.success) {
      return res.status(500).json({ error: paymentResult.error || 'Payment creation failed' });
    }

    // Create transaction record in database
    const transactionId = uuidv4();
    await createTransaction({
      id: transactionId,
      user_id: userId,
      amount: plan.price,
      plan: planId as 'basic' | 'pro',
      description: `Подписка ${plan.name}`,
      promo_code: promoCode,
    });

    return res.status(200).json({
      success: true,
      paymentId: paymentResult.paymentId,
      confirmationToken: paymentResult.confirmationToken,
      confirmationUrl: paymentResult.confirmationUrl,
      transactionId,
      plan: {
        id: planId,
        name: plan.name,
        price: plan.price,
        durationDays: plan.durationDays,
      },
    });
  } catch (error) {
    console.error('Create payment error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

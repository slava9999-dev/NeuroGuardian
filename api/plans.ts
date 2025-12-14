// ============================================
// NeuroGUARDIAN — Subscription Plans API
// GET /api/plans — Get available subscription plans
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SUBSCRIPTION_PLANS } from './lib/yookassa';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Return plans
  const plans = Object.values(SUBSCRIPTION_PLANS).map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: plan.price,
    durationDays: plan.durationDays,
    maxProducts: plan.maxProducts,
    features: plan.features,
    pricePerMonth: plan.durationDays === 365 
      ? Math.round(plan.price / 12) 
      : plan.price,
    isPopular: plan.id === 'pro',
    isBestValue: plan.id === 'yearly',
  }));

  return res.status(200).json({
    success: true,
    plans,
  });
}

// ============================================
// NeuroGUARDIAN — Auth API Endpoint
// POST /api/auth — Telegram WebApp authentication
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateInitData, parseInitDataUnsafe } from './lib/telegram';
import { createUser, getUserById } from './lib/db';

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
    const { initData } = req.body;

    if (!initData) {
      return res.status(400).json({ error: 'Missing initData' });
    }

    // Validate initData (use unsafe parser in development)
    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    const parsed = isDev ? parseInitDataUnsafe(initData) : validateInitData(initData);

    if (!parsed || !parsed.user) {
      return res.status(401).json({ error: 'Invalid initData' });
    }

    const telegramUser = parsed.user;

    // Create or update user in database
    const user = await createUser({
      id: telegramUser.id,
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      photo_url: telegramUser.photo_url,
    });

    // Get full user data with subscription info
    const fullUser = await getUserById(telegramUser.id);

    // Calculate subscription status
    let subscriptionActive = false;
    let daysLeft = null;

    if (fullUser?.subscription_end) {
      const endDate = new Date(fullUser.subscription_end);
      const now = new Date();
      subscriptionActive = endDate > now;
      daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    return res.status(200).json({
      success: true,
      user: {
        telegramId: fullUser?.id,
        username: fullUser?.username,
        firstName: fullUser?.first_name,
        lastName: fullUser?.last_name,
        photoUrl: fullUser?.photo_url,
        subscriptionActive,
        subscriptionExpiresAt: fullUser?.subscription_end,
        subscriptionPlan: fullUser?.subscription_plan,
        subscriptionDaysLeft: daysLeft,
        protectionEnabled: fullUser?.protection_enabled || false,
        defenseMode: fullUser?.defense_mode || 'zero_stock',
        wbKeyRef: fullUser?.api_key_wb ? 'configured' : null,
        ozonKeyRef: fullUser?.api_key_ozon ? 'configured' : null,
        totalProducts: fullUser?.total_products || 0,
        triggeredToday: fullUser?.triggered_today || 0,
        savedAmount: Number(fullUser?.saved_amount) || 0,
      },
    });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

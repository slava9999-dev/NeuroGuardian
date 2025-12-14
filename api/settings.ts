// ============================================
// NeuroGUARDIAN — User Settings API Endpoint
// POST /api/settings — Update user settings
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateInitData, parseInitDataUnsafe } from './lib/telegram';
import { updateUser, setUserApiKey, getUserById } from './lib/db';

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
    const { initData, ...settings } = req.body;

    if (!initData) {
      return res.status(401).json({ error: 'Missing initData' });
    }

    // Validate auth
    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    const parsed = isDev ? parseInitDataUnsafe(initData) : validateInitData(initData);

    if (!parsed || !parsed.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = parsed.user.id;

    // Handle API key update separately
    if (settings.marketplace && settings.apiKey) {
      await setUserApiKey(
        userId,
        settings.marketplace,
        settings.apiKey,
        settings.clientId
      );

      return res.status(200).json({
        success: true,
        message: `${settings.marketplace} API ключ сохранён`,
      });
    }

    // Update other settings
    const allowedFields = ['protection_enabled', 'defense_mode', 'auto_renew'];
    const updates: Record<string, any> = {};

    for (const [key, value] of Object.entries(settings)) {
      // Convert camelCase to snake_case
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      
      if (allowedFields.includes(snakeKey) && value !== undefined) {
        updates[snakeKey] = value;
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateUser(userId, updates);
    }

    // Get updated user
    const user = await getUserById(userId);

    return res.status(200).json({
      success: true,
      user: user ? {
        protectionEnabled: user.protection_enabled,
        defenseMode: user.defense_mode,
        autoRenew: user.auto_renew,
        wbKeyRef: user.api_key_wb ? 'configured' : null,
        ozonKeyRef: user.api_key_ozon ? 'configured' : null,
      } : null,
    });
  } catch (error) {
    console.error('Settings error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

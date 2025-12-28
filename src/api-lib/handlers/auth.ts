// ============================================
// NeuroGUARDIAN — Auth Handler
// Telegram authentication and user management
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

// Import from modular library
import { SUBSCRIPTION_PLANS } from '../lib/index.js';

import { getUserById } from '../services/index.js';

/**
 * Handle authentication action
 */
/**
 * Handle authentication action (Synced with index.ts logic)
 */
export async function handleAuth(
  _req: VercelRequest,
  res: VercelResponse,
  initData: string
): Promise<VercelResponse> {
  const { validateTelegramInitData } = await import('../lib/index.js');
  const { createOrUpdateUser, getUserById } = await import('../services/index.js');

  const validation = validateTelegramInitData(initData);
  if (!validation.valid || !validation.user) {
    return res.status(401).json({
      error: validation.error || 'Invalid initData',
      code: 'AUTH_FAILED',
    });
  }

  const telegramUser = validation.user;

  // Create or update user in database
  await createOrUpdateUser(telegramUser);
  const fullUser = await getUserById(telegramUser.id);

  if (!fullUser) {
    return res.status(500).json({ error: 'Failed to create or fetch user' });
  }

  let subscriptionActive = false;
  let daysLeft: number | null = null;

  // Subscription logic from index.ts
  if (fullUser.subscription_end) {
    const endDate = new Date(fullUser.subscription_end);
    subscriptionActive = endDate > new Date();
    daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  // FAIL-SAFE: For Testing, ensure Trial is always active
  if (fullUser.subscription_plan === 'trial') {
    subscriptionActive = true;
    if (!daysLeft || daysLeft <= 0) daysLeft = 3;
  }

  // EMERGENCY FIX: Force subscription active if end date is in future
  if (fullUser.subscription_end) {
    const endDate = new Date(fullUser.subscription_end);
    if (endDate > new Date()) {
      subscriptionActive = true;
      daysLeft = Math.max(1, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }
  }

  // Prepare response (Strictly following index.ts structure for frontend compatibility)
  return res.json({
    success: true,
    user: {
      telegramId: fullUser.id,
      username: fullUser.username,
      firstName: fullUser.first_name,
      lastName: fullUser.last_name,
      photoUrl: fullUser.photo_url,
      subscriptionActive,
      subscriptionExpiresAt: fullUser.subscription_end,
      subscriptionPlan: fullUser.subscription_plan,
      subscriptionDaysLeft: daysLeft,
      protectionEnabled: fullUser.protection_enabled || false,
      defenseMode: fullUser.defense_mode || 'zero_stock',
      wbKeyRef: fullUser.api_key_wb ? 'configured' : null,
      ozonKeyRef: fullUser.api_key_ozon ? 'configured' : null,
      totalProducts: fullUser.total_products || 0,
      triggeredToday: fullUser.triggered_today || 0,
      savedAmount: Number(fullUser.saved_amount) || 0,
      priceBufferPercent: fullUser.price_buffer_percent ?? 5,
      warningThresholdPercent: fullUser.warning_threshold_percent ?? 10,
    },
  });
}

/**
 * Handle settings action (GET and POST)
 */
export async function handleSettings(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  // Import crypto for API key encryption/decryption
  const { encryptApiKey, decryptApiKey } = await import('../lib/crypto.js');

  if (req.method === 'GET') {
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      defenseMode: user.defense_mode || 'zero_stock',
      protectionEnabled: user.protection_enabled || false,
      hasWbApiKey: !!user.api_key_wb,
      hasOzonApiKey: !!user.api_key_ozon,
      hasOzonClientId: !!user.ozon_client_id,
    });
  }

  // POST: Update settings
  const body = req.body || {};
  const updates: string[] = [];

  if (body.defenseMode !== undefined) {
    const mode = ['zero_stock', 'price_correction'].includes(body.defenseMode)
      ? body.defenseMode
      : 'zero_stock';
    await sql`UPDATE users SET defense_mode = ${mode} WHERE id = ${userId}`;
    updates.push('defenseMode');
  }

  if (body.protectionEnabled !== undefined) {
    const enabled = body.protectionEnabled === true;

    if (enabled) {
      const user = await getUserById(userId);
      // Check for active subscription or trial
      const isTrial = user?.subscription_plan === 'trial';
      const isSubActive = user?.subscription_end
        ? new Date(user.subscription_end) > new Date()
        : false;

      if (!isSubActive && !isTrial) {
        return res.status(403).json({
          error: 'Для включения защиты требуется активная подписка',
          code: 'SUBSCRIPTION_REQUIRED',
        });
      }
    }

    await sql`UPDATE users SET protection_enabled = ${enabled} WHERE id = ${userId}`;
    updates.push('protectionEnabled');
  }

  // API Keys (encrypted)
  if (body.wbApiKey !== undefined) {
    const encrypted = body.wbApiKey ? encryptApiKey(body.wbApiKey) : null;
    await sql`UPDATE users SET api_key_wb = ${encrypted} WHERE id = ${userId}`;
    updates.push('wbApiKey');
  }

  // Legacy Ozon Key Storage (supports marketplace.ts getMarketplaceKeys)
  if (body.ozonApiKey !== undefined || body.ozonClientId !== undefined) {
    const user = await getUserById(userId);
    const currentClientId = body.ozonClientId || user?.ozon_client_id || '';
    const currentApiKey =
      body.ozonApiKey || (user?.api_key_ozon ? decryptApiKey(user.api_key_ozon) : '');

    // 1. Store separate Ozon Client ID (encrypted for safety)
    if (body.ozonClientId !== undefined) {
      const encryptedClient = body.ozonClientId ? encryptApiKey(body.ozonClientId) : null;
      await sql`UPDATE users SET ozon_client_id = ${encryptedClient} WHERE id = ${userId}`;
      updates.push('ozonClientId');
    }

    // 2. Store combined Key in legacy column if both parts are available
    if (currentClientId && (body.ozonApiKey || currentApiKey)) {
      const apiKeyToSave = body.ozonApiKey || currentApiKey;
      const combined = `${currentClientId}:${apiKeyToSave}`;
      const encryptedCombined = encryptApiKey(combined);
      await sql`UPDATE users SET api_key_ozon = ${encryptedCombined} WHERE id = ${userId}`;
      updates.push('ozonApiKey (legacy)');
    } else if (body.ozonApiKey) {
      // Just save API key if no client ID available (will be fixed on next update)
      const encrypted = encryptApiKey(body.ozonApiKey);
      await sql`UPDATE users SET api_key_ozon = ${encrypted} WHERE id = ${userId}`;
      updates.push('ozonApiKey');
    }
  }

  // Sentinel buffer settings
  if (body.priceBufferPercent !== undefined) {
    const buffer = Math.max(0, Math.min(30, Number(body.priceBufferPercent) || 5));
    await sql`UPDATE users SET price_buffer_percent = ${buffer} WHERE id = ${userId}`;
    updates.push('priceBufferPercent');
  }

  if (body.warningThresholdPercent !== undefined) {
    const threshold = Math.max(5, Math.min(25, Number(body.warningThresholdPercent) || 10));
    await sql`UPDATE users SET warning_threshold_percent = ${threshold} WHERE id = ${userId}`;
    updates.push('warningThresholdPercent');
  }

  return res.json({ success: true, updated: updates });
}

/**
 * Handle plans action (get subscription plans)
 */
export async function handlePlans(
  _req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  // Import isFirstPayment from database
  const { isFirstPayment } = await import('../services/database.js');

  const showDiscount = await isFirstPayment(userId);

  const plans = Object.entries(SUBSCRIPTION_PLANS).map(([id, plan]) => ({
    id,
    name: plan.name,
    price: plan.price,
    discountedPrice: showDiscount ? plan.discountedPrice : plan.price,
    showDiscount: showDiscount && plan.discountedPrice < plan.price,
    durationDays: plan.durationDays,
    maxProducts: plan.maxProducts,
    features: plan.features,
    pricePerMonth: plan.durationDays === 365 ? Math.round(plan.price / 12) : plan.price,
    isPopular: id === 'pro',
    isBestValue: id === 'yearly',
  }));

  return res.json({ plans });
}

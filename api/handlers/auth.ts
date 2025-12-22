// ============================================
// NeuroGUARDIAN — Auth Handler
// Telegram authentication and user management
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

// Import from modular library
import {
  validateTelegramInitData,
  sanitizeInput,
  TEST_MODE,
  SUBSCRIPTION_PLANS,
  type TelegramUser,
  type PlanId,
} from '../../src/api-lib/lib/index.js';

import { createOrUpdateUser, getUserById } from '../../src/api-lib/services/index.js';

/**
 * Handle authentication action
 */
export async function handleAuth(
  req: VercelRequest,
  res: VercelResponse,
  initData: string
): Promise<VercelResponse> {
  const validation = validateTelegramInitData(initData);

  if (!validation.valid || !validation.user) {
    return res.status(401).json({ error: validation.error || 'Authentication failed' });
  }

  const tgUser = validation.user;

  // Create or update user in database
  const dbUser = await createOrUpdateUser(tgUser);

  // Check subscription status
  let subscriptionActive = dbUser?.subscription_active || false;
  let subscriptionPlan = dbUser?.subscription_plan || 'trial';
  let subscriptionEnd = dbUser?.subscription_end;

  // TEST MODE: Override subscription
  if (TEST_MODE) {
    subscriptionActive = true;
    subscriptionPlan = 'pro';
    subscriptionEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  }

  // Get product count
  const productsResult =
    await sql`SELECT COUNT(*) as count FROM products WHERE user_id = ${tgUser.id}`;
  const totalProducts = Number(productsResult.rows[0]?.count || 0);

  return res.json({
    user: {
      id: tgUser.id,
      firstName: sanitizeInput(tgUser.first_name),
      lastName: tgUser.last_name ? sanitizeInput(tgUser.last_name) : undefined,
      username: tgUser.username ? sanitizeInput(tgUser.username) : undefined,
      photoUrl: tgUser.photo_url,
    },
    subscription: {
      active: subscriptionActive,
      plan: subscriptionPlan,
      expiresAt: subscriptionEnd,
    },
    settings: {
      defenseMode: dbUser?.defense_mode || 'zero_stock',
      protectionEnabled: dbUser?.protection_enabled || false,
      hasWbApiKey: !!dbUser?.api_key_wb,
      hasOzonApiKey: !!dbUser?.api_key_ozon,
    },
    stats: {
      totalProducts,
      protectedProducts: 0, // Will be calculated
      triggeredToday: dbUser?.triggered_today || 0,
      savedAmount: Number(dbUser?.saved_amount || 0),
    },
    referral: {
      code: dbUser?.referral_code || `NG${tgUser.id.toString(36).toUpperCase()}`,
      referredBy: dbUser?.referred_by || null,
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
  // Import crypto for API key encryption
  const { encryptApiKey } = await import('../../src/api-lib/lib/crypto.js');

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
    await sql`UPDATE users SET protection_enabled = ${enabled} WHERE id = ${userId}`;
    updates.push('protectionEnabled');
  }

  // API Keys (encrypted)
  if (body.wbApiKey !== undefined) {
    const encrypted = body.wbApiKey ? encryptApiKey(body.wbApiKey) : null;
    await sql`UPDATE users SET api_key_wb = ${encrypted} WHERE id = ${userId}`;
    updates.push('wbApiKey');
  }

  if (body.ozonApiKey !== undefined) {
    const encrypted = body.ozonApiKey ? encryptApiKey(body.ozonApiKey) : null;
    await sql`UPDATE users SET api_key_ozon = ${encrypted} WHERE id = ${userId}`;
    updates.push('ozonApiKey');
  }

  if (body.ozonClientId !== undefined) {
    await sql`UPDATE users SET ozon_client_id = ${body.ozonClientId || null} WHERE id = ${userId}`;
    updates.push('ozonClientId');
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
  const { isFirstPayment } = await import('../../src/api-lib/services/database.js');

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
  }));

  return res.json({ plans });
}

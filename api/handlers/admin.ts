// ============================================
// NeuroGUARDIAN — Admin Handler
// Admin-only operations
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

import { getUserById, initializeDatabase } from '../../src/api-lib/services/index.js';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

/**
 * Validate admin access
 */
export function validateAdminAccess(req: VercelRequest): boolean {
  const adminKey = req.headers['x-admin-key'] as string;
  return !!ADMIN_API_KEY && adminKey === ADMIN_API_KEY;
}

/**
 * Handle init-db action
 */
export async function handleInitDb(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!validateAdminAccess(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  await initializeDatabase();

  return res.json({ success: true, message: 'Database initialized' });
}

/**
 * Handle reset-db action (dangerous!)
 */
export async function handleResetDb(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!validateAdminAccess(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // This is intentionally verbose and requires explicit confirmation
  const { confirm } = req.body || {};
  if (confirm !== 'RESET_ALL_DATA') {
    return res.status(400).json({
      error: 'Confirmation required',
      message: 'Send { "confirm": "RESET_ALL_DATA" } to proceed',
    });
  }

  await sql`DROP TABLE IF EXISTS sentinel_logs CASCADE`;
  await sql`DROP TABLE IF EXISTS transactions CASCADE`;
  await sql`DROP TABLE IF EXISTS products CASCADE`;
  await sql`DROP TABLE IF EXISTS users CASCADE`;

  await initializeDatabase();

  return res.json({ success: true, message: 'Database reset complete' });
}

/**
 * Handle admin-activate-trial action
 */
export async function handleAdminActivateTrial(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!validateAdminAccess(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { userId, days = 30 } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  await sql`
    UPDATE users SET
      subscription_plan = 'pro',
      subscription_end = ${endDate.toISOString()},
      subscription_active = true
    WHERE id = ${userId}
  `;

  return res.json({
    success: true,
    userId,
    plan: 'pro',
    expiresAt: endDate.toISOString(),
  });
}

/**
 * Handle admin-check-user action
 */
export async function handleAdminCheckUser(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!validateAdminAccess(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const userId = req.query.userId || req.body?.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  const user = await getUserById(Number(userId));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Get products count
  const products = await sql`SELECT COUNT(*) as count FROM products WHERE user_id = ${user.id}`;

  return res.json({
    user: {
      id: user.id,
      username: user.username,
      firstName: user.first_name,
      subscriptionPlan: user.subscription_plan,
      subscriptionActive: user.subscription_active,
      subscriptionEnd: user.subscription_end,
      protectionEnabled: user.protection_enabled,
      defenseMode: user.defense_mode,
      hasWbKey: !!user.api_key_wb,
      hasOzonKey: !!user.api_key_ozon,
      createdAt: user.created_at,
    },
    stats: {
      totalProducts: Number(products.rows[0]?.count || 0),
      triggeredToday: user.triggered_today || 0,
      savedAmount: Number(user.saved_amount || 0),
    },
  });
}

/**
 * Handle admin-list-users action
 */
export async function handleAdminListUsers(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!validateAdminAccess(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const result = await sql`
    SELECT id, username, first_name, subscription_plan, subscription_active, 
           subscription_end, protection_enabled, total_products, created_at
    FROM users 
    ORDER BY created_at DESC 
    LIMIT ${limit}
  `;

  return res.json({
    users: result.rows,
    total: result.rows.length,
  });
}

/**
 * Handle admin-list-products action
 */
export async function handleAdminListProducts(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!validateAdminAccess(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const userId = req.query.userId || req.body?.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  const result = await sql`
    SELECT product_id, title, current_price, min_price, current_stock, marketplace
    FROM products
    WHERE user_id = ${Number(userId)}
    ORDER BY created_at DESC
    LIMIT 100
  `;

  return res.json({
    products: result.rows,
    total: result.rows.length,
  });
}

/**
 * Handle sentinel-logs action (User-facing with summary)
 */
export async function handleSentinelLogs(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  const days = parseInt((req.query.days as string) || '7', 10);
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);

  try {
    // Fetch logs
    const logsResult = await sql`
      SELECT * FROM sentinel_logs 
      WHERE user_id = ${userId}
      AND created_at > NOW() - INTERVAL '1 day' * ${days}
      ORDER BY created_at DESC 
      LIMIT ${limit}
    `;

    // Calculate summary stats
    const summaryResult = await sql`
      SELECT 
        COUNT(*) as total_triggers,
        COALESCE(SUM(saved_amount), 0) as total_saved,
        COUNT(DISTINCT product_id) as unique_products
      FROM sentinel_logs 
      WHERE user_id = ${userId}
      AND created_at > NOW() - INTERVAL '1 day' * ${days}
    `;

    const summary = summaryResult.rows[0] || {
      total_triggers: 0,
      total_saved: 0,
      unique_products: 0,
    };

    return res.json({
      success: true,
      period: `${days} days`,
      summary: {
        totalTriggers: parseInt(summary.total_triggers) || 0,
        totalSaved: parseInt(summary.total_saved) || 0,
        uniqueProducts: parseInt(summary.unique_products) || 0,
      },
      logs: logsResult.rows.map((log: any) => ({
        id: log.id,
        productId: log.product_id,
        productTitle: log.product_title,
        detectedPrice: log.detected_price,
        minPrice: log.min_price,
        defenseAction: log.defense_action,
        savedAmount: log.saved_amount,
        marketplace: log.marketplace,
        createdAt: log.created_at,
      })),
    });
  } catch (error: any) {
    console.error('Sentinel logs error:', error);
    return res.status(500).json({ error: 'Failed to fetch sentinel logs' });
  }
}

/**
 * Handle admin-sentinel-logs action (all users)
 */
export async function handleAdminSentinelLogs(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!validateAdminAccess(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

  const result = await sql`
    SELECT sl.*, u.username, u.first_name
    FROM sentinel_logs sl
    LEFT JOIN users u ON sl.user_id = u.id
    ORDER BY sl.created_at DESC
    LIMIT ${limit}
  `;

  return res.json({
    logs: result.rows,
    total: result.rows.length,
  });
}

/**
 * Handle health check
 */
export async function handleHealth(
  _req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  try {
    // Test database connection
    const dbResult = await sql`SELECT 1 as ok`;
    const dbOk = dbResult.rows[0]?.ok === 1;

    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbOk ? 'connected' : 'error',
      version: '2.6.0',
    });
  } catch (error) {
    return res.json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      database: 'error',
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Handle admin-set-protection action
 */
export async function handleAdminSetProtection(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!validateAdminAccess(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const userId = req.query.userId || req.body?.userId;
  const enabled = req.query.enabled === 'true' || req.body?.enabled === true;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  await sql`UPDATE users SET protection_enabled = ${enabled}, updated_at = CURRENT_TIMESTAMP WHERE id = ${Number(userId)}`;

  const result = await sql`SELECT protection_enabled FROM users WHERE id = ${Number(userId)}`;

  return res.json({
    success: true,
    userId: Number(userId),
    protection_enabled: result.rows[0]?.protection_enabled,
  });
}

/**
 * Handle admin-reset-statuses action
 */
export async function handleAdminResetStatuses(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!validateAdminAccess(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const userId = req.query.userId || req.body?.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  await sql`UPDATE products SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE user_id = ${Number(userId)}`;

  return res.json({ success: true, message: 'All products reset to ACTIVE status' });
}

/**
 * Handle admin-set-defense-mode action
 */
export async function handleAdminSetDefenseMode(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!validateAdminAccess(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const userId = req.query.userId || req.body?.userId;
  const mode = req.query.mode || req.body?.mode;

  if (!userId || !mode) {
    return res.status(400).json({ error: 'userId and mode required' });
  }

  await sql`UPDATE users SET defense_mode = ${mode as string}, updated_at = CURRENT_TIMESTAMP WHERE id = ${Number(userId)}`;

  const result = await sql`SELECT defense_mode FROM users WHERE id = ${Number(userId)}`;

  return res.json({
    success: true,
    userId: Number(userId),
    defense_mode: result.rows[0]?.defense_mode,
  });
}

/**
 * Handle admin-test-telegram action
 */
export async function handleAdminTestTelegram(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!validateAdminAccess(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const userId = req.query.userId || req.body?.userId;
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return res.status(500).json({ error: 'ENV: TELEGRAM_BOT_TOKEN missing on server' });
  }
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: userId,
        text: '🔔 <b>ТЕСТОВАЯ ПРОВЕРКА СВЯЗИ</b>\n\nЕсли вы это читаете, значит бот настроен верно!',
        parse_mode: 'HTML',
      }),
    });
    const tgData = await tgRes.json();
    return res.json({
      success: tgRes.ok,
      telegram_response: tgData,
      token_masked: token.substring(0, 5) + '...',
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Fetch Error', details: e.message });
  }
}

/**
 * Handle admin-test-ozon action
 */
export async function handleAdminTestOzon(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!validateAdminAccess(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { clientId, apiKey } = req.body || {};
  if (!clientId || !apiKey) {
    return res.status(400).json({ error: 'clientId and apiKey required' });
  }

  try {
    const response = await fetch('https://api-seller.ozon.ru/v3/product/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
      body: JSON.stringify({ filter: {}, last_id: '', limit: 5 }),
    });

    const data = await response.json();

    return res.json({
      status: response.status,
      ok: response.ok,
      itemsCount: data.result?.items?.length || 0,
      total: data.result?.total || 0,
      error: data.message || data.error || null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Handle admin-test-wb action
 */
export async function handleAdminTestWb(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!validateAdminAccess(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { apiKey } = req.body || {};
  if (!apiKey) {
    return res.status(400).json({ error: 'apiKey required' });
  }

  console.log('🔍 Testing WB API with key length:', apiKey.length);

  try {
    const response = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({
        settings: { cursor: { limit: 5 }, filter: { withPhoto: -1 } },
      }),
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { rawText: responseText.substring(0, 500) };
    }

    return res.json({
      status: response.status,
      ok: response.ok,
      cardsCount: data.cards?.length || 0,
      cursor: data.cursor || null,
      error: data.message || data.error || null,
      raw: data,
      hint:
        response.status === 401
          ? 'Ключ отклонён. Убедитесь что токен имеет права на Content API. Создайте новый токен в ЛК WB → Настройки → API.'
          : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message, type: 'fetch_error' });
  }
}

/**
 * Handle admin-clone-user action — clone data from one user to another
 */
export async function handleAdminCloneUser(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!validateAdminAccess(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const {
    fromUserId,
    toUserId,
    cloneProducts = true,
    cloneApiKeys = true,
    activateTrial = true,
    trialDays = 3,
  } = req.body || {};

  if (!fromUserId || !toUserId) {
    return res.status(400).json({ error: 'fromUserId and toUserId required' });
  }

  const results: string[] = [];

  // Clone API keys
  if (cloneApiKeys) {
    await sql`
      UPDATE users SET
        api_key_wb = (SELECT api_key_wb FROM users WHERE id = ${Number(fromUserId)}),
        api_key_ozon = (SELECT api_key_ozon FROM users WHERE id = ${Number(fromUserId)}),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${Number(toUserId)}
    `;
    results.push('API keys cloned');
  }

  // Activate trial
  if (activateTrial) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + trialDays);
    await sql`
      UPDATE users SET
        subscription_plan = 'trial',
        subscription_end = ${endDate.toISOString()},
        subscription_active = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${Number(toUserId)}
    `;
    results.push(`Trial activated for ${trialDays} days`);
  }

  // Clone products
  if (cloneProducts) {
    // Delete existing products for target user
    await sql`DELETE FROM products WHERE user_id = ${Number(toUserId)}`;

    // Copy products from source user
    await sql`
      INSERT INTO products (user_id, product_id, nm_id, title, image_url, current_price, min_price, current_stock, marketplace, status, is_monitored)
      SELECT ${Number(toUserId)}, product_id, nm_id, title, image_url, current_price, min_price, current_stock, marketplace, status, is_monitored
      FROM products WHERE user_id = ${Number(fromUserId)}
    `;

    // Update product count
    await sql`
      UPDATE users SET 
        total_products = (SELECT COUNT(*) FROM products WHERE user_id = ${Number(toUserId)})
      WHERE id = ${Number(toUserId)}
    `;
    results.push('Products cloned');
  }

  return res.json({
    success: true,
    message: `Cloned data from ${fromUserId} to ${toUserId}`,
    actions: results,
  });
}

/**
 * Handle send-reminders action (cron job)
 */
export async function handleSendReminders(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  // Allow Vercel Cron or manual Admin trigger
  const authHeader = req.headers['authorization'];
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = validateAdminAccess(req);
  const IS_PRODUCTION = process.env.NODE_ENV === 'production';

  if (!isCron && !isAdmin && IS_PRODUCTION) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('📧 Starting subscription expiry reminders...');

  // Get users with expiring subscriptions (3 days, 1 day, expired)
  const expiringUsers = await sql`
    SELECT id, first_name, subscription_end, subscription_plan
    FROM users
    WHERE subscription_end IS NOT NULL
    AND subscription_end > NOW() - INTERVAL '1 day'
    AND subscription_end < NOW() + INTERVAL '4 days'
  `;

  let sent = 0;
  let errors = 0;

  for (const user of expiringUsers.rows) {
    try {
      const endDate = new Date(user.subscription_end);
      const now = new Date();
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let message = '';
      if (daysLeft <= 0) {
        message = `⚠️ <b>Подписка закончилась</b>\n\nВаша подписка ${user.subscription_plan} истекла.\nПродлите подписку, чтобы защитить товары!`;
      } else if (daysLeft === 1) {
        message = `⏰ <b>Подписка заканчивается завтра!</b>\n\nОсталось менее 24 часов.\nПродлите сейчас, чтобы не потерять защиту.`;
      } else {
        message = `📅 <b>Напоминание</b>\n\nВаша подписка истекает через ${daysLeft} дня.\nНе забудьте продлить!`;
      }

      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (token) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: user.id,
            text: message,
            parse_mode: 'HTML',
          }),
        });
        sent++;
      }
    } catch (e) {
      console.error(`Failed to send reminder to user ${user.id}:`, e);
      errors++;
    }
  }

  console.log(`📧 Reminders complete: sent=${sent}, errors=${errors}`);

  return res.json({
    success: true,
    message: `Reminders sent: ${sent}, errors: ${errors}`,
    sent,
    errors,
  });
}

/**
 * Handle referral action — get user's referral info
 */
export async function handleReferral(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Import validation
  const { validateTelegramInitData, sanitizeInput } =
    await import('../../src/api-lib/lib/index.js');
  const { getUserById } = await import('../../src/api-lib/services/index.js');

  const initData = sanitizeInput(
    (req.headers['x-init-data'] as string) || req.body?.initData || ''
  );
  const validation = validateTelegramInitData(initData);

  if (!validation.valid || !validation.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dbUser = await getUserById(validation.user.id);
  if (!dbUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Count successful referrals
  const referralsResult = await sql`
    SELECT COUNT(*) as count FROM users 
    WHERE referred_by = ${dbUser.referral_code}
  `;
  const referralCount = parseInt(referralsResult.rows[0]?.count || '0', 10);

  // Generate referral link
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'NeuroGuardianBot';
  const referralLink = `https://t.me/${botUsername}?start=ref_${dbUser.referral_code}`;

  // Referral bonus config
  const REFERRAL_BONUS_DAYS = 7;
  const REFERRAL_DISCOUNT_PERCENT = 10;

  return res.json({
    success: true,
    referralCode: dbUser.referral_code,
    referralLink,
    referralCount,
    bonusDays: REFERRAL_BONUS_DAYS,
    discountPercent: REFERRAL_DISCOUNT_PERCENT,
  });
}

// ============================================
// NeuroGUARDIAN — Admin Handler
// Admin-only operations
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
// Imports removed

import { getUserById, initializeDatabase } from '../services/index.js';
import { getSecret } from '../lib/index.js';
import { verifyAdminAccessAsync } from '../middleware/auth.js';

/**
 * Helper to get Telegram secrets
 */
async function getTelegramSecrets() {
  const [token, username] = await Promise.all([
    getSecret('telegram_bot_token', 'telegram_api_call'),
    getSecret('telegram_bot_username', 'referral_link_generation'),
  ]);

  return {
    token: token || process.env.TELEGRAM_BOT_TOKEN,
    username: username || process.env.TELEGRAM_BOT_USERNAME || 'NeuroGuardianBot',
  };
}

/**
 * Helper to get Cron secrets
 */
async function getCronSecrets() {
  const cronSecret = await getSecret('cron_secret', 'cron_auth');
  return { cronSecret: cronSecret || process.env.CRON_SECRET };
}

/**
 * Validate admin access
 * @deprecated Use verifyAdminAccessAsync instead
 */
export const validateAdminAccess = verifyAdminAccessAsync;

/**
 * Handle init-db action
 */
export async function handleInitDb(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const isAdmin = await validateAdminAccess(req);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  await initializeDatabase();

  return res.json({ success: true, message: 'Database initialized' });
}

/**
 * Handle reset-db action (dangerous!)
 * SECURITY FIX (Dec 2024): Completely disabled in production
 * SECURITY ENHANCEMENT (Dec 2024): Added "Double-blind confirmation" and environment guards
 */
export async function handleResetDb(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown';

  // CRITICAL SECURITY: Block in production to prevent catastrophic data loss
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  if (isProduction) {
    console.error(
      `🚨 SECURITY ALERT: Database reset ATTEMPTED in PRODUCTION from IP: ${clientIp}!`
    );
    return res.status(403).json({
      error: 'Database reset is PERMANENTLY DISABLED in production',
      hint: 'This endpoint only works in development/staging environments',
    });
  }

  // SECONDARY GUARD: Explicitly enabled dangerous operations
  const dangerousOpsEnabled = await getSecret('dangerous_operations_enabled', 'feature_flag_check');

  if (dangerousOpsEnabled !== 'true' && process.env.DANGEROUS_OPERATIONS_ENABLED !== 'true') {
    console.warn(
      `🚨 SECURITY: Reset DB attempted but DANGEROUS_OPERATIONS_ENABLED is not true. IP: ${clientIp}`
    );
    return res.status(403).json({
      error: 'Dangerous operations are disabled',
      hint: 'Set DANGEROUS_OPERATIONS_ENABLED=true in environment variables to enable this',
    });
  }

  const isAdmin = await validateAdminAccess(req);
  if (!isAdmin) {
    console.warn(`🚨 SECURITY: Unauthorized Reset DB attempt from IP: ${clientIp}`);
    return res.status(403).json({ error: 'Admin access required' });
  }

  // DOUBLE-BLIND: Requires both the main admin key and a secondary secret key
  const { confirm, adminSecret } = req.body || {};
  const expectedSecret = await getSecret('admin_secret_key', 'db_reset_verification');

  if (!expectedSecret || adminSecret !== expectedSecret) {
    console.warn(
      `🚨 SECURITY: Reset DB attempted with invalid or missing adminSecret. IP: ${clientIp}`
    );
    return res.status(403).json({
      error: 'Secondary secret required',
      message: 'This dangerous operation requires an additional ADMIN_SECRET_KEY',
    });
  }

  if (confirm !== 'RESET_ALL_DATA') {
    return res.status(400).json({
      error: 'Confirmation required',
      message: 'Send { "confirm": "RESET_ALL_DATA", "adminSecret": "..." } to proceed',
    });
  }

  console.warn(`🔥 SECURITY: DATABASE RESET INITIATED by IP: ${clientIp}`);

  await sql`DROP TABLE IF EXISTS sentinel_logs CASCADE`;
  await sql`DROP TABLE IF EXISTS transactions CASCADE`;
  await sql`DROP TABLE IF EXISTS products CASCADE`;
  await sql`DROP TABLE IF EXISTS users CASCADE`;

  await initializeDatabase();

  return res.json({ success: true, message: 'Database reset complete' });
}

/**
 * Handle run-migration action - applies pending migrations
 */
export async function handleRunMigration(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!(await validateAdminAccess(req))) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const migrationId = req.query.migration || req.body?.migration || '008';
  const results: string[] = [];

  try {
    if (migrationId === '008' || migrationId === 'all') {
      // Migration 008: Add price buffer settings
      console.log('🔄 Applying migration 008: price_buffer_settings...');

      // Add columns to users table
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS price_buffer_percent INTEGER DEFAULT 5`;
      results.push('users.price_buffer_percent added');

      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS warning_threshold_percent INTEGER DEFAULT 10`;
      results.push('users.warning_threshold_percent added');

      // Add column to products table
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS card_discount_buffer INTEGER DEFAULT 0`;
      results.push('products.card_discount_buffer added');

      console.log('✅ Migration 008 complete');
    }

    return res.json({
      success: true,
      migration: migrationId,
      applied: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle admin-activate-trial action
 */
export async function handleAdminActivateTrial(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!(await validateAdminAccess(req))) {
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
  if (!(await validateAdminAccess(req))) {
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
  if (!(await validateAdminAccess(req))) {
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
  if (!(await validateAdminAccess(req))) {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  } catch (error) {
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
  if (!(await validateAdminAccess(req))) {
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
  if (!(await validateAdminAccess(req))) {
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
  if (!(await validateAdminAccess(req))) {
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
  if (!(await validateAdminAccess(req))) {
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
  if (!(await validateAdminAccess(req))) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const userId = req.query.userId || req.body?.userId;
  const { token } = await getTelegramSecrets();

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
    const tgData = (await tgRes.json()) as any;
    return res.json({
      success: tgRes.ok,
      telegram_response: tgData,
      token_masked: token.substring(0, 5) + '...',
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return res.status(500).json({ error: 'Fetch Error', details: errorMessage });
  }
}

/**
 * Handle admin-test-ozon action
 */
export async function handleAdminTestOzon(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!(await validateAdminAccess(req))) {
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

    const data = (await response.json()) as any;

    return res.json({
      status: response.status,
      ok: response.ok,
      itemsCount: data.result?.items?.length || 0,
      total: data.result?.total || 0,
      error: data.message || data.error || null,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: errorMessage });
  }
}

/**
 * Handle admin-test-wb action
 */
export async function handleAdminTestWb(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (!(await validateAdminAccess(req))) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { apiKey } = req.body || {};
  if (!apiKey) {
    return res.status(400).json({ error: 'apiKey required' });
  }

  // SECURITY: Never log API key details (removed length logging)

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
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: errorMessage, type: 'fetch_error' });
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

  if (!(await validateAdminAccess(req))) {
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
  const { cronSecret } = await getCronSecrets();
  const authHeader = req.headers['authorization'];
  const isCron = authHeader === `Bearer ${cronSecret}`;
  const isAdmin = await validateAdminAccess(req); // Ensure await
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
  const { token } = await getTelegramSecrets();

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
  const { validateTelegramInitData, sanitizeInput } = await import('../lib/index.js');
  const { getUserById } = await import('../services/index.js');

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
  const { username } = await getTelegramSecrets();
  const botUsername = username;
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

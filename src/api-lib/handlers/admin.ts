// ============================================
// NeuroGUARDIAN — Admin Handler
// Admin-only operations
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../services/database.js';
import { getUserById, initializeDatabase } from '../services/index.js';
import { getSecret, logger } from '../lib/index.js';
import { verifyAdminAccessAsync } from '../middleware/auth.js';
import type { SentinelLog } from '../lib/types.js';

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
    logger.error(`🚨 SECURITY ALERT: Database reset ATTEMPTED in PRODUCTION from IP: ${clientIp}!`);
    return res.status(403).json({
      error: 'Database reset is PERMANENTLY DISABLED in production',
      hint: 'This endpoint only works in development/staging environments',
    });
  }

  // SECONDARY GUARD: Explicitly enabled dangerous operations
  const dangerousOpsEnabled = await getSecret('dangerous_operations_enabled', 'feature_flag_check');

  if (dangerousOpsEnabled !== 'true' && process.env.DANGEROUS_OPERATIONS_ENABLED !== 'true') {
    logger.warn(
      `🚨 SECURITY: Reset DB attempted but DANGEROUS_OPERATIONS_ENABLED is not true. IP: ${clientIp}`
    );
    return res.status(403).json({
      error: 'Dangerous operations are disabled',
      hint: 'Set DANGEROUS_OPERATIONS_ENABLED=true in environment variables to enable this',
    });
  }

  const isAdmin = await validateAdminAccess(req);
  if (!isAdmin) {
    logger.warn(`🚨 SECURITY: Unauthorized Reset DB attempt from IP: ${clientIp}`);
    return res.status(403).json({ error: 'Admin access required' });
  }

  // DOUBLE-BLIND: Requires both the main admin key and a secondary secret key
  const { confirm, adminSecret } = req.body || {};
  const expectedSecret = await getSecret('admin_secret_key', 'db_reset_verification');

  if (!expectedSecret || adminSecret !== expectedSecret) {
    logger.warn(
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

  logger.warn(`🔥 SECURITY: DATABASE RESET INITIATED by IP: ${clientIp}`);

  await sql`DROP TABLE IF EXISTS sentinel_logs CASCADE`;
  await sql`DROP TABLE IF EXISTS transactions CASCADE`;
  await sql`DROP TABLE IF EXISTS usage_logs CASCADE`;
  await sql`DROP TABLE IF EXISTS subscriptions CASCADE`;
  await sql`DROP TABLE IF EXISTS subscription_plans CASCADE`;
  await sql`DROP TABLE IF EXISTS marketplace_orders CASCADE`;
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

    if (migrationId === '020' || migrationId === 'all') {
      // Migration 020: Buyer price estimation columns (Jan 2026)
      console.log('🔄 Applying migration 020: buyer price estimation...');

      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS estimated_buyer_price INTEGER`;
      results.push('products.estimated_buyer_price added');

      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS marketplace_discount_percent DECIMAL(5,2)`;
      results.push('products.marketplace_discount_percent added');

      console.log('✅ Migration 020 complete');
    }

    if (migrationId === '014' || migrationId === 'all') {
      // Migration 014: Price Rules
      console.log('🔄 Applying migration 014: price_rules table...');

      await sql`
        CREATE TABLE IF NOT EXISTS price_rules (
            id SERIAL PRIMARY KEY,
            product_id VARCHAR(100) NOT NULL,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            min_price DECIMAL(12, 2) NOT NULL,
            max_price DECIMAL(12, 2) NOT NULL,
            cost_price DECIMAL(12, 2),
            target_margin DECIMAL(5, 2) DEFAULT 20.00,
            min_margin DECIMAL(5, 2) DEFAULT 10.00,
            competitor_tracking BOOLEAN DEFAULT false,
            competitor_nmids TEXT,
            price_match_strategy VARCHAR(20) DEFAULT 'none',
            undercut_amount DECIMAL(5, 2) DEFAULT 1.00,
            undercut_type VARCHAR(10) DEFAULT 'percent',
            auto_adjust BOOLEAN DEFAULT false,
            auto_protect BOOLEAN DEFAULT true,
            notification_enabled BOOLEAN DEFAULT true,
            alert_threshold_percent DECIMAL(5, 2) DEFAULT 10.00,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT price_rules_product_unique UNIQUE(product_id),
            CONSTRAINT price_range_valid CHECK (min_price <= max_price),
            CONSTRAINT margin_valid CHECK (target_margin >= 0 AND target_margin <= 100),
            CONSTRAINT min_margin_valid CHECK (min_margin >= 0 AND min_margin <= target_margin)
        );
      `;
      results.push('Table price_rules created');

      // Indexes
      await sql`CREATE INDEX IF NOT EXISTS idx_price_rules_product ON price_rules(product_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_price_rules_user ON price_rules(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_price_rules_active ON price_rules(active) WHERE active = true`;

      console.log('✅ Migration 014 complete');
    }

    if (migrationId === '017' || migrationId === 'all') {
      // Migration 017: Subscriptions System
      console.log('🔄 Applying migration 017: subscriptions system...');

      // Create subscriptions table
      await sql`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status VARCHAR(20) NOT NULL DEFAULT 'trial',
          tier VARCHAR(20) NOT NULL DEFAULT 'free',
          trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
          current_period_start TIMESTAMP WITH TIME ZONE,
          current_period_end TIMESTAMP WITH TIME ZONE,
          next_billing_date TIMESTAMP WITH TIME ZONE,
          payment_method VARCHAR(50),
          last_payment_at TIMESTAMP WITH TIME ZONE,
          last_payment_amount DECIMAL(10, 2),
          max_products INTEGER DEFAULT 50,
          max_accounts INTEGER DEFAULT 1,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          cancelled_at TIMESTAMP WITH TIME ZONE,
          cancellation_reason TEXT,
          CONSTRAINT valid_status CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')),
          CONSTRAINT valid_tier CHECK (tier IN ('free', 'basic', 'pro', 'business')),
          CONSTRAINT one_subscription_per_user UNIQUE (user_id)
        )
      `;
      results.push('Table subscriptions created');

      // Create indexes
      await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier)`;
      results.push('Subscriptions indexes created');

      // Create payments table
      await sql`
        CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
          payment_id VARCHAR(255) UNIQUE NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'RUB',
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          provider VARCHAR(50) NOT NULL,
          provider_data JSONB,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          paid_at TIMESTAMP WITH TIME ZONE,
          CONSTRAINT valid_payment_status CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled', 'refunded'))
        )
      `;
      results.push('Table payments created');

      // Create payments indexes
      await sql`CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id)`;
      results.push('Payments indexes created');

      // Create subscription_tiers table
      await sql`
        CREATE TABLE IF NOT EXISTS subscription_tiers (
          tier VARCHAR(20) PRIMARY KEY,
          name_ru VARCHAR(100) NOT NULL,
          name_en VARCHAR(100) NOT NULL,
          price_monthly DECIMAL(10, 2) NOT NULL,
          price_yearly DECIMAL(10, 2),
          max_products INTEGER NOT NULL,
          max_accounts INTEGER NOT NULL,
          features JSONB NOT NULL DEFAULT '[]',
          display_order INTEGER NOT NULL DEFAULT 0,
          is_popular BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      results.push('Table subscription_tiers created');

      // Insert default tiers
      await sql`
        INSERT INTO subscription_tiers (tier, name_ru, name_en, price_monthly, price_yearly, max_products, max_accounts, features, display_order, is_popular) VALUES
        ('free', 'Бесплатный', 'Free', 0, 0, 10, 1, '["Базовый AI ассистент", "Мониторинг до 10 товаров", "1 магазин"]'::jsonb, 1, false),
        ('basic', 'Базовый', 'Basic', 999, 9990, 50, 1, '["Полный AI ассистент Viktor", "Защита цен 24/7", "Мониторинг до 50 товаров", "1 магазин", "Умные уведомления", "ABC анализ"]'::jsonb, 2, true),
        ('pro', 'Профессиональный', 'Pro', 2999, 29990, 500, 3, '["Всё из Базового", "До 500 товаров", "3 магазина", "Приоритетная поддержка", "Расширенная аналитика", "Прогнозы продаж"]'::jsonb, 3, false),
        ('business', 'Бизнес', 'Business', 9999, 99990, 999999, 10, '["Всё из Профессионального", "Безлимит товаров", "До 10 магазинов", "Персональный менеджер", "API доступ", "Кастомные интеграции"]'::jsonb, 4, false)
        ON CONFLICT (tier) DO NOTHING
      `;
      results.push('Default tiers inserted');

      console.log('✅ Migration 017 complete');
    }

    if (migrationId === '021' || migrationId === 'all') {
      // Migration 021: Gender personalization columns (Jan 2026)
      console.log('🔄 Applying migration 021: gender personalization...');

      await sql`ALTER TABLE user_state ADD COLUMN IF NOT EXISTS gender TEXT`;
      results.push('user_state.gender added');

      await sql`ALTER TABLE user_state ADD COLUMN IF NOT EXISTS user_name TEXT`;
      results.push('user_state.user_name added');

      console.log('✅ Migration 021 complete');
    }

    return res.json({
      success: true,
      migration: migrationId,
      applied: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Migration error:', error);
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
      logs: logsResult.rows.map((log: SentinelLog) => ({
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
    logger.error('Sentinel logs error:', error);
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

    // Get kernel health if available
    let kernelHealth: {
      status?: string;
      unhealthyCount?: number;
      degradedCount?: number;
    } | null = null;
    try {
      const { getKernelHealth, getKernelManifest } = await import('../../core/modules.js');
      kernelHealth = getKernelHealth();
      const manifest = getKernelManifest();

      return res.json({
        status: kernelHealth?.status || (dbOk ? 'ok' : 'degraded'),
        timestamp: new Date().toISOString(),
        database: dbOk ? 'connected' : 'error',
        version: '3.0.0',
        kernel: {
          initialized: manifest.kernel.initialized,
          modulesCount: manifest.modules.length,
          unhealthyModules: kernelHealth?.unhealthyCount || 0,
          degradedModules: kernelHealth?.degradedCount || 0,
        },
      });
    } catch {
      // Kernel not initialized yet - return basic health
      return res.json({
        status: dbOk ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        database: dbOk ? 'connected' : 'error',
        version: '3.0.0',
        kernel: { initialized: false },
      });
    }
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
  _req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const { notificationService } = await import('../services/notifications.js');
  const { getSecret } = await import('../lib/secrets-helper.js');

  const adminChatId = await getSecret('admin_chat_id');
  const botToken = await getSecret('telegram_bot_token');

  // 1. Diagnostic Data
  const envStatus = {
    ADMIN_CHAT_ID: adminChatId
      ? `${adminChatId.substring(0, 4)}... (Length: ${adminChatId.length})`
      : 'MISSING',
    TELEGRAM_BOT_TOKEN: botToken ? 'PRESENT' : 'MISSING',
  };

  try {
    // 2. Test Sentinel Alert Path
    const testMessage = `🛡️ *СТОРОЖ — Диагностика*\n\n✅ Тестовое сообщение (sentinel_alert)\n⏰ ${new Date().toLocaleTimeString()}\n\nЕсли вы видите это — путь "sendAlertToAdmin" исправен.`;

    console.log('[Debug] Sending diagnostic alert...', envStatus);

    const success = await notificationService.sendAlertToAdmin({
      type: 'sentinel_alert',
      message: testMessage,
      urgency: 'high',
    });

    // 3. RAW TEST (Bypass service, hit API directly to see error)
    let rawResult = null;
    let rawError: string | null = null;
    try {
      if (botToken && adminChatId) {
        // Use native fetch (Node 18+)
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminChatId,
            text: '🔍 Raw Test from Vercel',
          }),
        });
        rawResult = await resp.json();
      }
    } catch (e) {
      rawError = e instanceof Error ? e.message : String(e);
    }

    return res.json({
      success,
      env: envStatus,
      message: success ? 'Message sent successfully' : 'Failed to send message',
      rawTelegramResponse: rawResult,
      rawFetchError: rawError,
      timestamp: new Date().toLocaleString(),
    });
  } catch (error) {
    console.error('Test failed:', error);
    return res.status(500).json({
      success: false,
      env: envStatus,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
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

    const data = (await response.json()) as {
      result?: { items?: unknown[]; total?: number };
      message?: string;
      error?: string;
    };

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

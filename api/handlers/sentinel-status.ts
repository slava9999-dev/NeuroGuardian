// ============================================
// NeuroGUARDIAN — Sentinel Status Handler
// Real-time status for UI integration
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { createClient } from '@vercel/kv';
import { validateTelegramInitData } from '../../src/api-lib/lib/index.js';

// ============================================
// TYPES
// ============================================

interface SentinelStatus {
  is_active: boolean;
  last_check: string | null;
  next_check: string | null;
  violations_today: number;
  actions_today: number;
  saved_today: number;
  defense_mode: 'zero_stock' | 'price_correction';
  cron_interval_minutes: number;
}

interface DefenseLog {
  id: number;
  timestamp: string;
  product_id: string;
  product_title: string;
  detected_price: number;
  min_price: number;
  defense_action: string;
  saved_amount: number;
  marketplace: string;
  success: boolean;
}

// ============================================
// HELPER: Get KV Client
// ============================================

// Helper to get secrets
import { getSecurityAgent } from '@neuroguardian/security-agent';

async function getAuthSecrets() {
  const agent = getSecurityAgent();
  if (!agent.isInitialized()) await agent.initialize();

  const cronSecret = (await agent.secrets.get({
    userId: 'system',
    key: 'cron_secret',
    purpose: 'sentinel_status_cron_auth',
    ttl: 300
  })).value || process.env.CRON_SECRET;

  const adminApiKey = (await agent.secrets.get({
    userId: 'system',
    key: 'admin_api_key',
    purpose: 'sentinel_status_admin_auth',
    ttl: 300
  })).value || process.env.ADMIN_API_KEY;

  return { cronSecret, adminApiKey };
}

// Helper to get KV client with secrets
async function getKVClient() {
  const agent = getSecurityAgent();
  if (!agent.isInitialized()) await agent.initialize();

  const url = (await agent.secrets.get({
      userId: 'system',
      key: 'kv_rest_api_url',
      purpose: 'kv_client_init',
      ttl: 300
  })).value || process.env.KV_REST_API_URL;
  
  const token = (await agent.secrets.get({
      userId: 'system',
      key: 'kv_rest_api_token',
      purpose: 'kv_client_init',
      ttl: 300
  })).value || process.env.KV_REST_API_TOKEN;

  if (url && token) {
    return createClient({
      url,
      token,
    });
  }
  return null;
}

// ... existing code ...

// ============================================
// GET SENTINEL STATUS
// ============================================

export async function handleSentinelStatus(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  // Auth
  const initData = (req.headers['x-init-data'] as string) || req.body?.initData || '';
  const validation = validateTelegramInitData(initData);

  if (!validation.valid || !validation.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = validation.user.id;
  const kv = await getKVClient();

  try {
    // Get user settings
    const userRes = await sql`
      SELECT 
        protection_enabled, 
        defense_mode, 
        triggered_today, 
        saved_amount,
        subscription_active
      FROM users WHERE id = ${userId}
    `;

    if (userRes.rows.length === 0) {
      return res.json({
        is_active: false,
        last_check: null,
        next_check: null,
        violations_today: 0,
        actions_today: 0,
        saved_today: 0,
        defense_mode: 'zero_stock',
        cron_interval_minutes: 5,
      });
    }

    const user = userRes.rows[0];

    // Get last check time from KV
    let lastCheck: string | null = null;
    let nextCheck: string | null = null;

    if (kv) {
      const lastCheckTs = await kv.get(`sentinel:last_check:${userId}`);
      if (lastCheckTs) {
        lastCheck = lastCheckTs as string;
        // Calculate next check (5 min interval)
        const lastCheckDate = new Date(lastCheck);
        const nextCheckDate = new Date(lastCheckDate.getTime() + 5 * 60 * 1000);
        nextCheck = nextCheckDate.toISOString();
      }
    }

    // Get today's stats from sentinel_logs
    const logsRes = await sql`
      SELECT 
        COUNT(*) as violations,
        COALESCE(SUM(saved_amount), 0) as saved
      FROM sentinel_logs 
      WHERE user_id = ${userId}
      AND created_at >= CURRENT_DATE
    `;

    const stats = logsRes.rows[0] || { violations: 0, saved: 0 };

    const status: SentinelStatus = {
      is_active: user.protection_enabled && user.subscription_active,
      last_check: lastCheck,
      next_check: nextCheck,
      violations_today: parseInt(stats.violations) || 0,
      actions_today: user.triggered_today || 0,
      saved_today: parseFloat(stats.saved) || 0,
      defense_mode: user.defense_mode || 'zero_stock',
      cron_interval_minutes: 5,
    };

    return res.json(status);
  } catch (error) {
    console.error('Sentinel status error:', error);
    return res.status(500).json({ error: 'Failed to get sentinel status' });
  }
}


// ============================================
// GET DEFENSE HISTORY
// ============================================

export async function handleDefenseHistory(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  // Auth
  const initData = (req.headers['x-init-data'] as string) || req.body?.initData || '';
  const validation = validateTelegramInitData(initData);

  if (!validation.valid || !validation.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = validation.user.id;
  const limit = parseInt(req.query.limit as string) || 10;
  const marketplace = req.query.marketplace as string;

  try {
    let query;

    if (marketplace && ['WB', 'Ozon'].includes(marketplace)) {
      query = sql`
        SELECT 
          id, 
          created_at as timestamp,
          product_id,
          product_title,
          detected_price,
          min_price,
          defense_action,
          saved_amount,
          marketplace,
          COALESCE(success, true) as success
        FROM sentinel_logs 
        WHERE user_id = ${userId}
        AND marketplace = ${marketplace}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      query = sql`
        SELECT 
          id, 
          created_at as timestamp,
          product_id,
          product_title,
          detected_price,
          min_price,
          defense_action,
          saved_amount,
          marketplace,
          COALESCE(success, true) as success
        FROM sentinel_logs 
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    const result = await query;

    const logs: DefenseLog[] = result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      product_id: row.product_id,
      product_title: row.product_title,
      detected_price: row.detected_price,
      min_price: row.min_price,
      defense_action: row.defense_action,
      saved_amount: row.saved_amount,
      marketplace: row.marketplace,
      success: row.success,
    }));

    return res.json({ logs, total: logs.length });
  } catch (error) {
    console.error('Defense history error:', error);
    return res.status(500).json({ error: 'Failed to get defense history' });
  }
}

// ============================================
// TOGGLE PROTECTION
// ============================================

export async function handleToggleProtection(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
  const initData = (req.headers['x-init-data'] as string) || req.body?.initData || '';
  const validation = validateTelegramInitData(initData);

  if (!validation.valid || !validation.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = validation.user.id;
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Invalid enabled value' });
  }

  try {
    // Check subscription before enabling
    if (enabled) {
      const userRes = await sql`
        SELECT subscription_active FROM users WHERE id = ${userId}
      `;

      if (userRes.rows.length === 0 || !userRes.rows[0].subscription_active) {
        return res.status(403).json({
          error: 'Subscription required',
          code: 'SUBSCRIPTION_REQUIRED',
        });
      }
    }

    await sql`
      UPDATE users 
      SET protection_enabled = ${enabled}, updated_at = NOW()
      WHERE id = ${userId}
    `;

    console.log(`🛡️ Protection ${enabled ? 'enabled' : 'disabled'} for user ${userId}`);

    return res.json({
      success: true,
      protection_enabled: enabled,
    });
  } catch (error) {
    console.error('Toggle protection error:', error);
    return res.status(500).json({ error: 'Failed to toggle protection' });
  }
}

// ============================================
// UPDATE SENTINEL STATUS (for n8n)
// ============================================

export async function handleUpdateSentinelStatus(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: Only cron/admin
  const cronSecret = req.headers['x-cron-secret'] as string;
  const adminKey = req.headers['x-admin-key'] as string;
  const { cronSecret: secretCron, adminApiKey: secretAdmin } = await getAuthSecrets();

  if (cronSecret !== secretCron && adminKey !== secretAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { user_id, last_check, violations_found, actions_taken } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  const kv = await getKVClient();
  if (!kv) {
    return res.status(500).json({ error: 'KV not available' });
  }

  try {
    // Store last check time
    await kv.set(`sentinel:last_check:${user_id}`, last_check || new Date().toISOString(), {
      ex: 86400, // 24 hours TTL
    });

    // Update user stats
    if (violations_found > 0 || actions_taken > 0) {
      await sql`
        UPDATE users 
        SET 
          triggered_today = triggered_today + ${actions_taken || 0},
          updated_at = NOW()
        WHERE id = ${user_id}
      `;
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Update sentinel status error:', error);
    return res.status(500).json({ error: 'Failed to update status' });
  }
}

// ============================================
// LOG DEFENSE ACTION (for n8n)
// ============================================

export async function handleLogDefense(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: Only cron/admin
  const cronSecret = req.headers['x-cron-secret'] as string;
  const adminKey = req.headers['x-admin-key'] as string;
  const { cronSecret: secretCron, adminApiKey: secretAdmin } = await getAuthSecrets();

  if (cronSecret !== secretCron && adminKey !== secretAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { log_id, success, error } = req.body;

  if (!log_id) {
    return res.status(400).json({ error: 'log_id required' });
  }

  try {
    await sql`
      UPDATE sentinel_logs 
      SET 
        success = ${success},
        error_message = ${error || null},
        executed_at = NOW()
      WHERE id = ${log_id}
    `;

    return res.json({ success: true });
  } catch (err) {
    console.error('Log defense error:', err);
    return res.status(500).json({ error: 'Failed to log defense' });
  }
}

// ============================================
// BULK LOG DEFENSE (for n8n batch processing)
// ============================================

export async function handleBulkLogDefense(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: Only cron/admin
  const cronSecret = req.headers['x-cron-secret'] as string;
  const adminKey = req.headers['x-admin-key'] as string;
  const { cronSecret: secretCron, adminApiKey: secretAdmin } = await getAuthSecrets();

  if (cronSecret !== secretCron && adminKey !== secretAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { results } = req.body;

  if (!Array.isArray(results)) {
    return res.status(400).json({ error: 'results array required' });
  }

  try {
    let updated = 0;

    for (const result of results) {
      if (result.violation_id || result.log_id) {
        await sql`
          UPDATE sentinel_logs 
          SET 
            success = ${result.success},
            error_message = ${result.error || null},
            executed_at = NOW()
          WHERE id = ${result.violation_id || result.log_id}
        `;
        updated++;
      }
    }

    return res.json({ success: true, updated });
  } catch (error) {
    console.error('Bulk log defense error:', error);
    return res.status(500).json({ error: 'Failed to bulk log defense' });
  }
}

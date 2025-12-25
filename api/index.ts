// ============================================
// NeuroGUARDIAN — Unified API Handler
// All endpoints in one file (Vercel Hobby limit: 12 functions)
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================
// PHASE 2: MODULAR HANDLERS (gradual migration)
// ============================================

import {
  handleHealth,
  handleInitDb,
  handleResetDb,
  handleAdminActivateTrial,
  handleAdminCheckUser,
  handleAdminListUsers,
  handleAdminListProducts,
  handleSentinelLogs,
  handleAdminSentinelLogs,
  handleAdminSetProtection,
  handleAdminResetStatuses,
  handleAdminSetDefenseMode,
  handleAdminTestTelegram,
  handleAdminTestOzon,
  handleAdminTestWb,
  handleAdminCloneUser,
  handleSendReminders,
  handleReferral,
} from './handlers/admin.js';

import { handleAuth, handleSettings, handlePlans } from './handlers/auth.js';
import { handleProducts, handleSyncProducts, handleBatchSetStopLoss } from './handlers/products.js';
import { handleCreatePayment, handlePaymentWebhook } from './handlers/payments.js';
import { handleCheckPrices } from './handlers/sentinel.js';
import { handleAgent, handleAgentConfirm, handleAgentStatus } from './handlers/agent.js';

import {
  sanitizeInput,
  validateTelegramInitData,
  checkRateLimit,
  RATE_LIMIT,
  IS_PRODUCTION,
  ALLOWED_ORIGINS,
} from '../src/api-lib/lib/index.js';

// ============================================
// CORS HEADERS (Production-grade)
// ============================================

function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';

  // Check if origin is allowed
  const isAllowed =
    !IS_PRODUCTION ||
    ALLOWED_ORIGINS.some(allowed => allowed && (origin === allowed || origin.startsWith(allowed)));

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (!IS_PRODUCTION) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Init-Data, X-Admin-Key'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24h

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, query, body } = req;
  const sanitizeBodyForLog = (body: any) => {
    if (!body) return {};
    const clone = { ...body };
    if (clone.initData) clone.initData = '***REDACTED***';
    if (clone.password) clone.password = '***REDACTED***';
    return clone;
  };

  console.log(
    `📥 API Request: ${method} action=${query.action || body?.action}`,
    JSON.stringify(sanitizeBodyForLog(body)).substring(0, 200)
  );

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  setCorsHeaders(req, res);

  // Rate limiting by IP - using async KV-backed limiter for persistence across cold starts
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    (req.headers['x-real-ip'] as string) ||
    'unknown';
  const rateLimit = await checkRateLimit(clientIp);

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT.toString());
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());

  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  // Parse action from query or body
  const action = sanitizeInput((req.query.action as string) || req.body?.action);

  try {
    switch (action) {
      // ========== AUTH (migrated to handler) ==========
      case 'auth': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const initData = sanitizeInput(req.body?.initData);
        return handleAuth(req, res, initData);
      }

      // ========== PRODUCTS (migrated to handler) ==========
      case 'products': {
        const initData = sanitizeInput(
          (req.headers['x-init-data'] as string) || req.body?.initData || ''
        );
        const adminKey = req.headers['x-admin-key'];
        const adminUserId = req.body?.userId;

        // Admin bypass for testing
        if (adminKey === process.env.ADMIN_API_KEY && adminUserId) {
          return handleProducts(req, res, parseInt(adminUserId));
        }

        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
        }
        return handleProducts(req, res, validation.user.id);
      }

      // ========== SETTINGS (migrated to handler) ==========
      case 'settings': {
        const initData = sanitizeInput(req.body?.initData || '');
        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
        }
        return handleSettings(req, res, validation.user.id);
      }

      // ========== PLANS (migrated to handler) ==========
      case 'plans': {
        const initData = sanitizeInput((req.query?.initData as string) || req.body?.initData || '');
        const validation = validateTelegramInitData(initData);

        // Plans can be viewed without full auth in some cases, but handler needs a userId
        const userId = validation.valid && validation.user ? validation.user.id : 0;
        return handlePlans(req, res, userId);
      }

      // ========== CREATE PAYMENT (migrated to handler) ==========
      case 'create-payment': {
        const initData = sanitizeInput(req.body?.initData || '');
        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
        }
        return handleCreatePayment(req, res, validation.user.id);
      }

      // ========== PAYMENT WEBHOOK (migrated to handler) ==========
      case 'payment-webhook': {
        return handlePaymentWebhook(req, res);
      }

      // ========== INIT DB (migrated to handler) ==========
      case 'init-db': {
        return handleInitDb(req, res);
      }

      // ========== RESET DB (migrated to handler) ==========
      case 'reset-db': {
        return handleResetDb(req, res);
      }

      // ========== HEALTH (migrated to handler) ==========
      case 'health': {
        return handleHealth(req, res);
      }

      // ========== ADMIN: ACTIVATE TRIAL (migrated to handler) ==========
      case 'admin-activate-trial': {
        return handleAdminActivateTrial(req, res);
      }

      // ========== ADMIN: CHECK USER (migrated to handler) ==========
      case 'admin-check-user': {
        return handleAdminCheckUser(req, res);
      }

      // ========== ADMIN: LIST ALL USERS (migrated to handler) ==========
      case 'admin-list-users': {
        return handleAdminListUsers(req, res);
      }

      // ========== ADMIN: LIST PRODUCTS (migrated to handler) ==========
      case 'admin-list-products': {
        return handleAdminListProducts(req, res);
      }

      // ========== ADMIN: SET PROTECTION (migrated to handler) ==========
      case 'admin-set-protection': {
        return handleAdminSetProtection(req, res);
      }

      // ========== ADMIN: TEST TELEGRAM (migrated to handler) ==========
      case 'admin-test-telegram': {
        return handleAdminTestTelegram(req, res);
      }

      // ========== ADMIN: RESET STATUSES (migrated to handler) ==========
      case 'admin-reset-statuses': {
        return handleAdminResetStatuses(req, res);
      }

      // ========== ADMIN: SET DEFENSE MODE (migrated to handler) ==========
      case 'admin-set-defense-mode': {
        return handleAdminSetDefenseMode(req, res);
      }

      // ========== ADMIN: TEST OZON API (migrated to handler) ==========
      case 'admin-test-ozon': {
        return handleAdminTestOzon(req, res);
      }

      // ========== ADMIN: TEST WB API (migrated to handler) ==========
      case 'admin-test-wb': {
        return handleAdminTestWb(req, res);
      }

      // ========== SYNC PRODUCTS (migrated to handler) ==========
      case 'sync-products': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const initData = sanitizeInput(req.body?.initData || '');
        const adminKey = req.headers['x-admin-key'];
        const validAdminKeys = [process.env.ADMIN_API_KEY].filter(Boolean);

        const validation = validateTelegramInitData(initData);
        let userId;

        if (validation.valid && validation.user) {
          userId = validation.user.id;
        } else if (adminKey && validAdminKeys.includes(adminKey as string) && req.body.telegramId) {
          userId = parseInt(req.body.telegramId);
        } else {
          return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
        }

        return handleSyncProducts(req, res, userId);
      }

      // ========== SENTINEL: CHECK PRICES (CRON) ==========
      // ========== CHECK PRICES (SENTINEL CRON) ==========
      case 'check-prices': {
        return handleCheckPrices(req, res);
      }

      // ========== ADMIN: CLONE USER DATA (migrated to handler) ==========
      case 'admin-clone-user': {
        return handleAdminCloneUser(req, res);
      }

      // ========== SEND REMINDERS (migrated to handler) ==========
      case 'send-reminders': {
        return handleSendReminders(req, res);
      }

      // ========== GET REFERRAL INFO (migrated to handler) ==========
      case 'referral': {
        return handleReferral(req, res);
      }

      // ========== ADMIN: SENTINEL LOGS (migrated to handler) ==========
      case 'admin-sentinel-logs': {
        return handleAdminSentinelLogs(req, res);
      }

      // ========== BATCH SET STOP-LOSS (migrated to handler) ==========
      case 'batch-set-stop-loss': {
        const initData = sanitizeInput(
          (req.headers['x-init-data'] as string) || req.body?.initData || ''
        );
        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
        }
        return handleBatchSetStopLoss(req, res, validation.user.id);
      }

      // ========== SENTINEL LOGS (migrated to handler) ==========
      case 'sentinel-logs': {
        const initData = sanitizeInput(
          (req.headers['x-init-data'] as string) || req.body?.initData || ''
        );

        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
        }
        return handleSentinelLogs(req, res, validation.user.id);
      }

      // ========== AI AGENT ==========
      case 'agent': {
        return handleAgent(req, res);
      }

      // ========== AGENT CONFIRM ==========
      case 'agent-confirm': {
        return handleAgentConfirm(req, res);
      }

      // ========== AGENT STATUS ==========
      case 'agent-status': {
        return handleAgentStatus(req, res);
      }

      // ========== CHAT HISTORY: GET ==========
      case 'get-chat-history': {
        const initData = sanitizeInput(
          (req.headers['x-init-data'] as string) || req.body?.initData || ''
        );
        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
        }

        const { getChatHistory } = await import('../src/api-lib/services/database.js');
        const messages = await getChatHistory(validation.user.id);
        return res.status(200).json({ success: true, messages });
      }

      // ========== CHAT HISTORY: SAVE ==========
      case 'save-chat-history': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const initData = sanitizeInput(req.body?.initData || '');
        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
        }

        const messages = req.body?.messages || [];
        const { saveChatHistory } = await import('../src/api-lib/services/database.js');
        await saveChatHistory(validation.user.id, messages);
        return res.status(200).json({ success: true });
      }

      // ========== CHAT HISTORY: CLEAR ==========
      case 'clear-chat-history': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const initData = sanitizeInput(req.body?.initData || '');
        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
        }

        const { clearChatHistory } = await import('../src/api-lib/services/database.js');
        await clearChatHistory(validation.user.id);
        return res.status(200).json({ success: true });
      }

      // ========== DEFAULT ==========
      default:
        return res.status(400).json({
          error: 'Unknown action',
          availableActions: [
            'auth',
            'products',
            'settings',
            'plans',
            'create-payment',
            'payment-webhook',
            'init-db',
            'reset-db',
            'health',
            'sync-products',
            'check-prices',
            'batch-set-stop-loss',
            'sentinel-logs',
            'agent',
            'agent-confirm',
            'agent-status',
            'admin-activate-trial',
            'admin-check-user',
            'admin-list-users',
            'admin-list-products',
            'admin-test-ozon',
            'admin-clone-user',
            'admin-sentinel-logs',
            'send-reminders',
            'referral',
          ],
        });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}

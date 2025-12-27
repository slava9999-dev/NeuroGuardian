// ============================================
// NeuroGUARDIAN — Unified API Handler
// Refactored: Uses middleware for auth, cleaner routing
// Version: 3.0.0 | Date: December 2024
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Middleware
import {
  extractTelegramAuth,
  extractAnyAuth,
  verifyAdminAccess,
  sendAuthError,
  sendMethodNotAllowed,
} from './middleware/auth.js';

// Route registry
import { AVAILABLE_ACTIONS } from './utils/routes.js';

// ============================================
// HANDLERS IMPORT
// ============================================

// Admin handlers
import {
  handleHealth,
  handleInitDb,
  handleResetDb,
  handleRunMigration,
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

// Auth handlers
import { handleAuth, handleSettings, handlePlans } from './handlers/auth.js';

// Product handlers
import { handleProducts, handleSyncProducts, handleBatchSetStopLoss } from './handlers/products.js';

// Payment handlers
import { handleCreatePayment, handlePaymentWebhook } from './handlers/payments.js';

// Sentinel handlers
import { handleCheckPrices } from './handlers/sentinel.js';
import {
  handleSentinelStatus,
  handleDefenseHistory,
  handleToggleProtection,
  handleUpdateSentinelStatus,
  handleLogDefense,
  handleBulkLogDefense,
} from './handlers/sentinel-status.js';

// Agent handlers (V4 only)
import { handleAgentV4, handleAgentV4Status, handleAgentV4Confirm } from './handlers/agent-v4.js';

// Chat handlers
import {
  handleGetChatHistory,
  handleSaveChatHistory,
  handleClearChatHistory,
} from './handlers/chat.js';

// Analytics handlers
import { handleGetAnalytics, handleGetSystemMetrics } from './handlers/analytics.js';

// Utilities
import {
  sanitizeInput,
  checkRateLimit,
  RATE_LIMIT,
  IS_PRODUCTION,
  ALLOWED_ORIGINS,
} from '../src/api-lib/lib/index.js';

// ============================================
// CORS HEADERS
// ============================================

function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  const isAllowed =
    !IS_PRODUCTION ||
    ALLOWED_ORIGINS.some(allowed => allowed && (origin === allowed || origin.startsWith(allowed)));

  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin || '*' : '');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Init-Data, X-Admin-Key'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    return res.status(200).end();
  }
  setCorsHeaders(req, res);

  // Rate limiting
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown';
  const rateLimit = await checkRateLimit(clientIp);
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT.toString());
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());

  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  // Parse action
  const action = sanitizeInput((req.query.action as string) || req.body?.action);

  try {
    switch (action) {
      // ========== PUBLIC: NO AUTH ==========
      case 'health':
        return handleHealth(req, res);

      case 'payment-webhook':
        return handlePaymentWebhook(req, res);

      // ========== AUTH ENDPOINTS ==========
      case 'auth': {
        if (req.method !== 'POST') return sendMethodNotAllowed(res);
        return handleAuth(req, res, sanitizeInput(req.body?.initData));
      }

      case 'plans': {
        const auth = extractTelegramAuth(req);
        return handlePlans(req, res, auth.success ? auth.context.userId : 0);
      }

      // ========== USER ENDPOINTS (TELEGRAM AUTH) ==========
      case 'products':
      case 'settings':
      case 'create-payment':
      case 'batch-set-stop-loss':
      case 'sentinel-logs': {
        const auth = extractAnyAuth(req);
        if (!auth.success) return sendAuthError(res, auth.error, auth.statusCode);

        const handlers: Record<string, typeof handleProducts> = {
          products: handleProducts,
          settings: handleSettings,
          'create-payment': handleCreatePayment,
          'batch-set-stop-loss': handleBatchSetStopLoss,
          'sentinel-logs': handleSentinelLogs,
        };
        return handlers[action](req, res, auth.context.userId);
      }

      case 'sync-products': {
        if (req.method !== 'POST') return sendMethodNotAllowed(res);
        const auth = extractAnyAuth(req);
        if (!auth.success) return sendAuthError(res, auth.error, auth.statusCode);
        return handleSyncProducts(req, res, auth.context.userId);
      }

      // ========== SENTINEL ENDPOINTS ==========
      case 'check-prices':
        return handleCheckPrices(req, res);

      case 'sentinel-status':
        return handleSentinelStatus(req, res);

      case 'defense-history':
        return handleDefenseHistory(req, res);

      case 'toggle-protection':
        return handleToggleProtection(req, res);

      case 'update-sentinel-status':
        return handleUpdateSentinelStatus(req, res);

      case 'log-defense':
        return handleLogDefense(req, res);

      case 'bulk-log-defense':
        return handleBulkLogDefense(req, res);

      // ========== AI AGENT ENDPOINTS ==========
      case 'agent':
      case 'agent-v4':
        return handleAgentV4(req, res);

      case 'agent-confirm':
        return handleAgentV4Confirm(req, res);

      case 'agent-status':
      case 'agent-v4-status':
        return handleAgentV4Status(req, res);

      // ========== CHAT HISTORY ==========
      case 'get-chat-history':
        return handleGetChatHistory(req, res);

      case 'save-chat-history':
        return handleSaveChatHistory(req, res);

      case 'clear-chat-history':
        return handleClearChatHistory(req, res);

      // ========== ANALYTICS ==========
      case 'get-analytics':
        return handleGetAnalytics(req, res);

      case 'get-system-metrics':
        return handleGetSystemMetrics(req, res);

      // ========== ADMIN ENDPOINTS ==========
      case 'init-db':
        return handleInitDb(req, res);

      case 'reset-db':
        return handleResetDb(req, res);

      case 'run-migration':
        return handleRunMigration(req, res);

      case 'admin-activate-trial':
        return handleAdminActivateTrial(req, res);

      case 'admin-check-user':
        return handleAdminCheckUser(req, res);

      case 'admin-list-users':
        return handleAdminListUsers(req, res);

      case 'admin-list-products':
        return handleAdminListProducts(req, res);

      case 'admin-set-protection':
        return handleAdminSetProtection(req, res);

      case 'admin-test-telegram':
        return handleAdminTestTelegram(req, res);

      case 'admin-reset-statuses':
        return handleAdminResetStatuses(req, res);

      case 'admin-set-defense-mode':
        return handleAdminSetDefenseMode(req, res);

      case 'admin-test-ozon':
        return handleAdminTestOzon(req, res);

      case 'admin-test-wb':
        return handleAdminTestWb(req, res);

      case 'admin-clone-user':
        return handleAdminCloneUser(req, res);

      case 'admin-sentinel-logs':
        return handleAdminSentinelLogs(req, res);

      case 'send-reminders':
        return handleSendReminders(req, res);

      case 'referral':
        return handleReferral(req, res);

      // ========== DEFAULT ==========
      default:
        return res.status(400).json({
          error: 'Unknown action',
          availableActions: AVAILABLE_ACTIONS,
        });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

// ============================================
// NeuroGUARDIAN — Unified API Handler
// Refactored: Uses middleware for auth, cleaner routing
// Version: 3.0.0 | Date: December 2024
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Middleware (moved to src/api-lib to avoid Vercel function limit)
import {
  extractTelegramAuth,
  extractAnyAuth,
  sendAuthError,
  sendMethodNotAllowed,
} from '../src/api-lib/middleware/auth.js';

// Route registry
import { AVAILABLE_ACTIONS } from '../src/api-lib/utils/routes.js';

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
} from '../src/api-lib/handlers/admin.js';

// Auth handlers
import { handleAuth, handleSettings, handlePlans } from '../src/api-lib/handlers/auth.js';

// Product handlers
import {
  handleProducts,
  handleSyncProducts,
  handleBatchSetStopLoss,
} from '../src/api-lib/handlers/products.js';

// Payment handlers
import { handleCreatePayment, handlePaymentWebhook } from '../src/api-lib/handlers/payments.js';

// Sentinel handlers
import { handleCheckPrices } from '../src/api-lib/handlers/sentinel.js';
import {
  handleSentinelStatus,
  handleDefenseHistory,
  handleToggleProtection,
  handleUpdateSentinelStatus,
  handleLogDefense,
  handleBulkLogDefense,
} from '../src/api-lib/handlers/sentinel-status.js';

// Agent handlers (V4 only)
import {
  handleAgentV4Secure,
  handleAgentV4Status,
  handleAgentV4ConfirmSecure,
} from '../src/api-lib/handlers/agent-v4.js';

// Chat handlers
import {
  handleGetChatHistory,
  handleSaveChatHistory,
  handleClearChatHistory,
} from '../src/api-lib/handlers/chat.js';

// Analytics handlers
import { handleGetAnalytics, handleGetSystemMetrics } from '../src/api-lib/handlers/analytics.js';

// Ops Panel handlers
import {
  handleOpsEvents,
  handleOpsAudit,
  handleOpsDashboard,
} from '../src/api-lib/handlers/ops.js';

// Marketplace Accounts
import { handleMarketplaceAccounts } from '../src/api-lib/handlers/marketplace-accounts.js';

// Utilities
import {
  sanitizeInput,
  checkRateLimit,
  checkRateLimitV2,
  RateLimitPresets,
  getRequestIdentifier,
  getRateLimitHeaders,
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
// RATE LIMITING HELPER
// ============================================

/**
 * Apply rate limiting based on endpoint type
 */
async function applyRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  action: string
): Promise<boolean> {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown';

  // Determine rate limit preset based on action
  let limit: number = RateLimitPresets.API.limit;
  let windowSeconds: number = RateLimitPresets.API.windowSeconds;
  let namespace = 'api';

  if (action.startsWith('admin-') || action === 'init-db' || action === 'reset-db') {
    limit = RateLimitPresets.ADMIN.limit;
    windowSeconds = RateLimitPresets.ADMIN.windowSeconds;
    namespace = 'admin';
  } else if (action === 'agent' || action === 'agent-v4' || action === 'agent-confirm') {
    limit = RateLimitPresets.AGENT.limit;
    windowSeconds = RateLimitPresets.AGENT.windowSeconds;
    namespace = 'agent';
  } else if (action === 'check-prices') {
    limit = RateLimitPresets.SENTINEL.limit;
    windowSeconds = RateLimitPresets.SENTINEL.windowSeconds;
    namespace = 'sentinel';
  } else if (action === 'auth') {
    limit = RateLimitPresets.AUTH.limit;
    windowSeconds = RateLimitPresets.AUTH.windowSeconds;
    namespace = 'auth';
  }

  const identifier = getRequestIdentifier(undefined, clientIp);

  const result = await checkRateLimitV2({
    limit,
    windowSeconds,
    identifier,
    namespace,
  });

  // Set rate limit headers
  const headers = getRateLimitHeaders(result);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (!result.allowed) {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
    });
    return false;
  }

  return true;
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

  // Parse action
  const action = sanitizeInput((req.query.action as string) || req.body?.action);

  // Apply rate limiting based on action type
  const rateLimitPassed = await applyRateLimit(req, res, action);
  if (!rateLimitPassed) {
    return; // Response already sent by applyRateLimit
  }

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
      case 'marketplace-accounts':
      case 'create-payment':
      case 'batch-set-stop-loss':
      case 'sentinel-logs': {
        const auth = extractAnyAuth(req);
        if (auth.success === false) {
          return sendAuthError(res, auth.error, auth.statusCode);
        }

        const handlers: Record<
          string,
          (req: VercelRequest, res: VercelResponse, userId: number) => Promise<VercelResponse>
        > = {
          products: handleProducts,
          settings: handleSettings,
          'marketplace-accounts': handleMarketplaceAccounts,
          'create-payment': handleCreatePayment,
          'batch-set-stop-loss': handleBatchSetStopLoss,
          'sentinel-logs': handleSentinelLogs,
        };
        return handlers[action](req, res, auth.context.userId);
      }

      case 'sync-products': {
        if (req.method !== 'POST') return sendMethodNotAllowed(res);
        const auth = extractAnyAuth(req);
        if (auth.success === false) {
          return sendAuthError(res, auth.error, auth.statusCode);
        }
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
        return handleAgentV4Secure(req, res);

      case 'agent-confirm':
        return handleAgentV4ConfirmSecure(req, res);

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

      // ========== OPS PANEL ENDPOINTS ==========
      case 'ops-events':
        return handleOpsEvents(req, res);

      case 'ops-audit':
        return handleOpsAudit(req, res);

      case 'ops-dashboard':
        return handleOpsDashboard(req, res);

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

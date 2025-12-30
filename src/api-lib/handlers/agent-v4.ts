// ============================================
// NeuroGUARDIAN — AI Agent Handler V4
// Two-Phase Pipeline: Planner → Executor → Answerer
// Version: 4.0.0 | Date: December 2024
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@vercel/kv';
import {
  sanitizeInput,
  decryptApiKey,
  checkRateLimit,
  isSubscriptionActive,
  getSecret,
} from '../lib/index.js';

import { getUserById, getProductsByUserId } from '../services/index.js';

// Metrics & Analytics
import { createAgentMetrics, logAgentMetrics, formatMetricsForLog } from '../agent/metrics.js';

// V4 Architecture: Two-Phase Pipeline with Structured Output
import { orchestrateV4, type UserContext } from '../agent/orchestrator-v4.js';
import { getSecurityAgent, securityMiddleware } from '@neuroguardian/security-agent';
import { verifyAdminAccessAsync, extractTelegramAuth } from '../middleware/auth.js';

// ============================================
// TYPE DEFINITIONS
// ============================================

/** Database user record */
interface DBUserRecord {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  role?: string;
  api_key_wb?: string;
  api_key_ozon?: string;
  subscription_active: boolean;
  subscription_end_date?: string | Date;
  subscription_end?: string | Date; // Alias for compatibility with lib function
}

// Helper to get KV client
async function getKVClient() {
  const [url, token] = await Promise.all([
    getSecret('kv_rest_api_url', 'kv_client_init'),
    getSecret('kv_rest_api_token', 'kv_client_init'),
  ]);

  if (url && token) {
    return createClient({ url, token });
  }
  return null;
}

/**
 * V4 Agent Handler - Two-Phase Pipeline
 */
export async function handleAgentV4(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Authentication
  let userId: number;

  const isAdmin = await verifyAdminAccessAsync(req);
  if (isAdmin && req.body?.telegramId) {
    // Admin bypass for testing
    userId = parseInt(req.body.telegramId);
    console.log(`🔑 Admin API access: user ${userId}`);

    // Audit this bypass
    const agent = getSecurityAgent();
    if (!agent.isInitialized()) await agent.initialize();
    await agent.audit.log({
      event: 'auth.bypass.admin_key',
      category: 'auth',
      severity: 'warning',
      userId: userId.toString(),
      metadata: { mechanism: 'admin_api_key' },
    });
  } else {
    // Normal Telegram authentication
    const auth = extractTelegramAuth(req);
    if (auth.success === false) {
      const authFail = auth as { success: false; error: string; statusCode: number };
      return res.status(authFail.statusCode).json({ error: authFail.error, code: 'AUTH_FAILED' });
    }
    userId = auth.context.userId;
  }

  const user = (await getUserById(userId)) as DBUserRecord | null;

  // 2. Check subscription
  if (!isAdmin && !isSubscriptionActive(user)) {
    return res.json({
      success: true,
      message:
        '⚠️ **Для использования AI-агента требуется активная подписка.**\n\nОформите подписку, чтобы получить доступ к аналитике и управлению ценами через чат.',
    });
  }

  // 3. Validate message
  const message = sanitizeInput(req.body?.message || '');
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // 4. Rate limit
  const agentRateLimit = await checkRateLimit(`agent:${userId}`, true);
  if (!agentRateLimit.allowed) {
    return res.json({
      success: true,
      message: '⏳ **Превышен лимит запросов.**\n\nПодождите минуту и попробуйте снова.',
    });
  }

  // 5. Load conversation history
  const kv = await getKVClient();
  const historyKey = `chat:v4:${userId}`;
  let conversationHistory: Array<{ role: string; content: string }> = [];

  if (kv) {
    try {
      const savedHistory = await kv.get(historyKey);
      if (savedHistory && Array.isArray(savedHistory)) {
        conversationHistory = savedHistory as typeof conversationHistory;
      }
    } catch (e) {
      console.warn('⚠️ Failed to load chat history:', e);
    }
  }

  // 6. Fetch user products for context
  const products = await getProductsByUserId(userId);
  const protectedCount = products.filter(
    (p: { min_price?: number }) => (p.min_price || 0) > 0
  ).length;

  console.log(`🚀 V4 Agent Request from User ${userId}: "${message.substring(0, 50)}..."`);

  // 7. Build context for V4 Orchestrator
  const context: UserContext = {
    userId,
    marketplace: 'all',
    wbApiKey: user?.api_key_wb ? decryptApiKey(user.api_key_wb) : undefined,
    ozonApiKey: user?.api_key_ozon ? decryptApiKey(user.api_key_ozon) : undefined,
  };

  // 8. API Key Guard (Onboarding)
  const hasKeys = context.wbApiKey || context.ozonApiKey;
  const isHelpIntent = /^(привет|помощь|что ты умеешь|старт|start|help|здравствуйте)/i.test(
    message.trim()
  );

  if (!hasKeys && !isHelpIntent && !isAdmin) {
    return res.json({
      success: true,
      message: `👋 **Добро пожаловать в NeuroGuardian!**

Я вижу, что вы здесь впервые (или у вас не настроены интеграции).
Без доступа к API Wildberries или Ozon я как "сапожник без сапог" — многое умею, но ничего не могу показать на ваших данных.

👉 **Что делать:**
1. Перейдите в раздел ⚙️ **Настройки** (Settings)
2. Добавьте API-ключ (Статистика для WB или ClientID+Key для Ozon)
3. Возвращайтесь сюда, и мы займемся прибылью!

_Если вам нужна помощь с ключами, напишите "Помощь"._`,
      actions: [],
      data: {},
      links: [],
      metadata: {
        totalTime: 0,
        planningTime: 0,
        executionTime: 0,
        answeringTime: 0,
        tokensUsed: 0,
        toolsCalled: [],
        productsCount: 0,
        protectedCount: 0,
      },
    });
  }

  // 9. Execute V4 Orchestrator (Two-Phase Pipeline)
  const result = await orchestrateV4(message, context, conversationHistory);

  // 9. Save conversation history and pending actions
  if (kv) {
    try {
      // History
      if (result.message) {
        conversationHistory.push({ role: 'user', content: message });
        conversationHistory.push({ role: 'assistant', content: result.message });
        const slicedHistory = conversationHistory.slice(-20);
        await kv.set(historyKey, slicedHistory, { ex: 86400 });
      }

      // Actions for confirmation
      if (result.actions && result.actions.length > 0) {
        const action = result.actions[0];
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        await kv.set(
          `pending:v4:${userId}`,
          {
            type: action.type,
            taskId,
            details: action.details,
            summary: action.summary,
            created_at: new Date().toISOString(),
          },
          { ex: 3600 }
        ); // 1 hour TTL

        // Inject taskId into the response actions so UI knows what to confirm
        (result.actions[0] as Record<string, unknown>).taskId = taskId;
      }
    } catch (e) {
      console.warn('Failed to save chat state to KV:', e);
    }
  }

  // 10. Log metrics
  const metrics = createAgentMetrics({
    userId,
    userMessage: message,
    model: 'v4-pipeline',
    tokensUsed: result.tokensUsed,
    responseTime: result.totalTimeMs,
    toolsUsed: result.toolsCalled,
    hadError: !result.success,
    errorType: result.success ? undefined : 'v4_error',
  });
  logAgentMetrics(metrics).catch(() => {});

  if (process.env.NODE_ENV !== 'production') {
    console.log(formatMetricsForLog(metrics));
    console.log(
      `📊 V4 Timing: plan=${result.planningTimeMs}ms, exec=${result.executionTimeMs}ms, answer=${result.answeringTimeMs}ms`
    );
  }

  // 11. Return structured response
  return res.json({
    success: result.success,
    message: result.message,
    links: result.links,
    actions: result.actions,
    data: result.data,
    metadata: {
      totalTime: result.totalTimeMs,
      planningTime: result.planningTimeMs,
      executionTime: result.executionTimeMs,
      answeringTime: result.answeringTimeMs,
      tokensUsed: result.tokensUsed,
      toolsCalled: result.toolsCalled,
      productsCount: products.length,
      protectedCount,
    },
  });
}

/**
 * V4 Agent Status
 */
export async function handleAgentV4Status(
  _req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const moeEnabled = process.env.MOE_ROUTING_ENABLED !== 'false';
  const forceLocal = process.env.FORCE_LOCAL_INFERENCE === 'true';

  return res.json({
    available: true,
    version: 'v4',
    architecture: 'two-phase-pipeline',
    model: {
      planner: 'gpt-4o-mini',
      answerer: 'gpt-4o',
    },
    capabilities: [
      'Structured Output',
      'Link Validation',
      'Two-Phase Pipeline',
      'Tool Results Only Links',
    ],
    moe: {
      enabled: moeEnabled,
      forceLocal,
      description: moeEnabled
        ? 'Hybrid MoE: Local LLM → Cloud → Rule-based fallback'
        : 'MoE routing disabled, using cloud LLM only',
    },
  });
}

/**
 * V4 Agent Confirmation Handler
 * Handles user confirmation/rejection of actions
 */
export async function handleAgentV4Confirm(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const { confirmed, taskId } = req.body;

  if (!confirmed) {
    return res.json({
      success: true,
      content: '👍 Операция отменена.',
      executed: false,
    });
  }

  // Auth
  const auth = extractTelegramAuth(req);
  if (!auth.success) {
    // Also try admin auth for confirmation
    const isAdmin = await verifyAdminAccessAsync(req);
    if (!isAdmin || !req.body?.telegramId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Fallback if admin
  }

  const userId = auth.success ? auth.context.userId : parseInt(req.body.telegramId);
  const kv = await getKVClient();

  if (!kv) {
    return res.status(500).json({ error: 'KV offline' });
  }

  // Get pending action
  interface PendingAction {
    type: 'update_prices' | 'set_stop_loss' | 'bulk_protect_products' | 'update_stocks';
    taskId: string;
    details: Record<string, unknown>;
    summary: string;
  }

  const pendingAction = (await kv.get(`pending:v4:${userId}`)) as PendingAction | null;
  if (!pendingAction) {
    return res.json({
      success: false,
      content: '❌ Действие не найдено или истекло.',
      executed: false,
    });
  }

  // Verify taskId matches
  if (taskId && pendingAction.taskId !== taskId) {
    return res.json({
      success: false,
      content: '❌ Идентификатор операции не совпадает.',
      executed: false,
    });
  }

  // Get user data for API keys
  const user = (await getUserById(userId)) as DBUserRecord | null;
  if (!user) {
    return res.json({
      success: false,
      content: '❌ Пользователь не найден.',
      executed: false,
    });
  }

  // Import marketplace service dynamically for write operations
  const {
    updateWbPrices,
    updateOzonPrices,
    getWbFbsWarehouses,
    updateWbStockFbs,
    updateOzonStockFbs,
    getMarketplaceKeys,
  } = await import('../services/marketplace.js');
  const { updateProductMinPrice, getProductsByUserId } = await import('../services/database.js');
  const { validatePriceUpdateSync } = await import('../services/price-guard.js');

  try {
    let resultMessage = '';
    let executedCount = 0;

    switch (pendingAction.type) {
      // ========================================
      // UPDATE PRICES
      // ========================================
      case 'update_prices': {
        const priceUpdates = pendingAction.details.price_updates as Array<{
          product_id: string;
          nm_id?: number;
          new_price: number;
          marketplace: 'WB' | 'Ozon';
        }>;

        if (!priceUpdates || priceUpdates.length === 0) {
          throw new Error('Нет данных для обновления цен');
        }

        // Split by marketplace
        // Support account_id if provided
        const accountId = pendingAction.details.account_id as number | undefined;
        const keys = await getMarketplaceKeys(userId, accountId);

        // Fetch products for min_price and current_price security checks
        const products = await getProductsByUserId(userId, accountId);

        const validatedUpdates: Array<{ nmId: number; price: number }> = [];
        const ozonValidatedUpdates: Array<{ productId: number; price: number }> = [];
        const safetyWarnings: string[] = [];

        for (const u of priceUpdates) {
          const product = products.find(
            (p: { product_id: string }) => p.product_id === u.product_id
          );

          const securityResult = validatePriceUpdateSync({
            productId: u.product_id,
            nmId: u.nm_id,
            userId,
            currentPrice: product?.current_price || u.new_price, // fallback if price not cached
            proposedPrice: u.new_price,
            minPrice: product?.min_price || 0,
            marketplace: u.marketplace,
          });

          if (securityResult.isAdjusted) {
            safetyWarnings.push(`⚠️ ${product?.title || u.product_id}: ${securityResult.reason}`);
          }

          if (u.marketplace === 'WB' && u.nm_id) {
            validatedUpdates.push({ nmId: u.nm_id, price: securityResult.safePrice });
          } else if (u.marketplace === 'Ozon') {
            ozonValidatedUpdates.push({
              productId: parseInt(u.product_id),
              price: securityResult.safePrice,
            });
          }
        }

        let wbResult = { success: true, count: 0 };
        let ozonResult = { success: true, count: 0 };

        // Update WB prices
        if (validatedUpdates.length > 0 && keys.wb) {
          wbResult = await updateWbPrices(keys.wb, validatedUpdates);
        }

        // Update Ozon prices
        if (ozonValidatedUpdates.length > 0 && keys.ozon) {
          ozonResult = await updateOzonPrices(
            keys.ozon.clientId,
            keys.ozon.apiKey,
            ozonValidatedUpdates
          );
        }

        executedCount = wbResult.count + ozonResult.count;
        resultMessage = `✅ Цены обновлены: ${executedCount} товаров`;

        if (safetyWarnings.length > 0) {
          resultMessage += `\n\n🛡️ **Защита цены:**\n${safetyWarnings.join('\n')}`;
        }

        if (!wbResult.success || !ozonResult.success) {
          resultMessage += `\n⚠️ Некоторые обновления не удались`;
        }
        break;
      }

      // ========================================
      // SET STOP-LOSS
      // ========================================
      case 'set_stop_loss': {
        const stopLossData = pendingAction.details as {
          product_id: string;
          min_price: number;
          product_title?: string;
        };

        if (!stopLossData.product_id || !stopLossData.min_price) {
          throw new Error('Нет данных для установки Stop-Loss');
        }

        await updateProductMinPrice(userId, stopLossData.product_id, stopLossData.min_price);
        executedCount = 1;
        resultMessage = `✅ Stop-Loss установлен: ${stopLossData.min_price} ₽ для "${stopLossData.product_title || stopLossData.product_id}"`;
        break;
      }

      // ========================================
      // BULK PROTECT PRODUCTS
      // ========================================
      case 'bulk_protect_products': {
        const bulkData = pendingAction.details as {
          product_ids: string[];
          min_price_percent?: number;
          min_price_fixed?: number;
        };

        if (!bulkData.product_ids || bulkData.product_ids.length === 0) {
          throw new Error('Нет товаров для защиты');
        }

        const products = (await getProductsByUserId(userId)) as Array<{
          product_id: string;
          current_price: number;
        }>;
        let updated = 0;

        for (const productId of bulkData.product_ids) {
          const product = products.find(
            (p: { product_id: string; current_price: number }) => p.product_id === productId
          );
          if (product) {
            let minPrice: number;
            if (bulkData.min_price_percent) {
              minPrice = Math.round(product.current_price * (bulkData.min_price_percent / 100));
            } else if (bulkData.min_price_fixed) {
              minPrice = bulkData.min_price_fixed;
            } else {
              minPrice = Math.round(product.current_price * 0.9); // Default: 90% от текущей
            }
            await updateProductMinPrice(userId, productId, minPrice);
            updated++;
          }
        }

        executedCount = updated;
        resultMessage = `✅ Защита установлена для ${updated} товаров`;
        break;
      }

      case 'update_stocks': {
        const stockUpdates = pendingAction.details.stock_updates as Array<{
          product_id: string;
          sku?: string;
          offer_id?: string;
          new_stock: number;
          marketplace: 'WB' | 'Ozon';
        }>;

        if (!stockUpdates || stockUpdates.length === 0) {
          throw new Error('Нет данных для обновления остатков');
        }

        const wbUpdates = stockUpdates.filter(u => u.marketplace === 'WB' && u.sku);
        const ozonUpdates = stockUpdates.filter(u => u.marketplace === 'Ozon');

        const accountId = pendingAction.details.account_id as number | undefined;
        const { getMarketplaceKeys } = await import('../services/marketplace.js');
        const keys = await getMarketplaceKeys(userId, accountId);

        let wbResult: { success: boolean; count: number; error?: string } = {
          success: true,
          count: 0,
        };
        let ozonResult: { success: boolean; count: number; error?: string } = {
          success: true,
          count: 0,
        };

        // 1. Update WB Stocks
        if (wbUpdates.length > 0 && keys.wb) {
          const warehouses = await getWbFbsWarehouses(keys.wb);
          if (warehouses.warehouses.length > 0) {
            const whId = warehouses.warehouses[0].id; // Pick first warehouse
            wbResult = await updateWbStockFbs(
              keys.wb,
              whId,
              wbUpdates.map(u => ({ sku: u.sku!, amount: u.new_stock }))
            );
          } else {
            throw new Error('У вас не настроены склады (FBS) на Wildberries');
          }
        }

        // 2. Update Ozon Stocks
        if (ozonUpdates.length > 0 && keys.ozon) {
          ozonResult = await updateOzonStockFbs(
            keys.ozon.clientId,
            keys.ozon.apiKey,
            ozonUpdates.map(u => ({
              productId: parseInt(u.product_id),
              offerId: u.offer_id || u.product_id,
              stock: u.new_stock,
            }))
          );
        }

        executedCount = wbResult.count + ozonResult.count;
        resultMessage = `✅ Остатки обновлены: ${executedCount} товаров`;

        if (!wbResult.success || !ozonResult.success) {
          resultMessage += `\n⚠️ Ошибка: ${wbResult.error || ozonResult.error || 'некоторые товары не обновлены'}`;
        }
        break;
      }

      default:
        throw new Error(`Неизвестный тип операции: ${pendingAction.type}`);
    }

    // Clear pending action
    await kv.del(`pending:v4:${userId}`);

    console.log(
      `✅ V4 Confirm executed: ${pendingAction.type} for user ${userId}, count: ${executedCount}`
    );

    return res.json({
      success: true,
      content: resultMessage,
      executed: true,
      executedCount,
      actionType: pendingAction.type,
    });
  } catch (error) {
    console.error('V4 Confirm error:', error);

    // Don't delete pending action on error - let user retry
    return res.json({
      success: false,
      content: `❌ Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      executed: false,
    });
  }
}

/**
 * Secure version of handleAgentV4 with audit logging and policy enforcement
 */
export const handleAgentV4Secure = securityMiddleware(
  {
    auditEvent: 'agent.v4.execute',
    rateLimit: { limit: 20, windowSeconds: 60 },
  },
  ((req: any, res: any) => handleAgentV4(req, res)) as any
);

/**
 * Secure version of handleAgentV4Confirm
 */
export const handleAgentV4ConfirmSecure = securityMiddleware(
  {
    auditEvent: 'agent.v4.confirm',
  },
  ((req: any, res: any) => handleAgentV4Confirm(req, res)) as any
);

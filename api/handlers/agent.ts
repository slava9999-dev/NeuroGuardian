// ============================================
// NeuroGUARDIAN — AI Agent Handler
// LLM Integration & Function Calling (V3 Architecture)
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@vercel/kv';
import {
  validateTelegramInitData,
  sanitizeInput,
  decryptApiKey,
  checkRateLimit,
} from '../../src/api-lib/lib/index.js';

import { getUserById, getProductsByUserId } from '../../src/api-lib/services/index.js';

// Metrics & Analytics
import {
  createAgentMetrics,
  logAgentMetrics,
  formatMetricsForLog,
} from '../../src/api-lib/agent/metrics.js';

// V3 Architecture: Router + Specialists + Structured Output
import { orchestrateAgentRequest, type UserContext } from '../../src/api-lib/agent/orchestrator.js';

// ============================================
// TYPE DEFINITIONS
// ============================================

/** Database user record */
interface DBUserRecord {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
  role?: string;
  api_key_wb?: string;
  api_key_ozon?: string;
  ozon_client_id?: string;
  protection_enabled: boolean;
  defense_mode: 'zero_stock' | 'price_correction';
  subscription_plan: string;
  subscription_end_date?: string;
  subscription_active: boolean;
  triggered_today: number;
  saved_amount: number;
}

/** Database product record */
interface DBProductRecord {
  id: number;
  user_id: number;
  product_id: string;
  nm_id: number | null;
  title: string;
  image_url: string | null;
  current_price: number;
  min_price: number;
  current_stock: number;
  marketplace: 'WB' | 'Ozon';
  vendor_code?: string;
  status: string;
  is_monitored: boolean;
}

/** Action requiring user confirmation */

// Helper to get KV client
function getKVClient() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return null;
}

// --- Check Subscription Helper (local) ---
function isSubscriptionActiveLocal(user: DBUserRecord | null): boolean {
  if (!user) return false;
  if (process.env.TEST_MODE === 'true') return true;
  if (user.role === 'admin') return true;
  if (!user.subscription_active) return false;
  if (!user.subscription_end_date) return false;
  return new Date(user.subscription_end_date) > new Date();
}

/**
 * Handle principal agent turn
 */
export async function handleAgent(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const initData = sanitizeInput(
    (req.headers['x-init-data'] as string) || req.body?.initData || ''
  );

  const validation = validateTelegramInitData(initData);
  if (!validation.valid || !validation.user) {
    return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
  }
  const userId = validation.user.id;

  const user = (await getUserById(userId)) as DBUserRecord | null;

  // 1. Check subscription
  if (!isSubscriptionActiveLocal(user)) {
    return res.json({
      success: true,
      content:
        '⚠️ **Для использования AI-агента требуется активная подписка.**\n\nОформите подписку, чтобы получить доступ к аналитике и управлению ценами через чат.',
    });
  }

  const message = sanitizeInput(req.body?.message || '');
  if (!message) return res.status(400).json({ error: 'Message is required' });

  // 2. Rate limit
  const agentRateLimit = await checkRateLimit(`agent:${userId}`, true);
  if (!agentRateLimit.allowed) {
    return res.json({
      success: true,
      content: '⏳ **Превышен лимит запросов.**\n\nПодождите минуту и попробуйте снова.',
    });
  }

  const kv = getKVClient();
  const historyKey = `chat:${userId}`;

  // 3. Load Chat History
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

  // 4. Fetch User Products Context
  const products = await getProductsByUserId(userId);
  const typedProducts = products as DBProductRecord[];
  const protectedCount = typedProducts.filter(p => p.min_price > 0).length;

  console.log(`🚀 Using V3 Agent for User ${userId}`);

  // 5. Check for pending action (for confirmation logic)
  let pendingAction: any | undefined;
  if (kv) {
    try {
      pendingAction = await kv.get(`pending:${userId}`);
    } catch (e) {
      console.warn('Failed to retrieve pending action:', e);
    }
  }

  // 6. Build Context for V3 Orchestrator
  const v3Context: UserContext = {
    userId,
    productsCount: products.length,
    protectedCount,
    hasWbApi: !!user?.api_key_wb,
    hasOzonApi: !!user?.api_key_ozon,
    marketplace: 'all',
    wbApiKey: user?.api_key_wb ? decryptApiKey(user.api_key_wb) : undefined,
    ozonApiKey: user?.api_key_ozon ? decryptApiKey(user.api_key_ozon) : undefined,
  };

  // 7. Execute Orchestrator
  const v3Result = await orchestrateAgentRequest(
    message,
    v3Context,
    conversationHistory,
    pendingAction
  );

  // 8. Handle Persistence (History & Pending Actions)
  if (kv) {
    try {
      // Clear pending if user confirmed or switched topic
      if (pendingAction && (v3Result.category === 'confirmation' || !v3Result.actionRequired)) {
        await kv.del(`pending:${userId}`);
      }

      // Store new pending action
      if (v3Result.actionRequired?.taskId) {
        await kv.set(`pending:${userId}`, v3Result.actionRequired, { ex: 300 });
      }

      // Save history
      if (v3Result.content) {
        conversationHistory.push({ role: 'user', content: message });
        conversationHistory.push({ role: 'assistant', content: v3Result.content });
        const slicedHistory = conversationHistory.slice(-20);
        await kv.set(historyKey, slicedHistory, { ex: 86400 });
      }
    } catch (e) {
      console.warn('Failed KV operations:', e);
    }
  }

  // 9. Metrics & Respond
  const metrics = createAgentMetrics({
    userId,
    userMessage: message,
    model: v3Result.model,
    tokensUsed: v3Result.tokensUsed,
    responseTime: v3Result.executionTimeMs,
    toolsUsed: v3Result.toolsUsed,
    hadError: !v3Result.success,
    errorType: v3Result.success ? undefined : 'v3_error',
    actionRequired: v3Result.actionRequired
      ? { type: v3Result.actionRequired.operation }
      : undefined,
  });
  logAgentMetrics(metrics).catch(() => {});

  if (process.env.NODE_ENV !== 'production') console.log(formatMetricsForLog(metrics));

  return res.json({
    success: v3Result.success,
    content: v3Result.content,
    actionRequired: v3Result.actionRequired,
    metadata: {
      executionTime: v3Result.executionTimeMs,
      model: v3Result.model,
      toolsUsed: v3Result.toolsUsed,
      tokensUsed: v3Result.tokensUsed,
      category: v3Result.category,
    },
  });
}

/**
 * Handle confirmation proxy to V3
 */
export async function handleAgentConfirm(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const { confirmed, taskId } = req.body;
  if (!confirmed) {
    return res.json({ success: true, content: '👍 Операция отменена.', executed: false });
  }

  // Auth
  const initData = (req.headers['x-init-data'] as string) || req.body?.initData || '';
  const validation = validateTelegramInitData(initData);
  if (!validation.valid || !validation.user) return res.status(401).json({ error: 'Unauthorized' });
  const userId = validation.user.id;

  const kv = getKVClient();
  if (!kv) return res.status(500).json({ error: 'KV offline' });

  // Get pending
  const pendingAction: any = await kv.get(`pending:${userId}`);
  if (!pendingAction || pendingAction.taskId !== taskId) {
    return res.json({
      success: false,
      content: '❌ Действие не найдено или истекло.',
      executed: false,
    });
  }

  const user = (await getUserById(userId)) as DBUserRecord | null;
  const products = await getProductsByUserId(userId);

  const v3Context: UserContext = {
    userId,
    productsCount: products.length,
    protectedCount: products.filter(p => p.min_price > 0).length,
    hasWbApi: !!user?.api_key_wb,
    hasOzonApi: !!user?.api_key_ozon,
    marketplace: 'all',
    wbApiKey: user?.api_key_wb ? decryptApiKey(user.api_key_wb) : undefined,
    ozonApiKey: user?.api_key_ozon ? decryptApiKey(user.api_key_ozon) : undefined,
  };

  // Trigger Confirmation via Proxy ("да" message)
  const v3Result = await orchestrateAgentRequest('да', v3Context, [], pendingAction);

  if (v3Result.success) {
    await kv.del(`pending:${userId}`);
    await kv.set(`task:${taskId}`, true, { ex: 3600 });
  }

  return res.json({
    success: v3Result.success,
    content: v3Result.content,
    executed: v3Result.success,
    metadata: {
      executionTime: v3Result.executionTimeMs,
      model: v3Result.model,
      toolsUsed: v3Result.toolsUsed,
    },
  });
}

/**
 * Basic agent status
 */
export async function handleAgentStatus(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  return res.json({
    available: true,
    model: 'gpt-4o-mini',
    capabilities: ['Stats', 'Price Management', 'ABC Analysis'],
  });
}

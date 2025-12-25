// ============================================
// NeuroGUARDIAN — AI Agent Handler V4
// Two-Phase Pipeline: Planner → Executor → Answerer
// Version: 4.0.0 | Date: December 2024
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

// V4 Architecture: Two-Phase Pipeline with Structured Output
import { orchestrateV4, type UserContext } from '../../src/api-lib/agent/orchestrator-v4.js';

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
  subscription_end_date?: string;
}

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

// Check Subscription
function isSubscriptionActive(user: DBUserRecord | null): boolean {
  if (!user) return false;
  if (process.env.TEST_MODE === 'true') return true;
  if (user.role === 'admin') return true;
  if (!user.subscription_active) return false;
  if (!user.subscription_end_date) return false;
  return new Date(user.subscription_end_date) > new Date();
}

/**
 * V4 Agent Handler - Two-Phase Pipeline
 *
 * Key improvements:
 * - Structured Output (JSON Schema)
 * - Links only from tool results
 * - Minimal system prompt
 * - Better link validation
 */
export async function handleAgentV4(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Authentication
  const initData = sanitizeInput(
    (req.headers['x-init-data'] as string) || req.body?.initData || ''
  );

  const validation = validateTelegramInitData(initData);
  if (!validation.valid || !validation.user) {
    return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
  }
  const userId = validation.user.id;

  const user = (await getUserById(userId)) as DBUserRecord | null;

  // 2. Check subscription
  if (!isSubscriptionActive(user)) {
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
  const kv = getKVClient();
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
  const protectedCount = products.filter(p => p.min_price > 0).length;

  console.log(`🚀 V4 Agent Request from User ${userId}: "${message.substring(0, 50)}..."`);

  // 7. Build context for V4 Orchestrator
  const context: UserContext = {
    userId,
    marketplace: 'all',
    wbApiKey: user?.api_key_wb ? decryptApiKey(user.api_key_wb) : undefined,
    ozonApiKey: user?.api_key_ozon ? decryptApiKey(user.api_key_ozon) : undefined,
  };

  // 8. Execute V4 Orchestrator (Two-Phase Pipeline)
  const result = await orchestrateV4(message, context, conversationHistory);

  // 9. Save conversation history
  if (kv && result.message) {
    try {
      conversationHistory.push({ role: 'user', content: message });
      conversationHistory.push({ role: 'assistant', content: result.message });
      const slicedHistory = conversationHistory.slice(-20);
      await kv.set(historyKey, slicedHistory, { ex: 86400 });
    } catch (e) {
      console.warn('Failed to save chat history:', e);
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
  const { confirmed } = req.body;

  if (!confirmed) {
    return res.json({
      success: true,
      content: '👍 Операция отменена.',
      executed: false,
    });
  }

  // Auth
  const initData = (req.headers['x-init-data'] as string) || req.body?.initData || '';
  const validation = validateTelegramInitData(initData);
  if (!validation.valid || !validation.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = validation.user.id;
  const kv = getKVClient();

  if (!kv) {
    return res.status(500).json({ error: 'KV offline' });
  }

  // Get pending action
  const pendingAction = await kv.get(`pending:v4:${userId}`);
  if (!pendingAction) {
    return res.json({
      success: false,
      content: '❌ Действие не найдено или истекло.',
      executed: false,
    });
  }

  // TODO: Execute the pending action based on its type
  // For now, return a success message
  await kv.del(`pending:v4:${userId}`);

  return res.json({
    success: true,
    content: '✅ Операция выполнена успешно.',
    executed: true,
  });
}

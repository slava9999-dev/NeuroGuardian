// ============================================
// NeuroGUARDIAN — AI Agent Handler V5
// Professional Architecture: Clean, Modular, Scalable
// Version: 5.1.0 | Date: January 2026
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@vercel/kv';
import {
  sanitizeInput,
  checkRateLimit,
  isSubscriptionActive,
  getSecret,
  isFeatureEnabled,
} from '../lib/index.js';

import { getUserById, getProductsByUserId } from '../services/index.js';

// Metrics
import { createAgentMetrics, logAgentMetrics } from '../agent/metrics.js';

// V5 Architecture
import { agentOrchestratorV5 } from '../../agent/core/AgentOrchestratorV5.js';
import { type OrchestratorContext } from '../../core/types/agent.types.js';
import { registerAllTools } from '../../agent/execution/index.js'; // Register tools

// Multi-Agent Architecture (V6)
import { multiAgentOrchestrator } from '../../agent/specialists/MultiAgentOrchestrator.js';

// Feature flag for gradual rollout - will be checked inside the handler
const USE_MULTI_AGENT = process.env.USE_MULTI_AGENT === 'true';

// Security
import { securityMiddleware } from '@neuroguardian/security-agent';
import { verifyAdminAccessAsync, extractTelegramAuth } from '../middleware/auth.js';

// Initialize tools once
try {
  registerAllTools();
} catch (e) {
  console.warn('[Agent V5] Tools already registered or registration failed:', e);
}

// Additional imports for confirmation phase
import { toolRegistry } from '../../agent/execution/ToolRegistry.js';

// Interfaces
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
}

interface PendingAction {
  type: string;
  taskId: string;
  details: Record<string, unknown>;
  summary: string;
  created_at: string;
}

// Helper: KV Client
async function getKVClient() {
  const [url, token] = await Promise.all([
    getSecret('kv_rest_api_url', 'kv_client_init'),
    getSecret('kv_rest_api_token', 'kv_client_init'),
  ]);
  if (url && token && url.startsWith('https://')) {
    return createClient({ url, token });
  }
  return null;
}

/**
 * V5 Agent Handler
 */
export async function handleAgentV5(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  // console.log('[Agent V5 Handler] Request received');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Authentication
  let userId: number;
  const isAdmin = await verifyAdminAccessAsync(req);
  const bypassTelegramId = req.body?.telegramId || req.query?.telegramId;

  if (isAdmin && bypassTelegramId) {
    userId = parseInt(bypassTelegramId as string);
  } else {
    const auth = extractTelegramAuth(req);
    if (auth.success === false) {
      const authFail = auth as { success: false; error: string; statusCode: number };
      return res.status(authFail.statusCode).json({ error: authFail.error, code: 'AUTH_FAILED' });
    }
    userId = auth.context.userId;
  }

  // 2. Fetch User & Subscription
  let user: DBUserRecord | null = null;
  if (!isAdmin) {
    try {
      user = (await getUserById(userId)) as DBUserRecord | null;
    } catch (error) {
      console.error(`[Agent V5] DB Error:`, error);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    if (!isSubscriptionActive(user)) {
      return res.json({
        success: true,
        message: '⚠️ **Требуется активная подписка.**',
      });
    }
  }

  // 3. Rate Limit
  if (!isAdmin) {
    const agentRateLimit = await checkRateLimit(`agent:${userId}`, true);
    if (!agentRateLimit.allowed) {
      return res.json({
        success: true,
        message: '⏳ **Превышен лимит запросов.**',
      });
    }
  }

  // 4. Input Processing
  const message = sanitizeInput(req.body?.message || '');
  if (!message) return res.status(400).json({ error: 'Message empty' });

  const kv = await getKVClient();
  const historyKey = `chat:v5:${userId}`; // Separate history for V5
  let conversationHistory: Array<{ role: string; content: string }> = [];

  if (kv) {
    try {
      const savedHistory = await kv.get(historyKey);
      if (Array.isArray(savedHistory)) conversationHistory = savedHistory;
    } catch (e) {
      console.warn('[Agent V5] History load failed:', e);
    }
  }

  // Fetch products (lightweight)
  if (!isAdmin) {
    await getProductsByUserId(userId);
  }

  // 6. Execute Orchestrator (V5 or Multi-Agent based on dynamic feature flag)
  const context: OrchestratorContext = {
    userId,
    userName: user?.first_name || 'друг',
    isFirstContact: conversationHistory.length === 0,
  };

  // Choose orchestrator based on dynamic feature flag (with 60s cache)
  const currentUseMultiAgent = await isFeatureEnabled('multi_agent', USE_MULTI_AGENT);

  const result = currentUseMultiAgent
    ? await multiAgentOrchestrator.orchestrate(message, context)
    : await agentOrchestratorV5.orchestrate(
        message,
        context,
        conversationHistory as Array<{
          role: 'user' | 'assistant' | 'system';
          content: string;
          timestamp: Date;
        }>
      );

  // 7. Save History & Pending Actions
  if (kv) {
    try {
      if (result.message) {
        conversationHistory.push({ role: 'user', content: message });
        conversationHistory.push({ role: 'assistant', content: result.message });
        await kv.set(historyKey, conversationHistory.slice(-20), { ex: 86400 });
      }

      if (result.actions && result.actions.length > 0) {
        // Handle pending actions (store in different key for V5 confirmation handler)
        // For now, implementing basic storage
        const action = result.actions[0];
        const taskId = `task_v5_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await kv.set(
          `pending:v5:${userId}`,
          {
            type: action.type,
            taskId,
            details: action.details || {},
            summary: action.summary,
            created_at: new Date().toISOString(),
          },
          { ex: 3600 }
        );
        // Inject taskId
        Object.assign(result.actions[0], { taskId });
      }
    } catch (e) {
      console.warn('[Agent V5] KV Save failed:', e);
    }
  }

  // 8. Metrics
  const metrics = createAgentMetrics({
    userId,
    userMessage: message,
    model: 'v5-orchestrator',
    tokensUsed: result.tokensUsed || 0,
    responseTime: 0, // Need to measure
    toolsUsed: [], // V5 result doesn't explicitly return list of tools used in final obj yet
    hadError: false,
  });
  logAgentMetrics(metrics).catch(() => {});

  // 9. Response
  return res.json({
    success: true, // V5 usually succeeds with a message even on error
    message: result.message,
    links: result.links,
    actions: result.actions,
    metadata: {
      version: '5.0.0',
      tokensUsed: result.tokensUsed,
    },
  });
}

/**
 * V5 Agent Confirmation Handler
 * Handles user confirmation/rejection of actions proposed by V5 Agent
 */
export async function handleAgentV5Confirm(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const { confirmed, taskId } = req.body;

  if (!confirmed) {
    return res.json({
      success: true,
      message: '👍 Операция отменена.',
      executed: false,
    });
  }

  // 1. Authentication
  let userId: number;
  const isAdmin = await verifyAdminAccessAsync(req);
  const bypassTelegramId = req.body?.telegramId || req.query?.telegramId;

  if (isAdmin && bypassTelegramId) {
    userId = parseInt(bypassTelegramId as string);
  } else {
    const auth = extractTelegramAuth(req);
    if (auth.success === false) {
      const authFail = auth as { success: false; error: string; statusCode: number };
      return res.status(authFail.statusCode).json({ error: authFail.error, code: 'AUTH_FAILED' });
    }
    userId = auth.context.userId;
  }

  // 2. Load Pending Action from KV
  const kv = await getKVClient();
  if (!kv) {
    return res.status(500).json({ error: 'KV offline' });
  }

  const pendingKey = `pending:v5:${userId}`;
  const pendingAction = (await kv.get(pendingKey)) as PendingAction | null;

  if (!pendingAction) {
    return res.json({
      success: false,
      message: '❌ Действие не найдено или истекло. Попробуйте ещё раз.',
      executed: false,
    });
  }

  // 3. Verify taskId
  if (!taskId) {
    return res.status(400).json({
      success: false,
      message: '❌ Идентификатор задачи отсутствует.',
      executed: false,
    });
  }

  // SECURITY: Strict format validation for V5 task IDs
  if (!/^task_v5_\d+_[a-z0-9]{5}$/.test(taskId)) {
    return res.status(400).json({
      success: false,
      message: '❌ Неверный формат идентификатора задачи.',
      executed: false,
    });
  }

  if (pendingAction.taskId !== taskId) {
    return res.json({
      success: false,
      message: '❌ Идентификатор операции устарел. Попробуйте ещё раз.',
      executed: false,
    });
  }

  // 4. Execute Action
  try {
    const toolName = pendingAction.type;
    const details = pendingAction.details;

    console.log(`[Agent V5 Confirm] Executing tool: ${toolName} for user ${userId}`);

    // If it's a known tool name, use the registry
    if (toolRegistry.has(toolName)) {
      const result = await toolRegistry.execute(toolName, userId, details);

      if (result.success) {
        // Clear pending
        await kv.del(pendingKey);

        const data = result.data as Record<string, unknown>;
        return res.json({
          success: true,
          message: data?.message || '✅ Операция успешно выполнена.',
          executed: true,
          actionType: toolName,
          data: result.data,
        });
      } else {
        return res.json({
          success: false,
          message: `❌ Ошибка: ${result.error}`,
          executed: false,
        });
      }
    }

    // Fallback for types that might not be exact tool names (if any)
    throw new Error(`Неизвестный тип действия: ${toolName}`);
  } catch (error) {
    console.error('[Agent V5 Confirm] Error:', error);
    return res.json({
      success: false,
      message: `❌ Ошибка при выполнении: ${error instanceof Error ? error.message : String(error)}`,
      executed: false,
    });
  }
}

/**
 * V5 Status Handler
 */
export async function handleAgentV5Status(_req: VercelRequest, res: VercelResponse) {
  return res.json({
    available: true,
    version: USE_MULTI_AGENT ? 'v6.0.0-multiagent' : 'v5.1.0',
    architecture: USE_MULTI_AGENT ? 'Multi-Agent (5 Specialists)' : 'Professional Agent V5',
    rag_enabled: true,
    multiAgent: USE_MULTI_AGENT,
    specialists: USE_MULTI_AGENT
      ? [
          'ProductsSpecialist',
          'PricingSpecialist',
          'SentinelSpecialist',
          'AnalyticsSpecialist',
          'ChatSpecialist',
        ]
      : undefined,
  });
}

/**
 * Secure Handler
 */
export const handleAgentV5Secure = securityMiddleware(
  {
    auditEvent: 'agent.v5.execute',
    rateLimit: { limit: 20, windowSeconds: 60 },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleAgentV5 as any
);

/**
 * Secure version of handleAgentV5Confirm
 */
export const handleAgentV5ConfirmSecure = securityMiddleware(
  {
    auditEvent: 'agent.v5.confirm',
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleAgentV5Confirm as any
);

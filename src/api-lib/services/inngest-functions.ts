// ============================================
// NeuroGUARDIAN — Inngest Functions
// Production-ready async processing for MoE architecture
// Version: 2.0.0 | Date: December 2024
// ============================================

import { inngest } from '../lib/inngest.js';
import { classifyQuery, type IntentType, type RouteTarget } from '../agent/moe-router.js';
import { logger } from '../lib/logger.js';
import { sentinelService } from './sentinel-service.js';
import { memoryService } from './memory-service.js';
import { orchestrateV5 } from '../../agent/core/AgentOrchestratorV5.js';

// ============================================
// TYPES
// ============================================

interface MoEResult {
  success: boolean;
  source: RouteTarget | 'error';
  intent: IntentType;
  confidence: number;
  classifiedBy: 'local' | 'cloud' | 'fallback_rules';
  latencyMs: number;
  result: unknown;
  error?: string;
}

// ============================================
// MAIN MoE QUERY PROCESSOR
// ============================================

export const processMoEQuery = inngest.createFunction(
  {
    id: 'moe-query-processor',
    name: 'MoE Query Processor',
    retries: 2,
    concurrency: {
      limit: 10, // Max 10 concurrent queries
    },
  },
  { event: 'ai/query.received' },
  async ({ event, step }): Promise<MoEResult> => {
    const { userId, query, sessionId, marketplace, wbApiKey, ozonClientId, ozonApiKey } =
      event.data;
    const startTime = Date.now();

    logger.info('[Inngest] Processing MoE query', {
      userId,
      queryLength: query.length,
      sessionId,
    });

    // Step 1: Get conversation history from memory
    const history = await step.run('fetch-memory', async () => {
      try {
        const shortTerm = await memoryService.getSessionHistory(sessionId);
        const longTerm = await memoryService.searchRelatedContext(sessionId, query);

        return {
          shortTerm: Array.isArray(shortTerm) ? shortTerm : [],
          longTerm: Array.isArray(longTerm) ? longTerm : [],
        };
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        logger.warn('[Inngest] Memory fetch failed, continuing without context', {
          error: errorMessage,
        });
        return { shortTerm: [], longTerm: [] };
      }
    });

    // Step 2: Classify intent using MoE Router
    const classification = await step.run('classify-intent', async () => {
      return await classifyQuery(query);
    });

    logger.info('[Inngest] Intent classified', {
      intent: classification.intent,
      confidence: classification.confidence,
      routeTo: classification.routeTo,
      classifiedBy: classification.classifiedBy,
      latencyMs: classification.latencyMs,
    });

    // Step 3: Route to appropriate expert
    let result: unknown;

    if (classification.routeTo === 'local_stats') {
      // Handle stats queries locally (price checks, stock queries)
      result = await step.run('handle-local-stats', async () => {
        return await handleStatsQuery({
          userId,
          query,
          marketplace,
          wbApiKey,
          ozonClientId,
          ozonApiKey,
        });
      });
    } else if (classification.routeTo === 'local_chat') {
      // Handle simple chat queries
      result = await step.run('handle-local-chat', async () => {
        const historyMapped = history.shortTerm.map(m => ({
          role: m.role || 'user',
          content: m.content || '',
        }));
        return await handleChatQuery({
          userId,
          query,
          history: historyMapped,
        });
      });
    } else {
      // Handle complex queries via cloud LLM (orchestrateV4)
      result = await step.run('handle-cloud-complex', async () => {
        const historyMapped = history.shortTerm.map(m => ({
          role: m.role || 'user',
          content: m.content || '',
        }));
        return await handleComplexQuery({
          userId,
          query,
          marketplace,
          wbApiKey,
          ozonClientId,
          ozonApiKey,
          conversationHistory: historyMapped,
        });
      });
    }

    // Step 4: Save to memory for future context
    await step.run('save-memory', async () => {
      try {
        // Save this interaction to long-term memory
        await memoryService.saveToLongTerm(sessionId, query, {
          type: 'user_query',
          intent: classification.intent,
          timestamp: new Date().toISOString(),
        });

        // Trigger memory pack if needed
        await memoryService.packAndMigrate(sessionId);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        logger.warn('[Inngest] Memory save failed', { error: errorMessage });
      }
    });

    const totalLatency = Date.now() - startTime;
    logger.info('[Inngest] MoE query completed', {
      userId,
      intent: classification.intent,
      source: classification.routeTo,
      totalLatencyMs: totalLatency,
    });

    return {
      success: true,
      source: classification.routeTo,
      intent: classification.intent,
      confidence: classification.confidence,
      classifiedBy: classification.classifiedBy,
      latencyMs: totalLatency,
      result,
    };
  }
);

// ============================================
// BACKGROUND PRICE CHECK (Heavy Task)
// ============================================

export const backgroundPriceCheck = inngest.createFunction(
  {
    id: 'background-price-check',
    name: 'Background Price Check',
    retries: 3,
    concurrency: {
      limit: 5, // Limit concurrent price checks to avoid API rate limits
    },
  },
  { event: 'marketplace/price.check' },
  async ({
    event,
    step,
  }): Promise<{
    success: boolean;
    userId: number;
    threatsDetected: number;
    actionsTaken: number;
    errors: string[];
  }> => {
    const { userId, accountId } = event.data;

    logger.info('[Inngest] Starting background price check', { userId, accountId });

    // Run Sentinel service for this user
    const result = await step.run('run-sentinel', async () => {
      try {
        const sentinelResult = await sentinelService.runForUser(userId);
        return sentinelResult;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        logger.error('[Inngest] Sentinel run failed', {
          userId,
          error: errorMessage,
        });
        return {
          usersProcessed: 0,
          threatsDetected: 0,
          actionsTaken: 0,
          errors: [errorMessage],
        };
      }
    });

    logger.info('[Inngest] Background price check completed', {
      userId,
      threatsDetected: result.threatsDetected,
      actionsTaken: result.actionsTaken,
      errors: result.errors.length,
    });

    return {
      success: result.errors.length === 0,
      userId,
      threatsDetected: result.threatsDetected,
      actionsTaken: result.actionsTaken,
      errors: result.errors,
    };
  }
);

// ============================================
// SCHEDULED SENTINEL CYCLE
// ============================================

export const scheduledSentinelCycle = inngest.createFunction(
  {
    id: 'scheduled-sentinel-cycle',
    name: 'Scheduled Sentinel Cycle (30 min)',
  },
  { cron: '*/30 * * * *' }, // Every 30 minutes
  async ({
    step,
  }): Promise<{
    usersProcessed: number;
    threatsDetected: number;
    actionsTaken: number;
    errors: string[];
  }> => {
    logger.info('[Inngest] Starting scheduled Sentinel cycle');

    const result = await step.run('run-full-cycle', async () => {
      return await sentinelService.runCycle();
    });

    logger.info('[Inngest] Scheduled Sentinel cycle completed', {
      usersProcessed: result.usersProcessed,
      threatsDetected: result.threatsDetected,
      actionsTaken: result.actionsTaken,
      errors: result.errors?.length ?? 0,
    });

    return {
      usersProcessed: result.usersProcessed ?? 0,
      threatsDetected: result.threatsDetected ?? 0,
      actionsTaken: result.actionsTaken ?? 0,
      errors: result.errors ?? [],
    };
  }
);

// ============================================
// EXPERT HANDLERS
// ============================================

async function handleStatsQuery(params: {
  userId: number;
  query: string;
  marketplace?: 'WB' | 'Ozon' | 'all';
  wbApiKey?: string;
  ozonClientId?: string;
  ozonApiKey?: string;
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const { userId, query, marketplace } = params;

  logger.debug('[Inngest] Handling stats query', { userId, marketplace });

  // Use orchestrateV4 with stats-focused context
  // The orchestrator will determine the right tool to call

  try {
    const result = await orchestrateV5(query, {
      userId,
      isFirstContact: false,
      marketplace: marketplace === 'all' ? 'both' : marketplace || 'both',
    });

    return {
      success: result.success,
      data: {
        message: result.message,
        actions: result.actions,
        data: result.toolResults?.[0]?.data, // Heuristic: first tool result data
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function handleChatQuery(params: {
  userId: number;
  query: string;
  history: Array<{ role: string; content: string }>;
}): Promise<{ success: boolean; message: string }> {
  const { query } = params;
  const lowerQuery = query.toLowerCase();

  // Handle common chat patterns directly without LLM
  if (/^(привет|здравствуй|хай|hello|hi|hey)/.test(lowerQuery)) {
    return {
      success: true,
      message:
        'Привет! Я NeuroGUARDIAN — ваш AI-помощник для управления маркетплейсами. ' +
        'Я могу проверить цены, защитить от демпинга, проанализировать продажи и многое другое. ' +
        'Чем могу помочь?',
    };
  }

  if (/^(кто ты|что ты|что умеешь|help|помощь)/.test(lowerQuery)) {
    return {
      success: true,
      message:
        '🤖 **NeuroGUARDIAN** — AI-система для управления маркетплейсами\n\n' +
        '**Мои возможности:**\n' +
        '• Мониторинг цен на Wildberries и Ozon\n' +
        '• Автоматическая защита от демпинга (Sentinel)\n' +
        '• ABC-анализ товаров\n' +
        '• Прогноз остатков\n' +
        '• Массовое обновление цен\n\n' +
        '**Примеры запросов:**\n' +
        '• "Проверь цены на WB"\n' +
        '• "Покажи остатки"\n' +
        '• "Сделай анализ прибыльности"',
    };
  }

  // For other chat queries, give a general helpful response
  return {
    success: true,
    message:
      'Понял вас. Если вам нужна помощь с маркетплейсами ' +
      '(цены, остатки, анализ), просто скажите что нужно сделать.',
  };
}

async function handleComplexQuery(params: {
  userId: number;
  query: string;
  marketplace?: 'WB' | 'Ozon' | 'all';
  wbApiKey?: string;
  ozonClientId?: string;
  ozonApiKey?: string;
  conversationHistory: Array<{ role: string; content: string }>;
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const { userId, query, marketplace, conversationHistory } = params;

  logger.debug('[Inngest] Handling complex query via cloud', { userId });

  try {
    const result = await orchestrateV5(
      query,
      {
        userId,
        isFirstContact: false,
        marketplace: marketplace === 'all' ? 'both' : marketplace || 'both',
      },
      conversationHistory.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        timestamp: new Date(),
      }))
    );

    return {
      success: result.success,
      data: {
        message: result.message,
        actions: result.actions,
        links: result.links,
        data: result.toolResults?.[0]?.data,
        tokensUsed: result.tokensUsed,
        toolsCalled: result.toolsCalled,
      },
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    logger.error('[Inngest] Complex query failed', { error: errorMessage });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================
// UTILITY: Trigger MoE Query from API
// ============================================

export async function triggerMoEQuery(params: {
  userId: number;
  query: string;
  sessionId: string;
  marketplace?: 'WB' | 'Ozon' | 'all';
  wbApiKey?: string;
  ozonClientId?: string;
  ozonApiKey?: string;
}): Promise<{ eventId: string }> {
  const event = await inngest.send({
    name: 'ai/query.received',
    data: params,
  });

  return { eventId: event.ids[0] };
}

export async function triggerPriceCheck(params: {
  userId: number;
  accountId?: number;
  items?: string[];
}): Promise<{ eventId: string }> {
  const event = await inngest.send({
    name: 'marketplace/price.check',
    data: params,
  });

  return { eventId: event.ids[0] };
}

// ============================================
// NeuroGUARDIAN — Agent Orchestrator v5
// Professional multi-agent architecture
// Version: 5.0.0 | Date: January 2026
// ============================================

import type {
  OrchestratorContext,
  OrchestratorResult,
  AgentPlan,
  ToolResult,
  ChatMessage,
} from '../../core/types/agent.types.js';

import { stateManager } from './StateManager.js';
import { contextResolver } from './ContextResolver.js';
import { promptBuilder } from './PromptBuilder.js';
import { toolRegistry } from '../execution/ToolRegistry.js';

// ============================================
// TYPES
// ============================================

interface PhaseMetrics {
  planningTimeMs: number;
  executionTimeMs: number;
  answeringTimeMs: number;
}

// ============================================
// ORCHESTRATOR V5
// ============================================

/**
 * Agent Orchestrator v5
 *
 * Professional multi-agent architecture following course principles:
 * 1. Dynamic Prompt Assembly
 * 2. State Management
 * 3. Context Resolution
 * 4. Memory Integration
 *
 * Flow:
 * 1. Load State → Get user state from DB
 * 2. Resolve Context → Handle "2500" as cost_price answer
 * 3. Build Prompt → Dynamic assembly
 * 4. Plan → LLM decides which tools
 * 5. Execute → Run tools
 * 6. Answer → LLM generates response
 * 7. Validate → Check links, facts
 * 8. Save State → Persist for next message
 */
export class AgentOrchestratorV5 {
  // TODO: Integrate MemoryService in Phase 3
  // private memoryService: MemoryServiceInterface | null = null;

  /**
   * Main entry point
   */
  async orchestrate(
    message: string,
    context: OrchestratorContext,
    conversationHistory?: ChatMessage[]
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    let tokensUsed = 0;
    const metrics: PhaseMetrics = {
      planningTimeMs: 0,
      executionTimeMs: 0,
      answeringTimeMs: 0,
    };

    console.log(`[Orchestrator V5] Starting for user ${context.userId}`);

    try {
      // ========================================
      // PHASE 0: Load State & Resolve Context
      // ========================================
      const userState = await stateManager.getState(context.userId);
      const resolvedContext = await contextResolver.resolve(context.userId, message);

      console.log(`[Orchestrator V5] Context resolved:`, {
        isContextual: resolvedContext.isContextualResponse,
        type: resolvedContext.responseType,
        directExecution: !!resolvedContext.directExecution,
      });

      // ========================================
      // SHORT-CIRCUIT: Direct Execution
      // ========================================
      if (resolvedContext.directExecution) {
        // Contextual response with known tool → execute directly
        const execStart = Date.now();

        const toolResult = await toolRegistry.execute(
          resolvedContext.directExecution.tool,
          context.userId,
          resolvedContext.directExecution.args
        );

        metrics.executionTimeMs = Date.now() - execStart;

        // Clear awaiting state
        await stateManager.clearAwaitingInput(context.userId);

        // Generate answer from tool result
        const answerStart = Date.now();
        const answer = await this.generateAnswer(
          resolvedContext.enrichedMessage,
          [{ ...toolResult, tool: resolvedContext.directExecution.tool }],
          userState,
          conversationHistory
        );
        metrics.answeringTimeMs = Date.now() - answerStart;
        tokensUsed += answer.tokensUsed;

        return this.buildResult(
          answer.message,
          answer.links,
          answer.actions,
          [resolvedContext.directExecution.tool],
          [toolResult],
          metrics,
          startTime,
          tokensUsed
        );
      }

      // ========================================
      // PHASE 1: Simple Intent Check
      // ========================================
      const simpleResponse = await this.handleSimpleIntent(message, context, userState);

      if (simpleResponse) {
        return this.buildSimpleResult(simpleResponse, startTime);
      }

      // ========================================
      // PHASE 2: Planning
      // ========================================
      const planStart = Date.now();

      const recentHistory = conversationHistory?.slice(-6) || [];
      const plannerPrompt = promptBuilder.buildPlannerPrompt({
        userState,
        recentHistory,
        isFirstContact: context.isFirstContact,
      });

      const planResult = await this.callPlanner(plannerPrompt, resolvedContext.enrichedMessage);

      metrics.planningTimeMs = Date.now() - planStart;
      tokensUsed += planResult.tokensUsed;

      if (!planResult.success || !planResult.plan) {
        return this.buildErrorResult(
          planResult.error || 'Не удалось составить план',
          metrics,
          startTime,
          tokensUsed
        );
      }

      const plan = planResult.plan;
      console.log(`[Orchestrator V5] Plan created:`, {
        tools: plan.tools.map(t => t.tool),
        requiresConfirmation: plan.requiresConfirmation,
      });

      // ========================================
      // PHASE 3: Execution
      // ========================================
      const execStart = Date.now();

      const toolResults = await this.executeTools(plan, context.userId);

      metrics.executionTimeMs = Date.now() - execStart;

      // ========================================
      // PHASE 4: Answering
      // ========================================
      const answerStart = Date.now();

      const answer = await this.generateAnswer(
        message,
        toolResults,
        userState,
        conversationHistory
      );

      metrics.answeringTimeMs = Date.now() - answerStart;
      tokensUsed += answer.tokensUsed;

      // ========================================
      // PHASE 5: State Update
      // ========================================
      await this.updateStateAfterResponse(context.userId, message, plan, toolResults);

      // ========================================
      // Build Result
      // ========================================
      return this.buildResult(
        answer.message,
        answer.links,
        answer.actions,
        plan.tools.map(t => t.tool),
        toolResults,
        metrics,
        startTime,
        tokensUsed,
        plan
      );
    } catch (error) {
      console.error('[Orchestrator V5] Fatal error:', error);
      return {
        success: false,
        message: 'Произошла ошибка. Попробуй ещё раз.',
        planningTimeMs: metrics.planningTimeMs,
        executionTimeMs: metrics.executionTimeMs,
        answeringTimeMs: metrics.answeringTimeMs,
        totalTimeMs: Date.now() - startTime,
        tokensUsed,
        toolsCalled: [],
      };
    }
  }

  /**
   * Handle simple intents that don't need tools
   */
  private async handleSimpleIntent(
    message: string,
    context: OrchestratorContext,
    state: ReturnType<typeof stateManager.getState> extends Promise<infer T> ? T : never
  ): Promise<string | null> {
    const lower = message.toLowerCase().trim();

    // Greetings
    if (/^(привет|здравствуй|добрый|хай|хелло|hi|hello|hey)/.test(lower)) {
      const name = context.userName || 'друг';

      if (!state.hasWbKey && !state.hasOzonKey) {
        return `👋 Привет, ${name}!\n\n✅ **Подтверждаю — я вступил в должность управляющего вашим магазином!**\n\nМеня зовут Виктор. Чтобы начать работу, мне нужен доступ к вашему магазину.\n\n📌 Перейди в ⚙️ Настройки и подключи API-ключ Wildberries или Ozon.`;
      }

      return `👋 Привет, ${name}!\n\n📊 Вижу ваш магазин: **${state.productsCount}** товаров на ${state.marketplace || 'маркетплейсе'}.\n\nЧем могу помочь? Могу показать продажи, рассчитать прибыль или проверить конкурентов.`;
    }

    // Thanks
    if (/^(спасибо|благодарю|thanks|thank you)/.test(lower)) {
      return '😊 Всегда рад помочь! Обращайся, если что-то понадобится.';
    }

    // Help
    if (/^(помощь|help|что умеешь|\?)$/.test(lower)) {
      return `🤖 **Что я умею:**\n\n📊 **Аналитика:** продажи, прибыль, ABC-анализ\n🛡️ **Защита:** слежу за ценами 24/7\n📦 **Товары:** остатки, прогноз закончатся\n🔍 **Конкуренты:** проверяю цены\n\nПросто спроси — я разберусь!`;
    }

    return null;
  }

  /**
   * Call planner LLM
   */
  private async callPlanner(
    systemPrompt: string,
    userMessage: string
  ): Promise<{ success: boolean; plan?: AgentPlan; error?: string; tokensUsed: number }> {
    try {
      const { callLLMWithFallback } = await import('../../api-lib/agent/orchestrator-v4.js');

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ];

      const result = await callLLMWithFallback(messages, {
        temperature: 0.1,
        maxTokens: 500,
      });

      // Parse JSON
      const parsed = JSON.parse(result.content);

      return {
        success: true,
        plan: {
          reasoning: parsed.reasoning || '',
          tools: parsed.tools || [],
          requiresConfirmation: parsed.requires_confirmation || false,
        },
        tokensUsed: result.tokensUsed,
      };
    } catch (error) {
      console.error('[Orchestrator V5] Planner error:', error);
      return {
        success: false,
        error: 'Не удалось обработать запрос',
        tokensUsed: 0,
      };
    }
  }

  /**
   * Execute tools from plan
   */
  private async executeTools(
    plan: AgentPlan,
    userId: number
  ): Promise<Array<ToolResult & { tool: string }>> {
    const results: Array<ToolResult & { tool: string }> = [];

    // Execute in parallel
    const promises = plan.tools.map(async planned => {
      try {
        const result = await toolRegistry.execute(planned.tool, userId, planned.args);
        return { ...result, tool: planned.tool };
      } catch (error) {
        return {
          tool: planned.tool,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const executed = await Promise.all(promises);
    results.push(...executed);

    return results;
  }

  /**
   * Generate answer from tool results
   */
  private async generateAnswer(
    originalMessage: string,
    toolResults: Array<ToolResult & { tool: string }>,
    userState: Awaited<ReturnType<typeof stateManager.getState>>,
    conversationHistory?: ChatMessage[]
  ): Promise<{
    message: string;
    links?: OrchestratorResult['links'];
    actions?: OrchestratorResult['actions'];
    tokensUsed: number;
  }> {
    try {
      const { callLLMWithFallback } = await import('../../api-lib/agent/orchestrator-v4.js');

      const systemPrompt = promptBuilder.buildAnswererPrompt({
        userState,
        recentHistory: conversationHistory || [],
      });

      const userMessage = `Пользователь спросил: "${originalMessage}"

Результаты инструментов:
${JSON.stringify(toolResults, null, 2)}

Сформируй ответ в формате JSON.`;

      const result = await callLLMWithFallback(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        { temperature: 0.3, maxTokens: 1500 }
      );

      const parsed = JSON.parse(result.content);

      return {
        message: parsed.message || 'Готово!',
        links: parsed.links,
        actions: parsed.actions?.map(
          (a: {
            type: string;
            summary: string;
            details_json?: string;
            affected_count?: number;
          }) => ({
            type: a.type,
            summary: a.summary,
            details: a.details_json ? JSON.parse(a.details_json) : {},
            affectedCount: a.affected_count || 0,
          })
        ),
        tokensUsed: result.tokensUsed,
      };
    } catch (error) {
      console.error('[Orchestrator V5] Answerer error:', error);

      // Fallback: generate simple answer
      const successfulTools = toolResults.filter(r => r.success);
      if (successfulTools.length > 0) {
        return {
          message: `Готово! Выполнено ${successfulTools.length} действий.`,
          tokensUsed: 0,
        };
      }

      return {
        message: 'Не удалось выполнить запрос. Попробуй перефразировать.',
        tokensUsed: 0,
      };
    }
  }

  /**
   * Update state after response
   */
  private async updateStateAfterResponse(
    userId: number,
    query: string,
    _plan: AgentPlan,
    toolResults: Array<ToolResult & { tool: string }>
  ): Promise<void> {
    // Record query
    await stateManager.recordQuery(userId, query);

    // Track mentioned products
    const productIds: string[] = [];
    for (const result of toolResults) {
      if (result.success && result.data) {
        const data = result.data as { products?: Array<{ product_id: string }> };
        if (data.products) {
          productIds.push(...data.products.map(p => p.product_id));
        }
      }
    }

    if (productIds.length > 0) {
      await stateManager.trackMentionedProducts(userId, productIds);
    }
  }

  /**
   * Build success result
   */
  private buildResult(
    message: string,
    links: OrchestratorResult['links'],
    actions: OrchestratorResult['actions'],
    toolsCalled: string[],
    toolResults: ToolResult[],
    metrics: PhaseMetrics,
    startTime: number,
    tokensUsed: number,
    plan?: AgentPlan
  ): OrchestratorResult {
    return {
      success: true,
      message,
      links,
      actions,
      planningTimeMs: metrics.planningTimeMs,
      executionTimeMs: metrics.executionTimeMs,
      answeringTimeMs: metrics.answeringTimeMs,
      totalTimeMs: Date.now() - startTime,
      tokensUsed,
      toolsCalled,
      plan,
      toolResults,
    };
  }

  /**
   * Build simple result (no tools)
   */
  private buildSimpleResult(message: string, startTime: number): OrchestratorResult {
    return {
      success: true,
      message,
      planningTimeMs: 0,
      executionTimeMs: 0,
      answeringTimeMs: Date.now() - startTime,
      totalTimeMs: Date.now() - startTime,
      tokensUsed: 0,
      toolsCalled: [],
    };
  }

  /**
   * Build error result
   */
  private buildErrorResult(
    error: string,
    metrics: PhaseMetrics,
    startTime: number,
    tokensUsed: number
  ): OrchestratorResult {
    return {
      success: false,
      message: error,
      planningTimeMs: metrics.planningTimeMs,
      executionTimeMs: metrics.executionTimeMs,
      answeringTimeMs: metrics.answeringTimeMs,
      totalTimeMs: Date.now() - startTime,
      tokensUsed,
      toolsCalled: [],
    };
  }
}

// Memory service interface (for future use in Phase 3)
// interface MemoryServiceInterface {
//   getSessionHistory(sessionId: string): Promise<ChatMessage[]>;
//   searchRelatedContext(sessionId: string, query: string): Promise<string[]>;
// }

// Singleton instance
export const agentOrchestratorV5 = new AgentOrchestratorV5();

// Export orchestrate function for backward compatibility
export async function orchestrateV5(
  message: string,
  context: OrchestratorContext,
  conversationHistory?: ChatMessage[]
): Promise<OrchestratorResult> {
  return agentOrchestratorV5.orchestrate(message, context, conversationHistory);
}

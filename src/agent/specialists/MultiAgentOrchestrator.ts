// ============================================
// NeuroGUARDIAN — Multi-Agent Orchestrator
// Routes queries to specialized agents
// Version: 1.0.0 | Date: January 2026
// ============================================

import type { OrchestratorContext, OrchestratorResult } from '../../core/types/agent.types.js';
import { classifyIntent, type ClassificationResult } from './IntentClassifier.js';
import { getSpecialist, type SpecialistContext } from './index.js';
import { stateManager } from '../core/StateManager.js';
import { memoryManager } from '../core/MemoryManager.js';
import { experienceLearning } from '../core/ExperienceLearning.js';
import { responseValidator } from '../core/ResponseValidator.js';
import { logger } from '../../api-lib/lib/logger.js';

export interface MultiAgentResult extends OrchestratorResult {
  intent: ClassificationResult;
  specialist: string;
  _debug?: {
    error: string;
    at: string;
  };
}

/**
 * Multi-Agent Orchestrator
 *
 * Flow:
 * 1. Classify intent (Gemini Flash) → 5 categories
 * 2. Route to specialist agent
 * 3. Specialist executes with focused tools
 * 4. Return formatted response
 */
export class MultiAgentOrchestrator {
  /**
   * Main entry point
   */
  async orchestrate(message: string, context: OrchestratorContext): Promise<MultiAgentResult> {
    const startTime = Date.now();
    const planStart = Date.now();

    try {
      // 1. Classify intent
      const intent = await classifyIntent(message);
      const planningTimeMs = Date.now() - planStart;

      logger.info('[MultiAgent] Intent classified', {
        category: intent.category,
        confidence: intent.confidence,
        latencyMs: intent.latencyMs,
      });

      // 2. Get user state
      const userState = await stateManager.getState(context.userId);

      // 3. Build specialist context
      const specialistContext: SpecialistContext = {
        userId: context.userId,
        userState: {
          marketplace: userState.marketplace,
          hasApiKeys: userState.hasApiKeys,
          productsCount: userState.productsCount || 0,
          subscriptionTier: userState.subscriptionTier || 'free',
        },
      };

      // 4. Get specialist for this intent
      const specialist = getSpecialist(intent.category);
      logger.info('[MultiAgent] Routing to specialist', {
        specialist: specialist.name,
        tools: specialist.tools,
      });

      // 5. Execute specialist
      const execStart = Date.now();
      const result = await specialist.execute(message, specialistContext);
      const executionTimeMs = Date.now() - execStart;

      // 6. Validate Response (Guardrails)
      let finalMessage = result.message;
      try {
        const validation = await responseValidator.validate(result.message, {
          userQuery: message,
          toolResults: result.toolResults?.map((t, i) => ({
            tool: result.toolsCalled[i] || 'unknown',
            success: t.success,
            data: t.data,
          })),
          marketplace:
            userState.marketplace === 'WB'
              ? 'wb'
              : userState.marketplace === 'Ozon'
                ? 'ozon'
                : undefined,
        });

        if (!validation.isValid && validation.correctedResponse) {
          finalMessage = validation.correctedResponse;
          logger.info('[MultiAgent] Response corrected by validator', { score: validation.score });
        }
      } catch (valError) {
        logger.warn('[MultiAgent] Validation skipped due to error', { error: valError });
      }

      // 7. Extract Links
      const links = this.extractLinks(finalMessage);

      // 8. Experience Learning & Memory
      try {
        // Save to memory
        await memoryManager.saveMessage(context.userId, 'user', message);
        await memoryManager.saveMessage(context.userId, 'assistant', finalMessage);

        // Analyze for learning (Active Support)
        const history = await memoryManager.getRecentHistory(context.userId, 2);
        const previousAgentMessage = history.find(m => m.role === 'assistant')?.content;

        await experienceLearning.analyzeInteraction(
          context.userId,
          message,
          finalMessage,
          previousAgentMessage
        );
      } catch (memError) {
        logger.warn('[MultiAgent] Memory/Learning failed', { error: memError });
      }

      // 9. Build final result
      const totalTimeMs = Date.now() - startTime;

      return {
        success: result.success,
        message: finalMessage,
        toolsCalled: result.toolsCalled,
        toolResults: result.toolResults,
        tokensUsed: result.tokensUsed + (intent.classifiedBy === 'llm' ? 500 : 0),
        planningTimeMs,
        executionTimeMs,
        answeringTimeMs: 0,
        totalTimeMs,
        intent,
        specialist: specialist.name,
        links,
        actions: result.requiresConfirmation
          ? [
              {
                type: 'confirm',
                summary: 'Требуется подтверждение',
                details: {},
                affectedCount: 1,
              },
            ]
          : undefined,
      };
    } catch (error) {
      const totalTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error('[MultiAgent] Orchestration failed', {
        error: errorMessage,
        stack: errorStack?.split('\n').slice(0, 5).join('\n'),
        totalTimeMs,
        userId: context.userId,
      });

      // Return error details for debugging (production should hide this)
      const isDev = process.env.NODE_ENV !== 'production';

      return {
        success: false,
        message: isDev
          ? `Ошибка: ${errorMessage}`
          : 'Произошла ошибка при обработке запроса. Попробуйте ещё раз.',
        toolsCalled: [],
        toolResults: [],
        tokensUsed: 0,
        planningTimeMs: 0,
        executionTimeMs: 0,
        answeringTimeMs: 0,
        totalTimeMs,
        intent: {
          category: 'CHAT',
          confidence: 0,
          reasoning: 'Error fallback',
          entities: {},
          latencyMs: 0,
          classifiedBy: 'rules',
        },
        specialist: 'ChatSpecialist',
        // Debug info (always include to help diagnose production issues)
        _debug: {
          error: errorMessage,
          at: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Simple orchestration for quick responses (rule-based only)
   */
  async orchestrateQuick(message: string, context: OrchestratorContext): Promise<MultiAgentResult> {
    const startTime = Date.now();

    // Use sync classification for speed
    const { classifyIntentSync } = await import('./IntentClassifier.js');
    const intent = classifyIntentSync(message);
    const planningTimeMs = Date.now() - startTime;

    const userState = await stateManager.getState(context.userId);

    const specialistContext: SpecialistContext = {
      userId: context.userId,
      userState: {
        marketplace: userState.marketplace,
        hasApiKeys: userState.hasApiKeys,
        productsCount: userState.productsCount || 0,
        subscriptionTier: userState.subscriptionTier || 'free',
      },
    };

    const execStart = Date.now();
    const specialist = getSpecialist(intent.category);
    const result = await specialist.execute(message, specialistContext);
    const executionTimeMs = Date.now() - execStart;

    return {
      success: result.success,
      message: result.message,
      toolsCalled: result.toolsCalled,
      toolResults: result.toolResults,
      tokensUsed: result.tokensUsed,
      planningTimeMs,
      executionTimeMs,
      answeringTimeMs: 0,
      totalTimeMs: Date.now() - startTime,
      intent,
      specialist: specialist.name,
    };
  }

  private extractLinks(message: string): OrchestratorResult['links'] {
    const links: NonNullable<OrchestratorResult['links']> = [];

    // Extract WB links
    const wbMatches = message.match(/https:\/\/www\.wildberries\.ru\/catalog\/\d+/g);
    if (wbMatches) {
      wbMatches.forEach(url => {
        links.push({ title: 'Открыть на WB', url, source: 'WB' });
      });
    }

    // Extract Ozon links
    const ozonMatches = message.match(/https:\/\/www\.ozon\.ru\/product\/[^\s]+/g);
    if (ozonMatches) {
      ozonMatches.forEach(url => {
        links.push({ title: 'Открыть на Ozon', url, source: 'Ozon' });
      });
    }

    return links.length > 0 ? links : undefined;
  }
}

// Singleton
export const multiAgentOrchestrator = new MultiAgentOrchestrator();

/**
 * Export orchestrate function for API handlers
 */
export async function orchestrateMultiAgent(
  message: string,
  context: OrchestratorContext
): Promise<MultiAgentResult> {
  return multiAgentOrchestrator.orchestrate(message, context);
}

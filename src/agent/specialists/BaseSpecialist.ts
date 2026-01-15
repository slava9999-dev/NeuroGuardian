// ============================================
// NeuroGUARDIAN — Base Specialist
// Abstract class for all specialist agents
// Version: 1.0.0 | Date: January 2026
// ============================================

import type { ToolDefinition, ToolResult } from '../../core/types/agent.types.js';
import type { LLMMessage } from '../../infrastructure/llm/LLMProvider.js';
import { GeminiProvider } from '../../infrastructure/llm/GeminiProvider.js';
import { toolRegistry } from '../execution/ToolRegistry.js';
import { logger } from '../../api-lib/lib/logger.js';

export interface SpecialistResult {
  success: boolean;
  message: string;
  toolsCalled: string[];
  toolResults: ToolResult[];
  tokensUsed: number;
  latencyMs: number;
  requiresConfirmation?: boolean;
  pendingAction?: {
    type: string;
    params: Record<string, unknown>;
  };
}

export interface SpecialistContext {
  userId: number;
  userState: {
    marketplace: 'WB' | 'Ozon' | 'both' | null;
    hasApiKeys: boolean;
    productsCount: number;
    subscriptionTier: 'free' | 'basic' | 'pro';
  };
  relevantData?: string; // Pre-fetched data context
  query?: string; // Current user query for RAG
}

/**
 * Base class for all specialist agents
 *
 * Each specialist:
 * - Has a focused set of tools (3-5 max)
 * - Uses compact, task-specific prompts
 * - Operates with minimal context (~2K tokens)
 */
export abstract class BaseSpecialist {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly tools: string[]; // Tool names this specialist can use
  abstract readonly systemPrompt: string;

  protected llm: GeminiProvider;
  protected model: 'gemini-2.5-flash' | 'gemini-2.5-pro' = 'gemini-2.5-flash';

  constructor(model?: 'gemini-2.5-flash' | 'gemini-2.5-pro') {
    this.model = model || 'gemini-2.5-flash';
    this.llm = new GeminiProvider({ model: this.model });
  }

  /**
   * Build context string for this specialist
   * Override in subclasses for specialist-specific context
   */
  abstract buildContext(context: SpecialistContext): Promise<string>;

  /**
   * Execute the specialist with the given query
   */
  async execute(query: string, context: SpecialistContext): Promise<SpecialistResult> {
    const startTime = Date.now();
    let tokensUsed = 0;

    try {
      // 1. Build compact context
      context.query = query;
      const contextStr = await this.buildContext(context);

      // 2. Build tool definitions for LLM
      const toolDefs = this.getToolDefinitions();

      // 3. Build messages
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: `${this.systemPrompt}\n\n${contextStr}`,
        },
        {
          role: 'user',
          content: query,
        },
      ];

      // 4. Call LLM with tools
      const llmTools = toolDefs.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: this.zodToJsonSchema(t.schema),
        },
      }));

      const response = await this.llm.completeWithTools(messages, llmTools, {
        model: this.model,
        temperature: 0.1,
        maxTokens: 1500,
      });

      tokensUsed += response.tokensUsed;

      // 5. Execute tools if called
      const toolResults: (ToolResult & { tool: string })[] = [];

      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          const toolName = toolCall.function?.name;
          const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');

          if (toolName && this.tools.includes(toolName)) {
            try {
              const result = await toolRegistry.execute(toolName, context.userId, toolArgs);
              toolResults.push({ ...result, tool: toolName });
            } catch (error) {
              toolResults.push({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                tool: toolName,
              });
            }
          }
        }
      }

      // 6. Generate final response if tools were called
      let finalMessage = response.content;

      if (toolResults.length > 0 && !response.content) {
        const answerResponse = await this.llm.complete([
          ...messages,
          {
            role: 'assistant',
            content: `Результаты выполнения:\n${JSON.stringify(toolResults, null, 2)}`,
          },
          {
            role: 'user',
            content: 'Сформируй понятный ответ пользователю на основе результатов.',
          },
        ]);

        finalMessage = answerResponse.content;
        tokensUsed += answerResponse.tokensUsed;
      }

      const latencyMs = Date.now() - startTime;

      logger.info(`[${this.name}] Execution completed`, {
        toolsCalled: toolResults.map(r => r.tool),
        tokensUsed,
        latencyMs,
      });

      return {
        success: true,
        message: finalMessage,
        toolsCalled: toolResults.map(r => r.tool),
        toolResults,
        tokensUsed,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      logger.error(`[${this.name}] Execution failed`, {
        error: error instanceof Error ? error.message : String(error),
        latencyMs,
      });

      return {
        success: false,
        message: `Произошла ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`,
        toolsCalled: [],
        toolResults: [],
        tokensUsed,
        latencyMs,
      };
    }
  }

  /**
   * Get tool definitions for this specialist
   */
  protected getToolDefinitions(): ToolDefinition[] {
    return this.tools
      .map(name => toolRegistry.get(name))
      .filter((t): t is ToolDefinition => t !== undefined);
  }

  /**
   * Convert Zod schema to JSON Schema for LLM tools
   */
  protected zodToJsonSchema(schema: unknown): object {
    // Simplified conversion - in production use zod-to-json-schema
    try {
      if (schema && typeof schema === 'object' && 'shape' in schema) {
        const shape = (schema as { shape: Record<string, unknown> }).shape;
        const properties: Record<string, { type: string; description?: string }> = {};
        const required: string[] = [];

        for (const [key, value] of Object.entries(shape)) {
          if (value && typeof value === 'object') {
            properties[key] = { type: 'string' }; // Simplified
            if ('description' in value) {
              properties[key].description = String(value.description);
            }
            // Check if optional
            if (!('isOptional' in value && value.isOptional)) {
              required.push(key);
            }
          }
        }

        return {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined,
        };
      }
    } catch (e) {
      logger.warn(`[${this.name}] Failed to convert schema`, { error: e });
    }

    return { type: 'object', properties: {} };
  }
}

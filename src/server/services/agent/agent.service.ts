// Basic polyfill for fetch if needed in Node envs (usually global in Vercel/Node 18+)
// import fetch from 'node-fetch';

import { getKVClient } from '../../core/db';
import type { AgentResult } from '../../core/types';
import { logger } from '../../utils/logger';
import { AGENT_TOOLS } from './agent.tools';
import { productService } from '../product/product.service';
import { analyticsService } from '../analytics/analytics.service';
import { type User } from '../../schemas/user.schema';
import {
  GetProductsArgsSchema,
  CalculateUnitEconomicsArgsSchema,
  GetSalesStatsArgsSchema,
} from '../../schemas/agent.schema';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export class AgentService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
  }

  /**
   * Main entry point for Agent interaction
   */
  async processRequest(
    userId: number,
    userMessage: string,
    userContext: Partial<User>
  ): Promise<AgentResult> {
    if (!this.apiKey) {
      return { success: false, content: 'OpenAI API Key not configured' };
    }

    const kv = getKVClient();
    const historyKey = `chat:${userId}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let history: any[] = [];

    // 1. Load History
    if (kv) {
      try {
        const saved = await kv.get(historyKey);
        if (Array.isArray(saved)) history = saved;
      } catch {
        logger.warn('Failed to load history', { userId });
      }
    }

    // 2. Build Context System Prompt
    const systemPrompt = this.buildSystemPrompt(userContext);

    // 3. Prepare Messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10), // Limit context
      { role: 'user', content: userMessage },
    ];

    const startTime = Date.now();

    // 4. Call OpenAI (Phase 1: Decision)
    const response = await this.callOpenAI(messages, AGENT_TOOLS, 'auto');
    let finalContent = response.content;
    const toolsUsed: string[] = [];

    // 5. Handle Tool Calls
    if (response.toolCalls && response.toolCalls.length > 0) {
      // Append assistant's intent to call tool to history (temporary)
      messages.push(response.rawMessage);

      for (const toolCall of response.toolCalls) {
        const result = await this.executeTool(
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments),
          userId,
          userContext
        );

        // Add tool result to conversation
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
        toolsUsed.push(toolCall.function.name);
      }

      // 6. Call OpenAI again (Phase 2: Final Response)
      const finalResponse = await this.callOpenAI(messages);
      finalContent = finalResponse.content;
    }

    // 7. Save History
    if (kv && finalContent) {
      history.push({ role: 'user', content: userMessage });
      history.push({ role: 'assistant', content: finalContent });
      await kv.set(historyKey, history.slice(-20), { ex: 86400 });
    }

    return {
      success: true,
      content: finalContent || 'Error generating response',
      metadata: {
        executionTime: Date.now() - startTime,
        model: 'gpt-4o',
        toolsUsed,
        tokensUsed: response.usage?.total_tokens || 0,
      },
    };
  }

  private buildSystemPrompt(user: Partial<User>): string {
    return `Ты — NeuroAgent, умный AI-ассистент для селлеров.
ТВОЯ ЗАДАЧА: Помогать продавцам Wildberries/Ozon уничтожать конкурентов с помощью аналитики.
КОНТЕКСТ: Пользователь ${user.first_name || 'Seller'}.
ИНСТРУМЕНТЫ: Используй unit economics и ABC analysis для конкретных цифр.`;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private async executeTool(name: string, args: any, userId: number, userContext: any) {
    logger.info(`🔨 Tool Exec: ${name}`, args, userId);

    try {
      switch (name) {
        case 'get_products':
          GetProductsArgsSchema.parse(args); // Validate args even if not used directly yet
          // Limit is handled in service or DB query usually. logger.debug('gpArgs', gpArgs);
          return productService.getProductsByUserId(userId);
        case 'calculate_unit_economics': {
          const cueArgs = CalculateUnitEconomicsArgsSchema.parse(args);
          return analyticsService.calculateUnitEconomics(userId, cueArgs);
        }
        case 'get_abc_analysis':
          // No args for ABC currently?
          return analyticsService.getAbcAnalysis(userId);
        case 'get_sales_stats': {
          const gssArgs = GetSalesStatsArgsSchema.parse(args);
          return analyticsService.getSalesStats(userId, gssArgs.period, userContext.api_key_wb);
        }
        default:
          return { error: `Tool ${name} not implemented yet` };
      }
    } catch (error) {
      logger.error(`Validation failed for tool ${name}`, error, { userId, args });
      return {
        error: `Invalid arguments for ${name}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async callOpenAI(messages: any[], tools?: any[], toolChoice?: any): Promise<any> {
    const body: any = {
      model: 'gpt-4o', // Or mini
      messages,
      temperature: 0.7,
    };
    if (tools) {
      body.tools = tools;
      body.tool_choice = toolChoice;
    }

    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content,
      toolCalls: data.choices?.[0]?.message?.tool_calls,
      rawMessage: data.choices?.[0]?.message,
      usage: data.usage,
    };
  }
}

export const agentService = new AgentService();

// Basic polyfill for fetch if needed in Node envs (usually global in Vercel/Node 18+)
// import fetch from 'node-fetch';

import { getKVClient } from '../../core/db';
import type { AgentResult } from '../../core/types';
import { logger } from '../../utils/logger';
import { AGENT_TOOLS } from './agent.tools';
import { productService } from '../product/product.service';
import { analyticsService } from '../analytics/analytics.service';
import { competitorService } from '../competitor/competitor.service';
import { type User } from '../../schemas/user.schema';
import {
  GetProductsArgsSchema,
  CalculateUnitEconomicsArgsSchema,
  GetSalesStatsArgsSchema,
  SetStopLossArgsSchema,
  BulkProtectArgsSchema,
  UpdatePricesArgsSchema,
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
ТВОЯ ЗАДАЧА: Помогать продавцам Wildberries/Ozon уничтожать конкурентов с помощью аналитики и автоматизации.
КОНТЕКСТ: Пользователь ${user.first_name || 'Seller'} (ID: ${user.id}).

ПРАВИЛА:
1. Используй инструменты (Function Calling) для получения реальных данных.
2. Если просят изменить цену или Stop-Loss - ВСЕГДА уточняй подтверждение, если это не явный приказ.
3. Отвечай кратко, по делу, с использованием цифр.
4. В unit economics учитывай комиссию WB (около 23-25% в среднем) если точной нет.
`;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private async executeTool(name: string, args: any, userId: number, userContext: any) {
    logger.info(`🔨 Tool Exec: ${name}`, args, userId);

    try {
      switch (name) {
        case 'get_products':
          GetProductsArgsSchema.parse(args); // Validate args
          return productService.getProductsByUserId(userId);

        case 'calculate_unit_economics': {
          const cueArgs = CalculateUnitEconomicsArgsSchema.parse(args);
          return analyticsService.calculateUnitEconomics(userId, cueArgs);
        }

        case 'get_abc_analysis':
          return analyticsService.getAbcAnalysis(userId);

        case 'get_sales_stats': {
          const gssArgs = GetSalesStatsArgsSchema.parse(args);
          return analyticsService.getSalesStats(userId, gssArgs.period, userContext.api_key_wb);
        }

        case 'set_stop_loss': {
          const sslArgs = SetStopLossArgsSchema.parse(args);
          let minPrice = sslArgs.min_price;

          // If percentage provided, calculate based on current price
          if (minPrice === undefined && sslArgs.percentage !== undefined) {
            const products = await productService.getProductsByUserId(userId);
            const product = products.find(p => p.product_id === sslArgs.product_id);
            if (product) {
              minPrice = Math.round(product.current_price * (1 - sslArgs.percentage / 100));
            }
          }

          if (minPrice !== undefined && minPrice > 0) {
            await productService.updateMinPrice(userId, sslArgs.product_id, minPrice);
            return {
              success: true,
              message: `Set Stop-Loss for ${sslArgs.product_id} to ${minPrice}₽`,
            };
          }
          return { error: 'Product not found or invalid calculation for stop-loss' };
        }

        case 'bulk_protect_products': {
          const bpArgs = BulkProtectArgsSchema.parse(args);
          const products = await productService.getProductsByUserId(userId);
          let count = 0;

          for (const p of products) {
            if (bpArgs.only_unprotected && p.status === 'protected') continue;

            const minPrice = Math.round(p.current_price * (1 - bpArgs.percentage / 100));
            if (minPrice > 0) {
              await productService.updateMinPrice(userId, p.product_id, minPrice);
              count++;
            }
          }
          return {
            success: true,
            message: `Protected ${count} products with ${bpArgs.percentage}% stop-loss`,
          };
        }

        case 'update_prices': {
          const upArgs = UpdatePricesArgsSchema.parse(args);
          const updates = [];
          const products = await productService.getProductsByUserId(userId);

          for (const pid of upArgs.product_ids) {
            const p = products.find(prod => prod.product_id === pid);
            if (!p) continue;

            let newPrice = p.current_price;
            if (upArgs.price_change) {
              newPrice = newPrice + upArgs.price_change;
            } else if (upArgs.price_change_percent) {
              newPrice = newPrice * (1 + upArgs.price_change_percent / 100);
            }

            // Ensure price is positive and rounded
            newPrice = Math.max(1, Math.round(newPrice));
            updates.push({ productId: pid, newPrice });
          }

          if (updates.length === 0) return { error: 'No valid products found for update' };

          const result = await productService.updateMarketplacePrice(userId, updates);
          return result;
        }

        case 'scan_competitors': {
          const { nm_id, keyword, limit } = args;
          return competitorService.scanCompetitors({
            nmId: nm_id,
            keyword,
            limit,
          });
        }

        case 'get_competitor_price_history': {
          const { competitor_nm_id } = args;
          if (!competitor_nm_id) {
            return { error: 'competitor_nm_id is required' };
          }
          return competitorService.getCompetitorPriceHistory(competitor_nm_id);
        }

        default:
          return { error: `Tool ${name} not implemented yet` };
      }
    } catch (error) {
      logger.error(`Tool Error: ${name}`, error, { userId, args });
      return {
        error: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async callOpenAI(messages: any[], tools?: any[], toolChoice?: any): Promise<any> {
    const body: any = {
      model: 'gpt-4o',
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

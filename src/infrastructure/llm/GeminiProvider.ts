// ============================================
// NeuroGUARDIAN — Gemini Provider
// Production LLM provider using Google Gemini API
// Version: 1.0.0 | Date: January 2026
// ============================================

import type { LLMProvider, LLMMessage, LLMResponse } from './LLMProvider.js';
import { logger } from '../../api-lib/lib/logger.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

export interface GeminiConfig {
  model: 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-2.0-flash-lite';
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_CONFIG: GeminiConfig = {
  model: 'gemini-2.5-flash',
  temperature: 0.1,
  maxTokens: 2048,
};

export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  private apiKey: string;
  private config: GeminiConfig;

  constructor(config?: Partial<GeminiConfig>) {
    this.apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!this.apiKey) {
      logger.warn(
        '[GeminiProvider] No API key configured. Set GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY'
      );
    }
  }

  async complete(messages: LLMMessage[], options?: Partial<GeminiConfig>): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const config = { ...this.config, ...options };
    const startTime = Date.now();

    try {
      // Convert messages to OpenAI-compatible format (Gemini supports OpenAI API)
      const openaiMessages = messages.map(m => ({
        role: m.role === 'tool' ? 'user' : m.role, // Gemini maps tool to user
        content: m.content,
      }));

      const response = await fetch(`${GEMINI_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: openaiMessages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[GeminiProvider] API error', {
          status: response.status,
          error: errorText.slice(0, 200),
        });
        throw new Error(`Gemini API error: ${response.status} - ${errorText.slice(0, 100)}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      const content = data.choices?.[0]?.message?.content || '';
      const tokensUsed = data.usage?.total_tokens || 0;

      logger.info('[GeminiProvider] Request completed', {
        model: config.model,
        tokensUsed,
        latencyMs: latency,
      });

      return {
        content,
        tokensUsed,
        toolCalls: data.choices?.[0]?.message?.tool_calls,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error('[GeminiProvider] Request failed', {
        error: error instanceof Error ? error.message : String(error),
        latencyMs: latency,
      });
      throw error;
    }
  }

  /**
   * Complete with function/tool calling support
   */
  async completeWithTools(
    messages: LLMMessage[],
    tools: Array<{
      type: 'function';
      function: {
        name: string;
        description: string;
        parameters: object;
      };
    }>,
    options?: Partial<GeminiConfig>
  ): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const config = { ...this.config, ...options };
    const startTime = Date.now();

    try {
      const openaiMessages = messages.map(m => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content,
        tool_call_id: m.tool_call_id,
      }));

      const response = await fetch(`${GEMINI_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: openaiMessages,
          tools: tools,
          tool_choice: 'auto',
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText.slice(0, 100)}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      logger.info('[GeminiProvider] Tool call completed', {
        model: config.model,
        tokensUsed: data.usage?.total_tokens || 0,
        toolCalls: data.choices?.[0]?.message?.tool_calls?.length || 0,
        latencyMs: latency,
      });

      return {
        content: data.choices?.[0]?.message?.content || '',
        tokensUsed: data.usage?.total_tokens || 0,
        toolCalls: data.choices?.[0]?.message?.tool_calls,
      };
    } catch (error) {
      logger.error('[GeminiProvider] Tool call failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Singleton instances for different use cases
export const geminiFlash = new GeminiProvider({ model: 'gemini-2.5-flash' });
export const geminiPro = new GeminiProvider({ model: 'gemini-2.5-pro' });

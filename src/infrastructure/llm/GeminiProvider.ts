// ============================================
// NeuroGUARDIAN — Gemini Provider (via OpenRouter)
// Production LLM provider using Gemini through OpenRouter
// Works in Russia through OpenRouter proxy
// Version: 1.1.0 | Date: January 2026
// ============================================

import type { LLMProvider, LLMMessage, LLMResponse } from './LLMProvider.js';
import { logger } from '../../api-lib/lib/logger.js';

// OpenRouter endpoint (works globally, including Russia)
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

// Model names on OpenRouter
const MODELS = {
  flash: 'google/gemini-2.5-flash-preview-04-17', // Fast, cheap
  pro: 'google/gemini-2.5-pro-preview', // Advanced reasoning
  // Fallbacks if Gemini unavailable
  claudeHaiku: 'anthropic/claude-3-haiku', // Fast alternative
  claudeSonnet: 'anthropic/claude-3.5-sonnet', // Pro alternative
  mistralSmall: 'mistralai/mistral-small-2501', // Budget option
} as const;

export type GeminiModel =
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'claude-haiku'
  | 'claude-sonnet'
  | 'mistral-small';

export interface GeminiConfig {
  model: GeminiModel;
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_CONFIG: GeminiConfig = {
  model: 'gemini-2.5-flash',
  temperature: 0.1,
  maxTokens: 2048,
};

/**
 * Maps user-friendly model names to OpenRouter model IDs
 */
function getOpenRouterModel(model: GeminiModel): string {
  switch (model) {
    case 'gemini-2.5-flash':
      return MODELS.flash;
    case 'gemini-2.5-pro':
      return MODELS.pro;
    case 'claude-haiku':
      return MODELS.claudeHaiku;
    case 'claude-sonnet':
      return MODELS.claudeSonnet;
    case 'mistral-small':
      return MODELS.mistralSmall;
    default:
      return MODELS.flash;
  }
}

export class GeminiProvider implements LLMProvider {
  name = 'gemini-openrouter';
  private apiKey: string;
  private config: GeminiConfig;

  constructor(config?: Partial<GeminiConfig>) {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!this.apiKey) {
      logger.warn('[GeminiProvider] No OPENROUTER_API_KEY configured');
    }
  }

  async complete(messages: LLMMessage[], options?: Partial<GeminiConfig>): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY');
    }

    const config = { ...this.config, ...options };
    const modelId = getOpenRouterModel(config.model);
    const startTime = Date.now();

    try {
      // Convert messages to OpenAI format
      const openaiMessages = messages.map(m => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content,
      }));

      const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://neuro-guardian.vercel.app',
          'X-Title': 'NeuroGUARDIAN',
        },
        body: JSON.stringify({
          model: modelId,
          messages: openaiMessages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[GeminiProvider] OpenRouter error', {
          status: response.status,
          error: errorText.slice(0, 200),
          model: modelId,
        });
        throw new Error(`OpenRouter error: ${response.status} - ${errorText.slice(0, 100)}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      const content = data.choices?.[0]?.message?.content || '';
      const tokensUsed = data.usage?.total_tokens || 0;

      logger.info('[GeminiProvider] Request completed', {
        model: modelId,
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
      throw new Error('OpenRouter API key not configured');
    }

    const config = { ...this.config, ...options };
    const modelId = getOpenRouterModel(config.model);
    const startTime = Date.now();

    try {
      const openaiMessages = messages.map(m => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content,
        tool_call_id: m.tool_call_id,
      }));

      const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://neuro-guardian.vercel.app',
          'X-Title': 'NeuroGUARDIAN',
        },
        body: JSON.stringify({
          model: modelId,
          messages: openaiMessages,
          tools: tools,
          tool_choice: 'auto',
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter error: ${response.status} - ${errorText.slice(0, 100)}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      logger.info('[GeminiProvider] Tool call completed', {
        model: modelId,
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

// Alternative models if Gemini unavailable
export const claudeHaiku = new GeminiProvider({ model: 'claude-haiku' });
export const claudeSonnet = new GeminiProvider({ model: 'claude-sonnet' });

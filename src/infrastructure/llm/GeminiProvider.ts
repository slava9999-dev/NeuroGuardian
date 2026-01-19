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
  // Direct Gemini models (Fallback IDs)
  'gemini-2.0-flash': 'gemini-1.5-flash',
  'gemini-1.5-pro': 'gemini-1.5-flash', // Fallback to flash if Pro is quota limited
  // OpenRouter specific models (Primary)
  flash: 'google/gemini-2.0-flash-001',
  pro: 'google/gemini-2.0-flash-001', // Using 2.0 Flash for Pro as well (Smarter & Faster & 1M context)
  // Fallbacks
  claudeHaiku: 'anthropic/claude-3-haiku',
  claudeSonnet: 'anthropic/claude-3.5-sonnet',
  mistralSmall: 'mistralai/mistral-small-2501',
} as const;

export type GeminiModel =
  | 'gemini-2.0-flash'
  | 'gemini-1.5-pro'
  | 'claude-haiku'
  | 'claude-sonnet'
  | 'mistral-small';

export interface GeminiConfig {
  model: GeminiModel;
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_CONFIG: GeminiConfig = {
  model: 'gemini-2.0-flash',
  temperature: 0.1,
  maxTokens: 2048,
};

/**
 * Maps user-friendly model names to OpenRouter model IDs
 */
function getOpenRouterModel(model: GeminiModel): string {
  switch (model) {
    case 'gemini-2.0-flash':
      return MODELS.flash;
    case 'gemini-1.5-pro':
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

    if (!this.apiKey && !process.env.GEMINI_API_KEY) {
      logger.warn('[GeminiProvider] No OPENROUTER_API_KEY or GEMINI_API_KEY configured');
    }
  }

  async complete(messages: LLMMessage[], options?: Partial<GeminiConfig>): Promise<LLMResponse> {
    const config = { ...this.config, ...options };
    const startTime = Date.now();

    // 1. Try Direct Google API first ONLY if OpenRouter key is missing
    // Direct API is blocked in some regions (e.g. Russia)
    const googleKey = process.env.GEMINI_API_KEY;
    const useDirect = !this.apiKey && !!googleKey;

    if (useDirect) {
      try {
        // 🛡️ CEMENTED MODELS: Fallback models for direct API
        let modelId = 'gemini-1.5-flash';
        if (config.model === 'gemini-1.5-pro') modelId = 'gemini-1.5-pro';

        // 1. Extract System Prompt
        const systemMsg = messages.find(m => m.role === 'system');

        const systemInstruction = systemMsg
          ? {
              parts: [
                {
                  text:
                    typeof systemMsg.content === 'string'
                      ? systemMsg.content
                      : JSON.stringify(systemMsg.content),
                },
              ],
            }
          : undefined;

        // 2. Filter and Map User/Model messages
        // Google API doesn't allow 'system' role in contents
        const contents = messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role === 'tool' ? 'user' : m.role === 'assistant' ? 'model' : 'user',
            parts: [
              { text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) },
            ],
          }));

        const requestBody: {
          contents: { role: string; parts: { text: string }[] }[];
          generationConfig: { temperature?: number; maxOutputTokens?: number };
          systemInstruction?: { parts: { text: string }[] };
        } = {
          contents: contents,
          generationConfig: {
            temperature: config.temperature,
            maxOutputTokens: config.maxTokens,
          },
        };

        // Add system instruction if present
        if (systemInstruction) {
          requestBody.systemInstruction = systemInstruction;
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${googleKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          throw new Error(`Google API error: ${response.status} ${await response.text()}`);
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const tokensUsed = data.usageMetadata?.totalTokenCount || 0;
        const latency = Date.now() - startTime;

        logger.info('[GeminiProvider] Direct Google Request completed', {
          model: modelId,
          tokensUsed,
          latencyMs: latency,
        });

        return {
          content,
          tokensUsed,
          toolCalls: undefined, // No tools support in this simple implementation yet
        };
      } catch (error) {
        logger.error('[GeminiProvider] Direct Google Request failed', error);
        throw error;
      }
    }

    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY');
    }

    // OpenRouter implementation...
    const modelId = getOpenRouterModel(config.model);
    // ... rest of existing OpenRouter logic

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
        logger.error('[GeminiProvider] OpenRouter error', errorText, {
          status: response.status,
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
    const config = { ...this.config, ...options };
    const startTime = Date.now();

    // Try Direct Google API first if no OpenRouter key
    const googleKey = process.env.GEMINI_API_KEY;
    const useDirect = !this.apiKey && !!googleKey;

    if (useDirect) {
      try {
        let modelId = 'gemini-1.5-flash';
        if (config.model === 'gemini-1.5-pro') modelId = 'gemini-1.5-pro';

        // Extract System Prompt
        const systemMsg = messages.find(m => m.role === 'system');
        const systemInstruction = systemMsg
          ? {
              parts: [
                {
                  text:
                    typeof systemMsg.content === 'string'
                      ? systemMsg.content
                      : JSON.stringify(systemMsg.content),
                },
              ],
            }
          : undefined;

        // Convert messages to Google format
        const contents = messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [
              { text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) },
            ],
          }));

        // Convert OpenAI tools format to Google format
        const googleTools =
          tools.length > 0
            ? [
                {
                  function_declarations: tools.map(t => ({
                    name: t.function.name,
                    description: t.function.description,
                    parameters: t.function.parameters,
                  })),
                },
              ]
            : undefined;

        const requestBody: Record<string, unknown> = {
          contents,
          generationConfig: {
            temperature: config.temperature,
            maxOutputTokens: config.maxTokens,
          },
        };

        if (systemInstruction) {
          requestBody.systemInstruction = systemInstruction;
        }
        if (googleTools) {
          requestBody.tools = googleTools;
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${googleKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Google API error: ${response.status} ${errorText.slice(0, 200)}`);
        }

        const data = await response.json();
        const latency = Date.now() - startTime;

        // Parse response
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        // Extract text content
        const textPart = parts.find((p: { text?: string }) => p.text);
        const content = textPart?.text || '';

        // Extract function calls (Google format)
        const functionCallParts = parts.filter((p: { functionCall?: unknown }) => p.functionCall);
        const toolCalls = functionCallParts.map(
          (p: { functionCall: { name: string; args: object } }, idx: number) => ({
            id: `call_${idx}`,
            type: 'function' as const,
            function: {
              name: p.functionCall.name,
              arguments: JSON.stringify(p.functionCall.args || {}),
            },
          })
        );

        const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

        logger.info('[GeminiProvider] Direct Google Tool call completed', {
          model: modelId,
          tokensUsed,
          toolCalls: toolCalls.length,
          latencyMs: latency,
        });

        return {
          content,
          tokensUsed,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };
      } catch (error) {
        logger.error('[GeminiProvider] Direct Google Tool call failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    // Fallback to OpenRouter
    if (!this.apiKey) {
      throw new Error('No LLM API key configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY');
    }

    const modelId = getOpenRouterModel(config.model);

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
export const geminiFlash = new GeminiProvider({ model: 'gemini-2.0-flash' });
export const geminiPro = new GeminiProvider({ model: 'gemini-1.5-pro' });

// Alternative models if Gemini unavailable
export const claudeHaiku = new GeminiProvider({ model: 'claude-haiku' });
export const claudeSonnet = new GeminiProvider({ model: 'claude-sonnet' });

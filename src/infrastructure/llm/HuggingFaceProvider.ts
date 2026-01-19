// ============================================
// NeuroGUARDIAN — HuggingFace Provider (PRO)
// Production LLM provider using HF Serverless Inference API
// Version: 1.0.0 | Date: January 2026
// ============================================

import type { LLMProvider, LLMMessage, LLMResponse } from './LLMProvider.js';
import { logger } from '../../api-lib/lib/logger.js';

// Configuration for HF Models
export const HF_MODELS = {
  // Main Brain (Smartest) - Qwen 2.5 72B
  // Beating GPT-4 in coding/math/russian
  brain: 'Qwen/Qwen2.5-72B-Instruct',

  // Coder (Specialized)
  coder: 'Qwen/Qwen2.5-Coder-32B-Instruct',

  // Fast (Speed optimized)
  fast: 'meta-llama/Llama-3.2-3B-Instruct',

  // Vision (Multimodal)
  vision: 'Qwen/Qwen2-VL-72B-Instruct', // Or similar available on HF Inference
} as const;

export type HFModelKey = keyof typeof HF_MODELS;

export interface HuggingFaceConfig {
  model?: string; // Full model ID or key from HF_MODELS
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

const DEFAULT_CONFIG: HuggingFaceConfig = {
  model: HF_MODELS.brain,
  temperature: 0.5,
  maxTokens: 4096, // Qwen supports up to 32k context usually
  topP: 0.9,
};

export class HuggingFaceProvider implements LLMProvider {
  name = 'huggingface-pro';
  private apiKey: string;
  private config: HuggingFaceConfig;

  constructor(config?: HuggingFaceConfig) {
    this.apiKey = process.env.HUGGINGFACE_API_KEY || '';
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!this.apiKey) {
      logger.warn('[HuggingFaceProvider] API Key missing! Agent will fail.');
    }
  }

  /**
   * Main completion method compatible with OpenAI-like chat format
   * HF Inference API follows OpenAI Chat Completion spec for newer models
   */
  async complete(
    messages: LLMMessage[],
    options?: Partial<HuggingFaceConfig>
  ): Promise<LLMResponse> {
    const config = { ...this.config, ...options };
    const startTime = Date.now();

    const modelId = this.resolveModel(config.model);

    try {
      // HF OpenAI-compatible endpoint on Router
      const url = `https://router.huggingface.co/v1/chat/completions`;

      // Convert messages to OpenAI format
      const hfMessages = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: hfMessages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          top_p: config.topP,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HF API Error (${response.status}): ${errorText.slice(0, 200)}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';

      const usage = data.usage || {};
      const tokensUsed = usage.total_tokens || 0;

      const latency = Date.now() - startTime;

      logger.info(`[HuggingFace] Completion success (${modelId})`, {
        latencyMs: latency,
        tokens: tokensUsed,
      });

      return {
        content,
        tokensUsed,
        toolCalls: data.choices[0]?.message?.tool_calls,
      };
    } catch (error) {
      logger.error('[HuggingFace] Completion failed', { model: modelId, error });
      throw error;
    }
  }

  /**
   * Tool Calling Support
   */
  async completeWithTools(
    messages: LLMMessage[],
    tools: any[],
    options?: Partial<HuggingFaceConfig>
  ): Promise<LLMResponse> {
    const config = { ...this.config, ...options };
    const modelId = this.resolveModel(config.model);

    try {
      const url = `https://router.huggingface.co/v1/chat/completions`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: messages,
          tools: tools,
          tool_choice: 'auto',
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        }),
      });

      if (!response.ok) {
        throw new Error(`HF Tool API Error: ${response.status} ${await response.text()}`);
      }

      const data = await response.json();
      const choice = data.choices[0];

      return {
        content: choice.message.content,
        toolCalls: choice.message.tool_calls,
        tokensUsed: data.usage?.total_tokens || 0,
      };
    } catch (error) {
      logger.error('[HuggingFace] Tool execution failed', { error });
      throw error;
    }
  }

  private resolveModel(input?: string): string {
    if (!input) return HF_MODELS.brain;
    // Check if it's a short key
    if (input in HF_MODELS) {
      return HF_MODELS[input as HFModelKey];
    }
    // Return custom string
    return input;
  }
}

// Singleton instances
export const hfBrain = new HuggingFaceProvider({ model: 'brain' });
export const hfCoder = new HuggingFaceProvider({ model: 'coder' });

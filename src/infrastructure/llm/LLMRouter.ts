import type { LLMProvider, LLMMessage, LLMResponse } from './LLMProvider.js';
import { getLLMConfig } from '../../core/config/llm.config.js';
import { OpenRouterProvider } from './OpenRouterProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { HuggingFaceProvider } from './HuggingFaceProvider.js';

export class LLMRouter {
  private providers: LLMProvider[] = [];
  private initialized = false;

  constructor(providers?: LLMProvider[]) {
    if (providers) {
      this.providers = providers;
      this.initialized = true;
    }
  }

  private async ensureInitialized() {
    if (this.initialized) return;

    try {
      const config = await getLLMConfig();

      // PRIORITIZE HuggingFace if key is present (High quality PRO subscription)
      if (process.env.HUGGINGFACE_API_KEY) {
        this.providers.push(new HuggingFaceProvider());
        console.log('[LLMRouter] Using HuggingFace PRO (Qwen 2.5) as primary provider');
      }

      // Add secondary/fallback providers
      if (config.provider === 'openrouter' && !process.env.HUGGINGFACE_API_KEY) {
        this.providers.push(new OpenRouterProvider());
      } else if (config.provider === 'openai' && !process.env.HUGGINGFACE_API_KEY) {
        this.providers.push(new OpenAIProvider());
      }

      // Fallback to OpenRouter if HF isn't available
      if (this.providers.length === 0) {
        this.providers.push(new OpenRouterProvider());
      }
    } catch (e) {
      console.warn('Failed to initialize LLM config', e);
      // Absolute fallback
      this.providers.push(new OpenRouterProvider());
    }
    this.initialized = true;
  }

  async complete(messages: LLMMessage[], options?: Record<string, unknown>): Promise<LLMResponse> {
    await this.ensureInitialized();

    if (this.providers.length === 0) {
      throw new Error('No LLM providers initialized');
    }

    const errors: Error[] = [];

    for (const provider of this.providers) {
      try {
        return await provider.complete(messages, options);
      } catch (error) {
        console.warn(`[LLMRouter] Provider ${provider.name} failed:`, error);
        errors.push(error as Error);
        continue;
      }
    }

    throw new Error(`All LLM providers failed. Errors: ${errors.map(e => e.message).join(', ')}`);
  }
}

export const llmRouter = new LLMRouter();

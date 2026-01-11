import type { LLMProvider, LLMMessage, LLMResponse } from './LLMProvider.js';
import { getLLMConfig } from '../../core/config/llm.config.js';
import { OpenRouterProvider } from './OpenRouterProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';

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
      // Initialize based on config provider
      if (config.provider === 'openrouter') {
        this.providers.push(new OpenRouterProvider());
        // Fallback: if we have openai key, add it?
        // For now, adhere to explicit config choice for primary
      } else if (config.provider === 'openai') {
        this.providers.push(new OpenAIProvider());
      } else {
        // Default to OpenRouter if unknown or not set?
        // Or throw
        console.warn(`Unknown LLM provider in config: ${config.provider}`);
      }

      // Add backup providers if keys available?
      // Logic for backup keys would need to be in config or fetched here.
      // Keeping it simple: 1 provider from config for now + explicit injects.
    } catch (e) {
      console.warn('Failed to initialize LLM config', e);
    }
    this.initialized = true;
  }

  async complete(messages: LLMMessage[], options?: any): Promise<LLMResponse> {
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

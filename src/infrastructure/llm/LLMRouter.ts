import { getLLMConfig, type LLMConfig } from '../../core/config/llm.config.js';
import { LLMError } from '../../core/errors/AgentErrors.js';
import type { LLMCompletionResult } from '../../core/types/agent.types.js';

export class LLMRouter {
  private config: LLMConfig | null = null;

  constructor() {}

  private async ensureConfig(): Promise<LLMConfig> {
    if (!this.config) {
      this.config = await getLLMConfig();
    }
    return this.config;
  }

  /**
   * Route a completion request to the appropriate model
   */
  async complete(
    prompt: string,
    mode: 'planner' | 'chat' | 'fast' = 'chat',
    options: {
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
    } = {}
  ): Promise<LLMCompletionResult> {
    const config = await this.ensureConfig();
    const model = config.models[mode];

    try {
      if (config.provider === 'openrouter') {
        return await this.callOpenRouter(prompt, model, config.apiKey, options);
      } else if (config.provider === 'openai') {
        return await this.callOpenAI(prompt, model, config.apiKey, options);
      } else {
        throw new Error(`Unsupported provider: ${config.provider}`);
      }
    } catch (error) {
      console.error(`LLM Call Failed (${mode}/${model}):`, error);
      throw new LLMError(config.provider, error instanceof Error ? error.message : String(error));
    }
  }

  private async callOpenRouter(
    prompt: string,
    model: string,
    apiKey: string,
    options: any
  ): Promise<LLMCompletionResult> {
    const startTime = Date.now();

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://neuroguardian.app',
        'X-Title': 'NeuroGUARDIAN',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        response_format: options.jsonMode ? { type: 'json_object' } : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API Error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as any;
    const content = data.choices[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    return {
      content,
      tokensUsed,
      provider: 'openrouter',
      latencyMs: Date.now() - startTime,
    };
  }

  private async callOpenAI(
    prompt: string,
    model: string,
    apiKey: string,
    options: any
  ): Promise<LLMCompletionResult> {
    const startTime = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        response_format: options.jsonMode ? { type: 'json_object' } : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as any;
    const content = data.choices[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    return {
      content,
      tokensUsed,
      provider: 'openai',
      latencyMs: Date.now() - startTime,
    };
  }
}

export const llmRouter = new LLMRouter();

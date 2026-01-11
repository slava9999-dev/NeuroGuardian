import { getSecret } from '../../api-lib/lib/secrets-helper.js';

export interface LLMConfig {
  provider: 'openrouter' | 'openai' | 'anthropic';
  apiKey: string;
  baseUrl?: string;
  models: {
    planner: string;
    chat: string;
    fast: string;
  };
  timeout: number;
  retries: number;
}

export async function getLLMConfig(): Promise<LLMConfig> {
  // Try to get OpenRouter key first
  const openRouterKey = (await getSecret('OPENROUTER_API_KEY')) || process.env.OPENROUTER_API_KEY;

  if (openRouterKey) {
    return {
      provider: 'openrouter',
      apiKey: openRouterKey,
      baseUrl: 'https://openrouter.ai/api/v1',
      models: {
        planner: 'anthropic/claude-3.5-sonnet',
        chat: 'anthropic/claude-3.5-sonnet',
        fast: 'openai/gpt-4o-mini',
      },
      timeout: 30000,
      retries: 3,
    };
  }

  // Fallback to OpenAI
  const openAiKey = (await getSecret('OPENAI_API_KEY')) || process.env.OPENAI_API_KEY;
  if (openAiKey) {
    return {
      provider: 'openai',
      apiKey: openAiKey,
      models: {
        planner: 'gpt-4o',
        chat: 'gpt-4o',
        fast: 'gpt-4o-mini',
      },
      timeout: 30000,
      retries: 3,
    };
  }

  throw new Error('No LLM API keys found (checked OPENROUTER_API_KEY, OPENAI_API_KEY)');
}

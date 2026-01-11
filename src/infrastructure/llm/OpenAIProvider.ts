import type { LLMProvider, LLMMessage, LLMResponse } from './LLMProvider.js';
import { getLLMConfig } from '../../core/config/llm.config.js';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';

  async complete(messages: LLMMessage[], options: any = {}): Promise<LLMResponse> {
    const config = await getLLMConfig();
    const apiKey = config.apiKey;
    const model = options.model || 'gpt-4o';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
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
    };
  }
}

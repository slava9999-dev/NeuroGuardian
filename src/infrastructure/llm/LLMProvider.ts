export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed: number;
  toolCalls?: any[];
}

export interface LLMProvider {
  complete(messages: LLMMessage[], options?: any): Promise<LLMResponse>;
  name: string;
}

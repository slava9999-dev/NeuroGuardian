export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<MessagePart>;
  tool_calls?: any[];
  tool_call_id?: string;
}

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

export interface LLMResponse {
  content: string;
  tokensUsed: number;
  toolCalls?: any[];
}

export interface LLMProvider {
  complete(messages: LLMMessage[], options?: any): Promise<LLMResponse>;
  name: string;
}

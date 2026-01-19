export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<MessagePart>;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

export interface LLMResponse {
  content: string;
  tokensUsed: number;
  toolCalls?: ToolCall[];
}

export interface LLMProvider {
  complete(messages: LLMMessage[], options?: Record<string, unknown>): Promise<LLMResponse>;
  name: string;
}

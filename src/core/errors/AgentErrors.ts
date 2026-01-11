import { AppError } from './AppError.js';

export class AgentError extends AppError {
  constructor(message: string, code: string = 'AGENT_ERROR') {
    super(message, code, 500);
  }
}

export class ToolExecutionError extends AgentError {
  constructor(toolName: string, cause: unknown) {
    super(`Failed to execute tool ${toolName}: ${cause}`, 'TOOL_EXECUTION_ERROR');
  }
}

export class LLMError extends AgentError {
  constructor(provider: string, message: string) {
    super(`LLM Error (${provider}): ${message}`, 'LLM_ERROR');
  }
}

export class ContextError extends AgentError {
  constructor(message: string) {
    super(message, 'CONTEXT_ERROR');
  }
}
